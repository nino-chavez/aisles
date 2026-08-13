import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { KIBBLE_SHOWCASE_DATA_SOURCE } from './fixtures/kibble-showcase-enrichment';

const gitCommonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
const repositoryRoot = dirname(resolve(process.cwd(), gitCommonDir));
const installedDependencies = realpathSync(resolve(repositoryRoot, 'node_modules'));
const productionEnrichmentQuery = resolve(process.cwd(), 'src/lib/server/enrichment/query.ts');
const syntheticEnrichmentProvider = fileURLToPath(new URL('./fixtures/kibble-showcase-enrichment.ts', import.meta.url));

const showcaseEnrichmentAlias = {
	name: 'kibble-showcase-exact-enrichment-query-alias',
	enforce: 'pre' as const,
	resolveId(source: string, importer: string | undefined) {
		if (!importer || !source.startsWith('.')) return null;
		const resolved = resolve(dirname(importer), source);
		return resolved === productionEnrichmentQuery || `${resolved}.ts` === productionEnrichmentQuery
			? syntheticEnrichmentProvider
			: null;
	},
};

const showcaseMetadataHeaders = {
	name: 'kibble-showcase-synthetic-enrichment-metadata',
	configureServer(server: { middlewares: { use: (handler: (request: unknown, response: { setHeader: (name: string, value: string) => void }, next: () => void) => void) => void } }) {
		server.middlewares.use((_request, response, next) => {
			// HTTP header values are ASCII. Decode this value to recover the exact
			// visible source label printed by the launcher.
			response.setHeader('x-kibble-showcase-enrichment-source', encodeURIComponent(KIBBLE_SHOWCASE_DATA_SOURCE));
			next();
		});
	},
};

/**
 * Local showcase only. Normal dev/build/preview/Wrangler use vite.config.ts,
 * which never imports these runner fixtures.
 */
export default defineConfig({
	plugins: [showcaseMetadataHeaders, showcaseEnrichmentAlias, tailwindcss(), sveltekit()],
	resolve: {
		alias: [
			{
				find: 'postgres',
				replacement: fileURLToPath(new URL('./fixtures/kibble-parity-noop-postgres.ts', import.meta.url)),
			},
		],
	},
	server: {
		fs: {
			allow: [searchForWorkspaceRoot(process.cwd()), process.cwd(), installedDependencies],
		},
	},
});
