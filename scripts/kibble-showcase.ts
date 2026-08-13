import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveLocalParityPaths, findWorkspaceRoot, verifyPinnedFixture } from './kibble-parity-local';
import { KIBBLE_SHOWCASE_DATA_SOURCE } from './fixtures/kibble-showcase-enrichment';

export const KIBBLE_SHOWCASE_DEFAULT_PORT = 5174;
export const KIBBLE_SHOWCASE_LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
export const KIBBLE_SHOWCASE_SCENARIO_ID = 'kibble-local-showcase';

export function readShowcasePort(value: string | undefined): number {
	if (value === undefined || value.trim() === '') return KIBBLE_SHOWCASE_DEFAULT_PORT;
	if (!/^\d+$/.test(value)) throw new Error('KIBBLE_SHOWCASE_PORT must be a whole-number local port.');
	const port = Number(value);
	if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
		throw new Error('KIBBLE_SHOWCASE_PORT must be a non-privileged port from 1024 through 65535.');
	}
	return port;
}

export function readShowcaseHost(value: string | undefined): string {
	const host = value?.trim() || '127.0.0.1';
	if (!KIBBLE_SHOWCASE_LOCAL_HOSTS.has(host)) {
		throw new Error('KIBBLE_SHOWCASE_HOST must be localhost, 127.0.0.1, or ::1.');
	}
	return host;
}

export function showcaseUrl(host: string, port: number, persona: string): string {
	const formattedHost = host.includes(':') ? `[${host}]` : host;
	return `http://${formattedHost}:${port}/?dev=true&intent=${persona}`;
}

export function showcaseRootUrl(host: string, port: number): string {
	const formattedHost = host.includes(':') ? `[${host}]` : host;
	return `http://${formattedHost}:${port}/`;
}

export function isExpectedShowcaseExit(code: number | null, signal: NodeJS.Signals | null): boolean {
	return code === 0 || code === 130 || code === 143 || signal === 'SIGINT' || signal === 'SIGTERM';
}

export function buildShowcaseChildEnvironment(
	base: NodeJS.ProcessEnv,
	fixturePath: string,
	interceptor: string,
): NodeJS.ProcessEnv {
	return {
		...base,
		// Blank every production data/model credential consumed by this app.
		// Existing process variables win over Vite env files, so the showcase
		// cannot reconnect merely because the operator has a configured shell.
		ANTHROPIC_API_KEY: '',
		OPENAI_API_KEY: '',
		OPENROUTER_API_KEY: '',
		CF_AI_GATEWAY_URL: '',
		DATABASE_URL: '',
		RUNTIME_DATABASE_URL: '',
		KV_REST_API_URL: '',
		KV_REST_API_TOKEN: '',
		VOUCHERIFY_API_URL: '',
		VOUCHERIFY_APP_ID: '',
		VOUCHERIFY_SECRET_KEY: '',
		OBSERVE_ACCESS_TOKEN: '',
		BIGCOMMERCE_CLIENT_ID: '',
		BIGCOMMERCE_CLIENT_SECRET: '',
		BIGCOMMERCE_ACCESS_TOKEN: '',
		BIGCOMMERCE_CHANNEL_ID: '',
		VITE_BC_STORE_HASH: '',
		BRAND_ID: 'kibble',
		VITE_BRAND_ID: 'kibble',
		KIBBLE_PARITY_FIXTURE_PATH: fixturePath,
		KIBBLE_SHOWCASE_DATA_SOURCE,
		KIBBLE_SHOWCASE_SCENARIO_ID,
		CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: 'postgres://kibble-showcase:fixture@127.0.0.1:5432/kibble-showcase',
		BIGCOMMERCE_STORE_HASH: 'kibble-showcase-fixture',
		BIGCOMMERCE_STOREFRONT_TOKEN: 'kibble-showcase-fixture',
		NODE_OPTIONS: [base.NODE_OPTIONS, `--require=${interceptor}`].filter(Boolean).join(' '),
	};
}

function forwardTermination(child: ChildProcess): void {
	let stopping = false;
	const stop = (signal: NodeJS.Signals) => {
		if (stopping) return;
		stopping = true;
		if (child.exitCode === null && !child.killed) child.kill(signal);
	};
	process.once('SIGINT', () => stop('SIGINT'));
	process.once('SIGTERM', () => stop('SIGTERM'));
}

async function main(): Promise<void> {
	const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), encoding: 'utf8' }).trim();
	const workspaceRoot = findWorkspaceRoot(repositoryRoot);
	const { referenceRoot, fixturePath } = deriveLocalParityPaths(workspaceRoot);
	const port = readShowcasePort(process.env.KIBBLE_SHOWCASE_PORT);
	const host = readShowcaseHost(process.env.KIBBLE_SHOWCASE_HOST);
	const interceptor = resolve(repositoryRoot, 'scripts/fixtures/kibble-parity-fetch-interceptor.cjs');

	await Promise.all([access(fixturePath), access(referenceRoot), access(interceptor)]);
	verifyPinnedFixture(fixturePath, referenceRoot);

	const rootUrl = showcaseRootUrl(host, port);
	const urls = ['gatherer', 'hunter', 'researcher', 'gifter'].map((persona) => showcaseUrl(host, port, persona));
	console.log(`Kibble local showcase\nData source: ${KIBBLE_SHOWCASE_DATA_SOURCE}\nPinned catalog: ${fixturePath}\n`);
	console.log(rootUrl);
	console.log('Use “Show decision inspector” on the storefront. Optional starting-state shortcuts:');
	for (const url of urls) console.log(url);
	console.log('\nStop with Ctrl-C.');

	const child = spawn('npx', [
		'vite', '--config', 'scripts/kibble-showcase-vite.config.ts', '--host', host, '--port', String(port), '--strictPort',
	], {
		cwd: repositoryRoot,
		stdio: 'inherit',
		env: buildShowcaseChildEnvironment(process.env, fixturePath, interceptor),
	});

	forwardTermination(child);
	await new Promise<void>((resolveExit, reject) => {
		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (isExpectedShowcaseExit(code, signal)) resolveExit();
			else reject(new Error(`Kibble showcase Vite process exited ${code ?? `from ${signal ?? 'an unknown signal'}`}.`));
		});
	});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
