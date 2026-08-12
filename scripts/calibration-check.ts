/**
 * Calibration check against session_outcomes.
 *
 * Usage:
 *   npx tsx scripts/calibration-check.ts
 *
 * Takes every labeled outcome and checks whether predicted persona probabilities
 * match observed outcomes. Outputs a reliability diagram, Brier score, and
 * expected calibration error (ECE).
 *
 * A perfectly calibrated model: when it says "hunter with probability 0.7",
 * the shopper is actually hunter-shaped 70% of the time.
 *
 * Limitation: we only have a label for high-confidence sessions. Unlabeled
 * sessions can't participate — calibration here is measured on the labelable
 * subset, which is itself a biased sample. Read the output with that caveat.
 */

import 'dotenv/config';
import postgres from 'postgres';
import { getBrand } from '../src/lib/brand/config';

const PERSONAS = ['gatherer', 'hunter', 'researcher', 'gifter'] as const;
type Persona = (typeof PERSONAS)[number];

const NUM_BINS = 10;

interface LabeledRow {
	probabilities_final: Record<Persona, number>;
	label_persona: Persona;
	label_source: string;
	converted: boolean;
}

async function main() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		console.error('DATABASE_URL not set.');
		process.exit(1);
	}

	const sql = postgres(dbUrl, { max: 5, idle_timeout: 60 });
	const brandId = getBrand().id;
	const rows = (await sql`
		SELECT probabilities_final, label_persona, label_source, converted
		FROM session_outcomes
		WHERE brand_id = ${brandId} AND synthetic = FALSE AND label_source <> 'unknown' AND label_persona IS NOT NULL
	`) as unknown as LabeledRow[];

	if (rows.length === 0) {
		console.warn('No labeled outcomes yet — nothing to check.');
		process.exit(0);
	}

	console.log(`\nCalibration check — ${rows.length} labeled outcomes\n`);

	// For each persona, bin predictions and compute actual hit rate per bin
	for (const persona of PERSONAS) {
		const bins: { count: number; sumPredicted: number; hits: number }[] = Array.from(
			{ length: NUM_BINS },
			() => ({ count: 0, sumPredicted: 0, hits: 0 }),
		);

		for (const row of rows) {
			const predicted = row.probabilities_final[persona] ?? 0;
			const actual = row.label_persona === persona ? 1 : 0;
			const binIdx = Math.min(NUM_BINS - 1, Math.floor(predicted * NUM_BINS));
			bins[binIdx].count++;
			bins[binIdx].sumPredicted += predicted;
			bins[binIdx].hits += actual;
		}

		// Brier and ECE
		let brier = 0;
		let ece = 0;
		const total = rows.length;

		for (const row of rows) {
			const predicted = row.probabilities_final[persona] ?? 0;
			const actual = row.label_persona === persona ? 1 : 0;
			brier += (predicted - actual) ** 2;
		}
		brier /= total;

		for (const bin of bins) {
			if (bin.count === 0) continue;
			const meanPredicted = bin.sumPredicted / bin.count;
			const meanActual = bin.hits / bin.count;
			ece += (bin.count / total) * Math.abs(meanPredicted - meanActual);
		}

		console.log(`─── ${persona} ─────────────────────────────`);
		console.log(`  Brier score:  ${brier.toFixed(4)}  (lower is better, 0 = perfect)`);
		console.log(`  ECE:          ${ece.toFixed(4)}  (lower is better)`);
		console.log(`  Reliability:`);
		for (let i = 0; i < NUM_BINS; i++) {
			const bin = bins[i];
			const lo = (i / NUM_BINS).toFixed(1);
			const hi = ((i + 1) / NUM_BINS).toFixed(1);
			if (bin.count === 0) {
				console.log(`    [${lo}–${hi})  empty`);
				continue;
			}
			const meanPredicted = bin.sumPredicted / bin.count;
			const meanActual = bin.hits / bin.count;
			const bar = '█'.repeat(Math.round(meanActual * 20));
			const gap = meanActual - meanPredicted;
			const marker = gap > 0.1 ? ' ↑over' : gap < -0.1 ? ' ↓under' : '';
			console.log(
				`    [${lo}–${hi})  n=${String(bin.count).padStart(4)}  pred=${meanPredicted.toFixed(2)}  actual=${meanActual.toFixed(2)}  ${bar}${marker}`,
			);
		}
		console.log();
	}

	// Overall conversion rate by predicted primary
	console.log('─── Conversion rate by predicted primary ───');
	const byPrimary: Record<Persona, { total: number; converted: number }> = {
		gatherer: { total: 0, converted: 0 },
		hunter: { total: 0, converted: 0 },
		researcher: { total: 0, converted: 0 },
		gifter: { total: 0, converted: 0 },
	};
	for (const row of rows) {
		// Derive primary from probabilities
		let primary: Persona = 'gatherer';
		let max = -Infinity;
		for (const p of PERSONAS) {
			if (row.probabilities_final[p] > max) {
				max = row.probabilities_final[p];
				primary = p;
			}
		}
		byPrimary[primary].total++;
		if (row.converted) byPrimary[primary].converted++;
	}
	for (const persona of PERSONAS) {
		const b = byPrimary[persona];
		const rate = b.total > 0 ? b.converted / b.total : 0;
		console.log(`  ${persona.padEnd(10)} n=${String(b.total).padStart(4)}  conv=${(rate * 100).toFixed(1)}%`);
	}
	console.log();
}

main().catch((err) => {
	console.error('calibration-check failed:', err);
	process.exit(1);
});
