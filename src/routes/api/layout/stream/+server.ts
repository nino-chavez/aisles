import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamText, Output } from 'ai';
import { model as anthropicModel, PRIMARY_MODEL } from '$lib/server/model';
import { layoutSchemaFor, type Layout } from '$lib/schema/layout';
import { buildLayoutPrompt, PROMPT_VERSION, type IncentivesPromptContext } from '$lib/server/layout-prompt';
import { loadCategoryProducts, loadHomeProducts } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout } from '$lib/server/cache';
import { logGeneration } from '$lib/server/generation-log';
import { getActiveRules, rulesToPromptContext } from '$lib/server/rules';
import { getSessionStore, hasSession } from '$lib/signals/session';
import { getBrand } from '$lib/brand/config';
import {
	buildLegacyLayoutProvenance,
	LEGACY_LAYOUT_SCHEMA_VERSION,
} from '$lib/server/layout-provenance';

/**
 * POST /api/layout/stream
 *
 * Streams a layout object as SSE. Cache hits return a complete JSON
 * response immediately. Cache misses stream partial objects as sections
 * are generated, then send a final __done event with the validated layout.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const startTime = Date.now();
	const brand = getBrand();
	if (brand.id === 'kibble') {
		return json(
			{ error: 'Generated layouts are unavailable for this reference-preserved storefront.' },
			{ status: 503 },
		);
	}
	const sessionId = cookies.get('aisles_session') || undefined;
	const scenario = sessionId && await hasSession(sessionId)
		? (await getSessionStore(sessionId)).getCrossSessionContext().scenarioId
		: null;

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

		// Catalog, rules, and prompt are part of the cache identity. Build them
		// before lookup so streaming and non-streaming endpoints use one contract.
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
		const prompt = buildLayoutPrompt(
			persona,
			categoryName,
			products,
			picksContext,
			rulesContext,
			probabilities,
			incentives ?? undefined,
			isHome,
		);
		const provenance = buildLegacyLayoutProvenance({
			brand,
			surface: isHome ? 'home' : 'plp',
			route: isHome ? '/' : `/category/${categorySlug}`,
			persona,
			promptVersion: PROMPT_VERSION,
			schemaVersion: LEGACY_LAYOUT_SCHEMA_VERSION,
			prompt,
			catalogInput: { categoryName, products },
			shopperContext: { persona, probabilities: probabilities ?? null },
			picksContext: picksContext || undefined,
			incentiveContext: incentives ?? undefined,
			scenarioId: scenario,
		});

		// Scenario sessions are synthetic. Their deterministic signals must never
		// read or populate the cache shared by real shoppers.
		const cached = scenario ? null : await getCachedLayout(provenance);
		if (cached) {
			const elapsed = Date.now() - startTime;

			await logGeneration({
				type: 'layout',
				persona,
				categorySlug,
				cacheHit: true,
				generationTimeMs: elapsed,
				sessionId,
				provenance: cached.provenance,
			});

			return json({
				layout: cached.layout,
				meta: {
					persona,
					categoryName,
					productCount: products.length,
					generationTimeMs: elapsed,
					cacheHit: true,
					provenance: cached.provenance,
				},
			});
		}

		// ─── Cache miss — stream via AI Gateway ───────────────────
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

					if (layout && !scenario) {
						cacheLayout(provenance, layout).catch(() => {});
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
						provenance,
					});

					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({
							__done: true,
							layout,
							meta: {
								persona,
								categoryName,
								productCount: products.length,
								generationTimeMs: elapsed,
								cacheHit: false,
								provenance,
							},
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
