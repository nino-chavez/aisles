/**
 * Fit empirical likelihood ratios from session_outcomes.
 *
 * Usage:
 *   npx tsx scripts/fit-inference-lrs.ts
 *
 * Environment:
 *   DATABASE_URL  — Neon connection string (read from .env via dotenv)
 *
 * Reads labeled outcomes from session_outcomes (where label_source != 'unknown'),
 * computes per-rule log-likelihood-ratios for each persona, and writes
 * src/lib/signals/learned-weights.json. inference.ts reads this file on module
 * load and uses the learned magnitudes in place of the hand-tuned ones, when
 * a rule has enough samples (>= MIN_SAMPLES) to trust.
 *
 * Math: for each (rule R, persona P) pair:
 *   P(R fires | P)  = (count(R fires AND label=P) + 1) / (count(label=P) + 2)
 *   P(R fires | ¬P) = (count(R fires AND label≠P) + 1) / (count(label≠P) + 2)
 *   logLR[R, P]     = log(P(R|P)) - log(P(R|¬P))
 *
 * Laplace smoothing (+1 / +2) avoids log(0) on sparse rules.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PERSONAS = ['gatherer', 'hunter', 'researcher', 'gifter'] as const;
type Persona = (typeof PERSONAS)[number];

const MIN_SAMPLES = 10;

interface LabeledRow {
	rule_matches: string[];
	label_persona: Persona;
}

interface LearnedWeights {
	fittedAt: string;
	totalSessions: number;
	minSamples: number;
	perPersonaSampleCount: Record<Persona, number>;
	rules: Record<
		string,
		{
			fires: number;
			logLR: Record<Persona, number>;
		}
	>;
}

async function main() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		console.error('DATABASE_URL not set. Add it to .env and retry.');
		process.exit(1);
	}

	const sql = neon(dbUrl);
	const rows = (await sql`
		SELECT rule_matches, label_persona
		FROM session_outcomes
		WHERE label_source <> 'unknown' AND label_persona IS NOT NULL
	`) as unknown as LabeledRow[];

	console.log(`Loaded ${rows.length} labeled outcomes.`);
	if (rows.length === 0) {
		console.warn('No labeled outcomes yet — nothing to fit. Run the site and collect data first.');
		process.exit(0);
	}

	// Count total sessions per persona
	const perPersonaTotal: Record<Persona, number> = { gatherer: 0, hunter: 0, researcher: 0, gifter: 0 };
	for (const row of rows) {
		perPersonaTotal[row.label_persona]++;
	}

	// For each rule: count fires per persona
	const ruleFires: Record<string, Record<Persona, number>> = {};
	const ruleTotalFires: Record<string, number> = {};
	for (const row of rows) {
		for (const rule of row.rule_matches) {
			if (!ruleFires[rule]) {
				ruleFires[rule] = { gatherer: 0, hunter: 0, researcher: 0, gifter: 0 };
				ruleTotalFires[rule] = 0;
			}
			ruleFires[rule][row.label_persona]++;
			ruleTotalFires[rule]++;
		}
	}

	// Compute log-LRs with Laplace smoothing
	const output: LearnedWeights = {
		fittedAt: new Date().toISOString(),
		totalSessions: rows.length,
		minSamples: MIN_SAMPLES,
		perPersonaSampleCount: perPersonaTotal,
		rules: {},
	};

	for (const [ruleName, fires] of Object.entries(ruleFires)) {
		if (ruleTotalFires[ruleName] < MIN_SAMPLES) {
			console.log(`  skip ${ruleName} — only ${ruleTotalFires[ruleName]} fires (min ${MIN_SAMPLES})`);
			continue;
		}

		const logLR: Record<Persona, number> = { gatherer: 0, hunter: 0, researcher: 0, gifter: 0 };

		for (const persona of PERSONAS) {
			const firesInP = fires[persona];
			const totalInP = perPersonaTotal[persona];
			const firesNotP = ruleTotalFires[ruleName] - firesInP;
			const totalNotP = rows.length - totalInP;

			// Laplace smoothing: +1 to fires, +2 to denominator
			const pGivenP = (firesInP + 1) / (totalInP + 2);
			const pGivenNotP = (firesNotP + 1) / (totalNotP + 2);
			logLR[persona] = Math.log(pGivenP) - Math.log(pGivenNotP);
		}

		output.rules[ruleName] = {
			fires: ruleTotalFires[ruleName],
			logLR,
		};
	}

	// Write JSON output
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const outPath = resolve(__dirname, '..', 'src/lib/signals/learned-weights.json');
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, JSON.stringify(output, null, 2));

	console.log(`\nFit complete — wrote ${Object.keys(output.rules).length} rules to ${outPath}`);
	console.log(`Per-persona sample counts:`, perPersonaTotal);
}

main().catch((err) => {
	console.error('fit-inference-lrs failed:', err);
	process.exit(1);
});
