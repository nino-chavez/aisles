import { createHash } from 'node:crypto';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';

/** Stable digest input for the safe eight-bundle copy, independent of object key order. */
export function hashKibblePdpBundleProjection(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(toCanonicalJson(value))).digest('hex');
}

/** Fails server initialization if the copied projection drifts from its contract pin. */
export function assertKibblePdpBundleProjection(value: unknown): string {
	if (!isRecord(value) || Object.keys(value).length !== KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection.bundleCount) {
		throw new Error(`Kibble PDP bundle projection must contain exactly ${KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection.bundleCount} bundles.`);
	}
	const digest = hashKibblePdpBundleProjection(value);
	const expected = KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection.sha256;
	if (digest !== expected) {
		throw new Error(`Kibble PDP bundle projection SHA mismatch: expected ${expected}, received ${digest}.`);
	}
	return digest;
}

export const KIBBLE_PDP_BUNDLE_PROJECTION_VERIFIED_SHA256 = assertKibblePdpBundleProjection(
	KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles,
);

function toCanonicalJson(value: unknown): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return value.map(toCanonicalJson);
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, toCanonicalJson(value[key])]),
		);
	}
	throw new Error('Kibble PDP bundle projection contains a non-JSON value.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
