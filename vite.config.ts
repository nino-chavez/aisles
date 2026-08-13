import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { configDefaults, defineConfig } from 'vitest/config';

const SCRIPT_STYLE_TESTS = [
	'src/lib/signals/inference.test.ts',
	'src/lib/signals/store.test.ts',
	'src/lib/server/layout-prompt.test.ts',
	'src/lib/server/incentives/stub.test.ts',
	'src/lib/server/incentives/voucherify.test.ts',
] as const;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		// These executable assertion scripts retain their documented `tsx`
		// entrypoints; they are not empty Vitest suites.
		exclude: [...configDefaults.exclude, ...SCRIPT_STYLE_TESTS],
	},
});
