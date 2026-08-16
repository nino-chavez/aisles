/**
 * Live smoke test — hits the real Voucherify sandbox through the evaluator.
 * Run: npx tsx -r dotenv/config src/lib/server/incentives/smoke.ts dotenv_config_path=.env.local
 *
 * Not run in CI; used to sanity-check the adapter against a live sandbox
 * after credential or schema changes.
 */

import { defaultEvaluator } from './index';
import { getBrandById } from '../../brand/config';

const brand = getBrandById('kibble')!;

async function main() {
	console.log('Voucherify live smoke test');
	console.log('  VOUCHERIFY_APP_ID:', process.env.VOUCHERIFY_APP_ID ? '✓ set' : '✘ missing');
	console.log('  VOUCHERIFY_API_URL:', process.env.VOUCHERIFY_API_URL ?? '(default)');

	const payload = await defaultEvaluator.evaluate({
		brand: brand,
		lineItems: [],
		subtotalMinor: 5500,
		appliedCodes: ['BLCKFRDY'],
		membership: null,
	});

	console.log('\nEvaluator output:');
	console.log(JSON.stringify(payload, null, 2));

	const blackFriday = payload.promotions.discounts?.find((d) => d.code === 'BLCKFRDY');
	if (blackFriday?.amount === 1000) {
		console.log('\n✓ Live Voucherify call succeeded — $10 discount applied');
	} else {
		console.log('\n✘ Unexpected payload — check Voucherify sandbox or credentials');
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
