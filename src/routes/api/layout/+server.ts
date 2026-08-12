import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { model, withModelFallback } from '$lib/server/model';
import { layoutSchemaFor } from '$lib/schema/layout';
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

export const POST: RequestHandler = async ({ request, cookies }) => {
	const startTime = Date.now();

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
		// before lookup so catalog or merchandising changes cannot hit a stale key.
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
			brand: getBrand(),
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
					categoryName: categorySlug,
					productCount: products.length,
					generationTimeMs: elapsed,
					cacheHit: true,
					provenance: cached.provenance,
				},
			});
		}

		// ─── Cache miss — generate via AI Gateway ──────────────────
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

		if (layout && !scenario) {
			cacheLayout(provenance, layout).catch(() => {});
		}

		const elapsed = Date.now() - startTime;

		await logGeneration({
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
			provenance,
		});

		return json({
			layout,
			meta: {
				persona,
				categoryName,
				productCount: products.length,
				generationTimeMs: elapsed,
				cacheHit: false,
				provenance,
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
