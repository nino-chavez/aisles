import { describe, expect, it } from 'vitest';
import { findBeallsCheckout, verifySnapshotFileDigests, verifyZoneRegistry } from './zone-coverage-refresh';
import { BEALLS_ZONE_SNAPSHOT } from './zone-coverage-snapshot';

function snapshotRegistry() {
	return Object.fromEntries(BEALLS_ZONE_SNAPSHOT.zones.map((zone) => [zone.zoneId, {
		surface: zone.surface,
		multiplicity: zone.multiplicity,
		...(zone.maxIndex === undefined ? {} : { maxIndex: zone.maxIndex }),
		...(zone.maxItems === undefined ? {} : { maxItems: zone.maxItems }),
		engineComposable: zone.engineComposable,
		adminAuthorable: zone.adminAuthorable,
	}]));
}

describe('optional zone snapshot refresh verifier', () => {
	it('fails for a reordered zone registry instead of silently sorting entries', () => {
		const entries = Object.entries(snapshotRegistry());
		const reordered = Object.fromEntries([entries[1], entries[0], ...entries.slice(2)]);
		expect(verifyZoneRegistry(reordered)).toEqual([expect.stringContaining('zone order/membership changed')]);
	});

	it('fails when metadata properties are reordered instead of regex-skipping the zone', () => {
		const current = snapshotRegistry();
		const hero = current['home.hero'];
		current['home.hero'] = {
			multiplicity: hero.multiplicity,
			surface: hero.surface,
			engineComposable: hero.engineComposable,
			adminAuthorable: hero.adminAuthorable,
		};
		expect(verifyZoneRegistry(current)).toContain('zone metadata changed for home.hero');
	});

	it('fails for a new zone independent of any hard-coded count', () => {
		const changed = { ...snapshotRegistry(), 'home.new-zone': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: false } };
		expect(verifyZoneRegistry(changed)).toEqual([expect.stringContaining('zone order/membership changed')]);
	});

	it('fails when source property reordering changes the pinned digest', () => {
		const issues = verifySnapshotFileDigests('/snapshot', () => Buffer.from('property order changed'));
		expect(issues).toHaveLength(BEALLS_ZONE_SNAPSHOT.source.files.length);
		expect(issues.every((issue) => issue.startsWith('snapshot digest changed:'))).toBe(true);
	});

	it('finds the sibling from both main-checkout and linked-worktree shapes', () => {
		const sourceFile = '/workspace/apps/aisles/bealls-aisles/src/lib/foundation/zones.ts';
		const exists = (path: string) => path === sourceFile;
		expect(findBeallsCheckout('/workspace/apps/aisles/aisles', exists)).toBe('/workspace/apps/aisles/bealls-aisles');
		expect(findBeallsCheckout('/workspace/apps/aisles/aisles/.worktrees/branch', exists)).toBe('/workspace/apps/aisles/bealls-aisles');
	});
});
