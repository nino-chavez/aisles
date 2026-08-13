/** Optional local verifier for the checked-in Bealls zone snapshot. */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BEALLS_ZONE_SNAPSHOT } from './zone-coverage-snapshot';

export interface ExternalZoneDefinition {
	surface: string;
	multiplicity: string;
	maxIndex?: number;
	maxItems?: number;
	engineComposable: boolean;
	adminAuthorable: boolean;
}
export type ExternalZoneRegistry = Readonly<Record<string, ExternalZoneDefinition>>;

export function findBeallsCheckout(
	startDirectory: string,
	pathExists: (path: string) => boolean = existsSync,
): string | null {
	let current = resolve(startDirectory);
	while (true) {
		const candidate = join(current, BEALLS_ZONE_SNAPSHOT.source.repository);
		if (pathExists(join(candidate, 'src/lib/foundation/zones.ts'))) return candidate;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

export function verifyZoneRegistry(actual: ExternalZoneRegistry): string[] {
	const issues: string[] = [];
	const expectedOrder = BEALLS_ZONE_SNAPSHOT.zones.map(({ zoneId }) => zoneId);
	const actualOrder = Object.keys(actual);
	if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
		issues.push(`zone order/membership changed: expected ${expectedOrder.join(',')} but received ${actualOrder.join(',')}`);
	}
	for (const expected of BEALLS_ZONE_SNAPSHOT.zones) {
		const candidate = actual[expected.zoneId];
		if (!candidate) continue;
		const expectedMetadata = {
			surface: expected.surface,
			multiplicity: expected.multiplicity,
			...(expected.maxIndex === undefined ? {} : { maxIndex: expected.maxIndex }),
			...(expected.maxItems === undefined ? {} : { maxItems: expected.maxItems }),
			engineComposable: expected.engineComposable,
			adminAuthorable: expected.adminAuthorable,
		};
		if (JSON.stringify(candidate) !== JSON.stringify(expectedMetadata)) {
			issues.push(`zone metadata changed for ${expected.zoneId}`);
		}
	}
	return issues;
}

export function verifySnapshotFileDigests(
	checkout: string,
	readFile: (path: string) => Buffer = (path) => readFileSync(path),
): string[] {
	const issues: string[] = [];
	for (const file of BEALLS_ZONE_SNAPSHOT.source.files) {
		const path = join(checkout, file.path);
		let bytes: Buffer;
		try {
			bytes = readFile(path);
		} catch {
			issues.push(`snapshot source missing: ${file.path}`);
			continue;
		}
		const digest = createHash('sha256').update(bytes).digest('hex');
		if (digest !== file.sha256) issues.push(`snapshot digest changed: ${file.path}`);
	}
	return issues;
}

export async function verifyLocalBeallsSnapshot(checkout: string): Promise<string[]> {
	const issues = verifySnapshotFileDigests(checkout);
	if (basename(checkout) !== BEALLS_ZONE_SNAPSHOT.source.repository) {
		issues.push(`unexpected repository directory: ${basename(checkout)}`);
	}
	try {
		const ref = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
		if (ref !== BEALLS_ZONE_SNAPSHOT.source.ref) issues.push(`source ref changed: ${ref}`);
	} catch {
		issues.push('unable to read source ref');
	}
	try {
		const moduleUrl = `${pathToFileURL(join(checkout, 'src/lib/foundation/zones.ts')).href}?zone-snapshot=${Date.now()}`;
		const sourceModule = await import(moduleUrl) as { ZONES?: ExternalZoneRegistry };
		if (!sourceModule.ZONES) issues.push('source module does not export ZONES');
		else issues.push(...verifyZoneRegistry(sourceModule.ZONES));
	} catch {
		issues.push('unable to import source ZONES module');
	}
	return issues;
}
