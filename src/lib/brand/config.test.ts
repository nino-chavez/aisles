import { describe, expect, it } from 'vitest';
import { BRAND_IDS, getBrandById } from './config';

describe('brand organization identity', () => {
	it('assigns a distinct trusted organization to every standalone demo brand', () => {
		const organizations = BRAND_IDS.map((id) => getBrandById(id)?.organizationId);
		expect(organizations.every(Boolean)).toBe(true);
		expect(new Set(organizations).size).toBe(BRAND_IDS.length);
	});

	it('rejects inherited object keys during explicit brand lookup', () => {
		expect(getBrandById('__proto__')).toBeUndefined();
		expect(getBrandById('toString')).toBeUndefined();
	});
});
