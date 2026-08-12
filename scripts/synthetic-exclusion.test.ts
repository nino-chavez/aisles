import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('learning jobs exclude synthetic outcomes', () => {
	for (const file of ['fit-inference-lrs.ts', 'calibration-check.ts']) {
		it(`${file} filters synthetic rows in SQL`, () => {
			const source = readFileSync(resolve(import.meta.dirname, file), 'utf8');
			expect(source).toContain('synthetic = FALSE');
		});
	}
});
