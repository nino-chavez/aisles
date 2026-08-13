import { findBeallsCheckout, verifyLocalBeallsSnapshot } from '../src/lib/foundation/zone-coverage-refresh';

const checkout = findBeallsCheckout(process.cwd());
if (!checkout) {
	console.error('Bealls Aisles checkout not found. Run from the Aisles main checkout or a linked worktree.');
	process.exitCode = 1;
} else {
	const issues = await verifyLocalBeallsSnapshot(checkout);
	if (issues.length > 0) {
		console.error(issues.join('\n'));
		process.exitCode = 1;
	} else {
		console.log('Bealls zone snapshot matches the pinned source ref, module registry, and file digests.');
	}
}

