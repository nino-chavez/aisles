import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

const gitCommonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
const repositoryRoot = dirname(resolve(process.cwd(), gitCommonDir));
const installedDependencies = realpathSync(resolve(repositoryRoot, 'node_modules'));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			postgres: fileURLToPath(
				new URL('./fixtures/kibble-parity-noop-postgres.ts', import.meta.url),
			),
		},
	},
	server: {
		fs: {
			allow: [searchForWorkspaceRoot(process.cwd()), process.cwd(), installedDependencies],
		},
	},
});
