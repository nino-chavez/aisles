import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamText, Output } from 'ai';
import { model as anthropicModel, PRIMARY_MODEL } from '$lib/server/model';
import { layoutSchemaFor, type Layout } from '$lib/schema/layout';
import { buildLayoutPrompt, type IncentivesPromptContext } from '$lib/server/layout-prompt';
import { loadCategoryProducts, loadHomeProducts } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout, hashPicks } from '$lib/server/cache';
import { logGeneration } from '$lib/server/generation-log';
import { getActiveRules, rulesToPromptContext } from '$lib/server/rules';

/**
 * POST /api/layout/stream
 *
 * Streams a layout object as SSE. Cache hits return a complete JSON
 * response immediately. Cache misses stream partial objects as sections
 * are generated, then send a final __done event with the validated layout.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const startTime = Date.now();
	const sessionId = cookies.get('aisles_session') || undefined;

	try {
		const { persona, categorySlug, picksContext, probabilities, incentives } = (await request.json()) as {
			persona: string;
			categorySlug: string;
			picksContext?: string;
			probabilities?: { gatherer: number; hunter: number; researcher: number; gifter: number };
			incentives?: IncentivesPromptContext | null;
		};

		if (!persona || !categorySlug) {
			return json({ error: 'Missing required fields: persona, categorySlug' }, { status: 400 });
		}

		// ─── Cache check — return instantly ────────────────────────
		// Fold the incentives fingerprint into the picks hash so cached layouts
		// don't cross-pollinate between incentive states (wallet, tier, codes).
		const incentivesFingerprint = incentives
			? JSON.stringify({
					w: incentives.walletBalanceMinor ?? 0,
					t: incentives.tierUnitsToNext ?? null,
					c: (incentives.appliedCodes ?? []).slice().sort(),
				})
			: '';
		const ph = hashPicks((picksContext ?? '') + '|' + incentivesFingerprint);
		const cached = await getCachedLayout(persona, categorySlug, ph);
		if (cached) {
			const elapsed = Date.now() - startTime;

			await logGeneration({
				type: 'layout',
				persona,
				categorySlug,
				cacheHit: true,
				generationTimeMs: elapsed,
				sessionId,
			});

			return json({
				layout: cached,
				meta: { persona, categoryName: categorySlug, productCount: 0, generationTimeMs: elapsed, cacheHit: true },
			});
		}

		// ─── Cache miss — stream via AI Gateway ───────────────────
		const isHome = categorySlug === 'home';
		const result = isHome
			? await loadHomeProducts(persona)
			: await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		const rules = await getActiveRules(persona, categorySlug);
		const rulesContext = rulesToPromptContext(rules);
		const prompt = buildLayoutPrompt(persona, categoryName, products, picksContext, rulesContext, probabilities, incentives ?? undefined, isHome);

		const model = PRIMARY_MODEL;

		// Haiku primary, Sonnet fallback — handled by AI Gateway
		const stream = streamText({
			model: anthropicModel(),
			output: Output.object({ schema: layoutSchemaFor(persona) }),
			prompt,
		});

		const encoder = new TextEncoder();

		const readable = new ReadableStream({
			async start(controller) {
				try {
					for await (const partial of stream.partialOutputStream) {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify(partial)}\n\n`)
						);
					}

					// Await final validated object and usage
					const layout = await stream.output as Layout;
					const usage = await stream.usage;
					const elapsed = Date.now() - startTime;

					if (layout) {
						cacheLayout(persona, categorySlug, layout, ph).catch(() => {});
					}

					await logGeneration({
						type: 'layout',
						persona,
						categorySlug,
						cacheHit: false,
						generationTimeMs: elapsed,
						productCount: products.length,
						inputTokens: usage?.inputTokens,
						outputTokens: usage?.outputTokens,
						model,
						sessionId,
					});

					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({
							__done: true,
							layout,
							meta: { persona, categoryName, productCount: products.length, generationTimeMs: elapsed, cacheHit: false },
						})}\n\n`)
					);

					controller.close();
				} catch (err) {
					const elapsed = Date.now() - startTime;
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({
							__error: true,
							message: err instanceof Error ? err.message : 'Stream failed',
							generationTimeMs: elapsed,
						})}\n\n`)
					);
					controller.close();
				}
			},
		});

		return new Response(readable, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (err) {
		return json(
			{ error: 'Layout generation failed', message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 },
		);
	}
};
