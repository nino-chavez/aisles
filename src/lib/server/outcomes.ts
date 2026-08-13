/**
 * session_outcomes reader/writer.
 *
 * Writes one row per finalized session, capturing the final inference state
 * and observed in-session behavior. Feeds the LR fitting script and the
 * calibration check.
 *
 * Writes are idempotent on session_id — a second finalize of the same
 * session upserts the row.
 */

import { getDb } from './db';
import { getBrand } from '$lib/brand/config';
import type { Persona, PersonaInference, PersonaProbabilities, InferenceContext } from '$lib/signals/types';
import type { SignalStore } from '$lib/signals/store';
import { infer, priorFor as inferPriorFor } from '$lib/signals/inference';

export interface SessionOutcome {
	sessionId: string;
	endedAt: Date;
	durationMs: number;
	primaryFinal: Persona;
	probabilitiesFinal: PersonaProbabilities;
	entropyFinal: number;
	certaintyFinal: number;
	priorAtStart: PersonaProbabilities;
	converted: boolean;
	cartAddCount: number;
	cartRemovalCount: number;
	productViewCount: number;
	categoryViewCount: number;
	refineMessageCount: number;
	backNavCount: number;
	maxScrollDepth: number;
	avgDwellMs: number;
	visitCount: number;
	currentCategory: string | null;
	ruleMatches: string[];
	labelSource: 'intent_param' | 'conversion' | 'behavior_pattern' | 'unknown';
	labelPersona: Persona | null;
	synthetic: boolean;
	scenarioId: string | null;
}

function probabilitiesJson(value: PersonaProbabilities) {
	return {
		gatherer: value.gatherer,
		hunter: value.hunter,
		researcher: value.researcher,
		gifter: value.gifter,
	};
}

/**
 * Assign a ground-truth label to a finalized session. Used by the LR fitting
 * pipeline to filter high-confidence labeled sessions.
 *
 * Precedence:
 *   1. intent_param present and valid persona → strongest label
 *   2. converted + primary has certainty > 0.3 → medium-confidence conversion label
 *   3. dominant single persona in rule matches → weak behavioral label
 *   4. unknown → excluded from fitting
 */
export function labelOutcome(
	ctx: InferenceContext,
	inference: PersonaInference,
	converted: boolean,
): { source: SessionOutcome['labelSource']; persona: Persona | null } {
	// 1. Intent param — trust it unconditionally
	if (ctx.intentParam) {
		const p = ctx.intentParam as Persona;
		if (p === 'gatherer' || p === 'hunter' || p === 'researcher' || p === 'gifter') {
			return { source: 'intent_param', persona: p };
		}
	}

	// 2. Converted session with confident primary
	if (converted && inference.certainty > 0.3) {
		return { source: 'conversion', persona: inference.primary };
	}

	// 3. Behavioral pattern — high certainty from signals alone
	if (inference.certainty > 0.5 && inference.signalCount >= 3) {
		return { source: 'behavior_pattern', persona: inference.primary };
	}

	return { source: 'unknown', persona: null };
}

/**
 * Finalize a session — runs inference against the current store state,
 * labels the outcome, and writes to Postgres. Idempotent on brand + sessionId.
 *
 * Called on:
 *   - Terminal conversion signals (commerce.add_to_cart in /api/signals)
 *   - Page unload beacon (/api/signals/finalize)
 *   - TTL sweep for abandoned sessions (future)
 *
 * This is required operational telemetry. Database failures propagate so the
 * endpoint cannot report a false-success outcome finalization.
 */
export async function finalizeSession(
	store: SignalStore,
	opts: { converted?: boolean } = {},
): Promise<void> {
	const ctx = store.toInferenceContext();
	const inference = infer(ctx);
	const events = store.getEvents();

	const endedAt = new Date();
	const firstEventTs = events[0]?.timestamp ?? endedAt.getTime();
	const durationMs = Math.max(0, endedAt.getTime() - firstEventTs);

	const converted = opts.converted ?? ctx.cartAddCount > 0;

	// Prior snapshot: the prior that would apply to the current category.
	// Matches what infer() actually used for this call.
	const priorAtStart = inferPriorFor(ctx.currentCategory);

	const ruleMatches = inference.ruleMatches.map((r) => r.ruleName);
	const { source: labelSource, persona: labelPersona } = labelOutcome(ctx, inference, converted);

	const outcome: SessionOutcome = {
		sessionId: store.sessionId,
		endedAt,
		durationMs,
		primaryFinal: inference.primary,
		probabilitiesFinal: inference.probabilities,
		entropyFinal: inference.entropy,
		certaintyFinal: inference.certainty,
		priorAtStart,
		converted,
		cartAddCount: ctx.cartAddCount,
		cartRemovalCount: ctx.cartRemovalCount,
		productViewCount: ctx.productViewCount,
		categoryViewCount: ctx.categoryViewCount,
		refineMessageCount: ctx.refineMessageCount,
		backNavCount: ctx.backNavigationCount,
		maxScrollDepth: ctx.maxScrollDepth,
		avgDwellMs: ctx.avgDwellTimeMs,
		visitCount: ctx.visitCount,
		currentCategory: ctx.currentCategory || null,
		ruleMatches,
		labelSource,
		labelPersona,
		synthetic: Boolean(store.getCrossSessionContext().scenarioId),
		scenarioId: store.getCrossSessionContext().scenarioId ?? null,
	};

	await recordOutcome(outcome);
}

/** Upsert one outcome row. */
export async function recordOutcome(outcome: SessionOutcome): Promise<void> {
	const sql = getDb();
	const brandId = getBrand().id;
	await sql`
		INSERT INTO session_outcomes (
			brand_id, session_id, ended_at, duration_ms,
			primary_final, probabilities_final, entropy_final, certainty_final, prior_at_start,
			converted, cart_add_count, cart_removal_count, product_view_count,
			category_view_count, refine_message_count, back_nav_count,
			max_scroll_depth, avg_dwell_ms,
			visit_count, current_category, rule_matches,
			label_source, label_persona, synthetic, scenario_id
		) VALUES (
			${brandId}, ${outcome.sessionId}, ${outcome.endedAt.toISOString()}, ${outcome.durationMs},
			${outcome.primaryFinal}, ${sql.json(probabilitiesJson(outcome.probabilitiesFinal))},
			${outcome.entropyFinal}, ${outcome.certaintyFinal},
			${sql.json(probabilitiesJson(outcome.priorAtStart))},
			${outcome.converted}, ${outcome.cartAddCount}, ${outcome.cartRemovalCount},
			${outcome.productViewCount}, ${outcome.categoryViewCount},
			${outcome.refineMessageCount}, ${outcome.backNavCount},
			${outcome.maxScrollDepth}, ${outcome.avgDwellMs},
			${outcome.visitCount}, ${outcome.currentCategory}, ${outcome.ruleMatches},
			${outcome.labelSource}, ${outcome.labelPersona}, ${outcome.synthetic}, ${outcome.scenarioId}
		)
		ON CONFLICT (brand_id, session_id) DO UPDATE SET
			ended_at = EXCLUDED.ended_at,
			duration_ms = EXCLUDED.duration_ms,
			primary_final = EXCLUDED.primary_final,
			probabilities_final = EXCLUDED.probabilities_final,
			entropy_final = EXCLUDED.entropy_final,
			certainty_final = EXCLUDED.certainty_final,
			converted = session_outcomes.converted OR EXCLUDED.converted,
			cart_add_count = EXCLUDED.cart_add_count,
			cart_removal_count = EXCLUDED.cart_removal_count,
			product_view_count = EXCLUDED.product_view_count,
			category_view_count = EXCLUDED.category_view_count,
			refine_message_count = EXCLUDED.refine_message_count,
			back_nav_count = EXCLUDED.back_nav_count,
			max_scroll_depth = EXCLUDED.max_scroll_depth,
			avg_dwell_ms = EXCLUDED.avg_dwell_ms,
			rule_matches = EXCLUDED.rule_matches,
			label_source = EXCLUDED.label_source,
			label_persona = EXCLUDED.label_persona
			, synthetic = EXCLUDED.synthetic, scenario_id = EXCLUDED.scenario_id
	`;
}

/** Read a batch of outcomes for calibration / fitting scripts. */
export async function readOutcomesBatch(opts: {
	limit?: number;
	labeledOnly?: boolean;
	since?: Date;
} = {}): Promise<SessionOutcome[]> {
	const sql = getDb();
	const brandId = getBrand().id;
	const limit = opts.limit ?? 10000;

	const rows = opts.labeledOnly
		? await sql`
			SELECT * FROM session_outcomes
			WHERE brand_id = ${brandId} AND synthetic = FALSE AND label_source <> 'unknown'
			${opts.since ? sql`AND ended_at >= ${opts.since.toISOString()}` : sql``}
			ORDER BY ended_at DESC
			LIMIT ${limit}
		`
		: await sql`
			SELECT * FROM session_outcomes
			WHERE brand_id = ${brandId} AND synthetic = FALSE
			${opts.since ? sql`AND ended_at >= ${opts.since.toISOString()}` : sql``}
			ORDER BY ended_at DESC
			LIMIT ${limit}
		`;

	return rows.map(rowToOutcome);
}

function rowToOutcome(r: Record<string, unknown>): SessionOutcome {
	return {
		sessionId: r.session_id as string,
		endedAt: new Date(r.ended_at as string),
		durationMs: Number(r.duration_ms),
		primaryFinal: r.primary_final as Persona,
		probabilitiesFinal: r.probabilities_final as PersonaProbabilities,
		entropyFinal: Number(r.entropy_final),
		certaintyFinal: Number(r.certainty_final),
		priorAtStart: r.prior_at_start as PersonaProbabilities,
		converted: Boolean(r.converted),
		cartAddCount: Number(r.cart_add_count),
		cartRemovalCount: Number(r.cart_removal_count),
		productViewCount: Number(r.product_view_count),
		categoryViewCount: Number(r.category_view_count),
		refineMessageCount: Number(r.refine_message_count),
		backNavCount: Number(r.back_nav_count),
		maxScrollDepth: Number(r.max_scroll_depth),
		avgDwellMs: Number(r.avg_dwell_ms),
		visitCount: Number(r.visit_count),
		currentCategory: (r.current_category as string | null) ?? null,
		ruleMatches: (r.rule_matches as string[]) ?? [],
		labelSource: r.label_source as SessionOutcome['labelSource'],
		labelPersona: (r.label_persona as Persona | null) ?? null,
		synthetic: Boolean(r.synthetic),
		scenarioId: (r.scenario_id as string | null) ?? null,
	};
}

/** Count outcomes by label source — used by the observability endpoint. */
export async function outcomesSummary(): Promise<{
	total: number;
	byLabel: Record<string, number>;
	byPrimary: Record<string, number>;
}> {
	const sql = getDb();
	const brandId = getBrand().id;
	const totalRows = await sql`SELECT COUNT(*)::int AS n FROM session_outcomes WHERE brand_id = ${brandId} AND synthetic = FALSE`;
	const labelRows = await sql`SELECT label_source, COUNT(*)::int AS n FROM session_outcomes WHERE brand_id = ${brandId} AND synthetic = FALSE GROUP BY label_source`;
	const primaryRows = await sql`SELECT primary_final, COUNT(*)::int AS n FROM session_outcomes WHERE brand_id = ${brandId} AND synthetic = FALSE GROUP BY primary_final`;

	const byLabel: Record<string, number> = {};
	for (const row of labelRows) byLabel[row.label_source as string] = Number(row.n);
	const byPrimary: Record<string, number> = {};
	for (const row of primaryRows) byPrimary[row.primary_final as string] = Number(row.n);

	return {
		total: Number(totalRows[0]?.n ?? 0),
		byLabel,
		byPrimary,
	};
}
