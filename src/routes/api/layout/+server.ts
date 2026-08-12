import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { model, withModelFallback } from '$lib/server/model';
import { layoutSchemaFor } from '$lib/schema/layout';
import { buildLayoutPrompt, type IncentivesPromptContext } from '$lib/server/layout-prompt';
import { loadCategoryProducts } from '$lib/server/catalog';
import { getCachedLayout, cacheLayout, hashPicks } from '$lib/server/cache';
import { logGeneration } from '$lib/server/generation-log';
import { getActiveRules, rulesToPromptContext } from '$lib/server/rules';

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

		// ─── Cache check ───────────────────────────────────────────
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

			logGeneration({
				type: 'layout',
				persona,
				categorySlug,
				cacheHit: true,
				generationTimeMs: elapsed,
				sessionId,
			}).catch(() => {});

			return json({
				layout: cached,
				meta: {
					persona,
					categoryName: categorySlug,
					productCount: 0,
					generationTimeMs: elapsed,
					cacheHit: true,
				},
			});
		}

		// ─── Cache miss — generate via AI Gateway ──────────────────
		const result = await loadCategoryProducts(categorySlug, persona);
		if (!result) {
			return json({ error: `Category "${categorySlug}" not found` }, { status: 404 });
		}

		const { products, categoryName } = result;
		// Fetch merchandising rules from the admin app's shared DB
		const rules = await getActiveRules(persona, categorySlug);
		const rulesContext = rulesToPromptContext(rules);

		const prompt = buildLayoutPrompt(persona, categoryName, products, picksContext, rulesContext, probabilities, incentives ?? undefined);

		// Haiku primary, Sonnet fallback — explicit retry in withModelFallback
		const { result: aiResult, modelId } = await withModelFallback((id) =>
			generateText({
				model: model(id),
				output: Output.object({ schema: layoutSchemaFor(persona) }),
				prompt,
			})
		);
		const layout = aiResult.output;
		const usage = aiResult.usage;

		if (layout) {
			cacheLayout(persona, categorySlug, layout, ph).catch(() => {});
		}

		const elapsed = Date.now() - startTime;

		logGeneration({
			type: 'layout',
			persona,
			categorySlug,
			cacheHit: false,
			generationTimeMs: elapsed,
			productCount: products.length,
			inputTokens: usage?.inputTokens,
			outputTokens: usage?.outputTokens,
			model: modelId,
			sessionId,
		}).catch(() => {});

		return json({
			layout,
			meta: {
				persona,
				categoryName,
				productCount: products.length,
				generationTimeMs: elapsed,
				cacheHit: false,
			},
		});
	} catch (err) {
		const elapsed = Date.now() - startTime;
		console.error('Layout generation failed:', err);

		return json(
			{
				error: 'Layout generation failed',
				message: err instanceof Error ? err.message : 'Unknown error',
				generationTimeMs: elapsed,
			},
			{ status: 500 }
		);
	}
};
