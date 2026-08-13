import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { KIBBLE_REFERENCE_CONTRACT } from '../src/lib/brand/reference/kibble';

export const KIBBLE_PARITY_CONTRACT_ID = KIBBLE_REFERENCE_CONTRACT.id;
export const KIBBLE_PARITY_CONTRACT_VERSION = KIBBLE_REFERENCE_CONTRACT.version;
export const KIBBLE_PARITY_FIXED_DATA_IDENTITY = KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256;
export const KIBBLE_PARITY_PDP_SOURCE_FILES = KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.files;
export const KIBBLE_PARITY_DEFAULT_TOLERANCES = {
	header: 0, nav: 0, main: 0, footer: 0, h1: 0, h2: 0, h3: 0,
	section: 0, image: 0, link: 0, button: 0, pageHeight: 0,
};

export type LocalParityRoute = { id: string; path: string };

export function deriveLocalParityPaths(workspaceRoot: string): { referenceRoot: string; fixturePath: string } {
	return {
		referenceRoot: resolve(workspaceRoot, 'labs/bc-subscriptions/apps/storefront-svelte'),
		fixturePath: resolve(workspaceRoot, 'labs/bc-subscriptions/scripts/kibble-demo/data/seed-output.json'),
	};
}

export function findWorkspaceRoot(repositoryRoot: string): string {
	let current = resolve(repositoryRoot);
	while (dirname(current) !== current) {
		if (current.endsWith('/apps')) return dirname(current);
		current = dirname(current);
	}
	throw new Error(`Cannot derive the workspace root from ${repositoryRoot}; set KIBBLE_PARITY_REFERENCE_ROOT and KIBBLE_PARITY_FIXTURE_PATH explicitly.`);
}

export function readLocalParityRoutes(value: string | undefined): LocalParityRoute[] {
	if (!value) return [{ id: 'home', path: '/' }];
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error('KIBBLE_PARITY_LOCAL_ROUTES must be a JSON array of { id, path } routes.');
	}
	if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('KIBBLE_PARITY_LOCAL_ROUTES must contain at least one route.');
	const ids = new Set<string>();
	return parsed.map((route, index) => {
		if (!route || typeof route !== 'object') throw new Error(`KIBBLE_PARITY_LOCAL_ROUTES[${index}] must be an object.`);
		const candidate = route as Record<string, unknown>;
		if (typeof candidate.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(candidate.id) || ids.has(candidate.id)) {
			throw new Error(`KIBBLE_PARITY_LOCAL_ROUTES[${index}].id must be a unique filesystem-safe value.`);
		}
		if (typeof candidate.path !== 'string' || !candidate.path.startsWith('/') || candidate.path.startsWith('//')) {
			throw new Error(`KIBBLE_PARITY_LOCAL_ROUTES[${index}].path must be an absolute storefront path.`);
		}
		ids.add(candidate.id);
		return { id: candidate.id, path: candidate.path };
	});
}

export function verifyPinnedFixture(fixturePath: string, referenceRoot: string): void {
	const digest = createHash('sha256').update(readFileSync(fixturePath)).digest('hex');
	if (digest !== KIBBLE_PARITY_FIXED_DATA_IDENTITY) throw new Error(`Pinned Kibble fixture SHA mismatch: expected ${KIBBLE_PARITY_FIXED_DATA_IDENTITY}, received ${digest}.`);
	verifyPinnedPdpSourceFiles(referenceRoot);
	const source = readFileSync(resolve(referenceRoot, 'src/lib/brand/kibble-shelf-reference.ts'), 'utf8');
	for (const marker of [KIBBLE_PARITY_CONTRACT_ID, KIBBLE_PARITY_CONTRACT_VERSION, KIBBLE_PARITY_FIXED_DATA_IDENTITY]) {
		if (!source.includes(marker)) throw new Error(`Canonical reference provenance does not contain ${marker}.`);
	}
}

export function verifyPinnedPdpSourceFiles(referenceRoot: string): void {
	const applicationPrefix = `${KIBBLE_REFERENCE_CONTRACT.source.applicationPath}/`;
	const digests = Object.fromEntries(KIBBLE_PARITY_PDP_SOURCE_FILES.map(({ path }) => {
		if (!path.startsWith(applicationPrefix)) {
			throw new Error(`Pinned Kibble PDP source path is outside ${KIBBLE_REFERENCE_CONTRACT.source.applicationPath}: ${path}.`);
		}
		const relativePath = path.slice(applicationPrefix.length);
		const digest = createHash('sha256').update(readFileSync(resolve(referenceRoot, relativePath))).digest('hex');
		return [path, digest];
	}));
	verifyPinnedPdpSourceDigests(digests);
}

export function verifyPinnedPdpSourceDigests(digests: Readonly<Record<string, string>>): void {
	for (const { path, sha256 } of KIBBLE_PARITY_PDP_SOURCE_FILES) {
		const received = digests[path];
		if (received !== sha256) {
			throw new Error(`Pinned Kibble PDP source SHA mismatch for ${path}: expected ${sha256}, received ${received ?? 'missing'}.`);
		}
	}
}

function child(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }): ChildProcess {
	const process = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: 'inherit' });
	process.once('error', (error) => console.error(`[kibble-parity-local] could not start ${command}:`, error.message));
	return process;
}

async function waitForRenderedPage(url: string, processLabel: string): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(url, { redirect: 'error' });
			const body = await response.text();
			if (response.ok && body.includes('<!doctype html>')) return;
			lastError = new Error(`${response.status} ${body.slice(0, 180)}`);
		} catch (error) {
			lastError = error;
		}
		await delay(500);
	}
	throw new Error(`${processLabel} did not render ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function stop(process: ChildProcess): Promise<void> {
	if (process.exitCode !== null || process.killed) return Promise.resolve();
	return new Promise((resolveStop) => {
		const timer = setTimeout(() => process.kill('SIGKILL'), 5_000);
		process.once('exit', () => { clearTimeout(timer); resolveStop(); });
		process.kill('SIGTERM');
	});
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
	return new Promise((resolveRun, rejectRun) => {
		const process = child(command, args, { cwd, env });
		process.once('exit', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`${command} ${args.join(' ')} exited ${code ?? 'without a code'}.`)));
	});
}

async function main(): Promise<void> {
	const candidateRoot = process.cwd();
	const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: candidateRoot, encoding: 'utf8' }).trim();
	const workspaceRoot = findWorkspaceRoot(gitRoot);
	const defaults = deriveLocalParityPaths(workspaceRoot);
	const referenceRoot = process.env.KIBBLE_PARITY_REFERENCE_ROOT ?? defaults.referenceRoot;
	const fixturePath = process.env.KIBBLE_PARITY_FIXTURE_PATH ?? defaults.fixturePath;
	const routes = readLocalParityRoutes(process.env.KIBBLE_PARITY_LOCAL_ROUTES);
	const referencePort = Number(process.env.KIBBLE_PARITY_REFERENCE_PORT ?? 4173);
	const candidatePort = Number(process.env.KIBBLE_PARITY_CANDIDATE_PORT ?? 5173);
	if (!Number.isInteger(referencePort) || !Number.isInteger(candidatePort) || referencePort < 1024 || candidatePort < 1024 || referencePort === candidatePort) {
		throw new Error('KIBBLE_PARITY_REFERENCE_PORT and KIBBLE_PARITY_CANDIDATE_PORT must be distinct local ports.');
	}
	await Promise.all([access(resolve(referenceRoot, 'package.json')), access(resolve(candidateRoot, 'package.json')), access(fixturePath)]);
	verifyPinnedFixture(fixturePath, referenceRoot);

	const interceptor = resolve('scripts/fixtures/kibble-parity-fetch-interceptor.cjs');
	const baseEnv = {
		...process.env,
		NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${interceptor}`].filter(Boolean).join(' '),
		KIBBLE_PARITY_FIXTURE_PATH: fixturePath,
		// Cloudflare's adapter initializes the declared binding before route code
		// runs. The runner-only Vite config replaces postgres.js, so this
		// connection string is parsed but never opened.
		CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: 'postgres://kibble-parity:fixture@127.0.0.1:5432/kibble-parity',
		BIGCOMMERCE_STORE_HASH: 'kibble-parity-fixture',
		BIGCOMMERCE_STOREFRONT_TOKEN: 'kibble-parity-fixture',
	};
	const reference = child('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(referencePort), '--strictPort'], { cwd: referenceRoot, env: baseEnv });
	const candidate = child('npx', ['vite', '--config', 'scripts/kibble-parity-local-vite.config.ts', '--host', '127.0.0.1', '--port', String(candidatePort), '--strictPort'], {
		cwd: candidateRoot,
		env: { ...baseEnv, BRAND_ID: 'kibble', VITE_BRAND_ID: 'kibble' },
	});

	try {
		await Promise.all([
			waitForRenderedPage(`http://127.0.0.1:${referencePort}/`, 'canonical reference'),
			waitForRenderedPage(`http://127.0.0.1:${candidatePort}/`, 'Aisles candidate'),
		]);
		const evidenceRoot = `validation/kibble-parity-local/${new Date().toISOString().replaceAll(':', '-')}`;
		for (const route of routes) {
			const routePath = route.path.replace(/^\//, '');
			const referenceUrl = new URL(routePath, `http://127.0.0.1:${referencePort}/`).toString();
			const candidateUrl = new URL(routePath, `http://127.0.0.1:${candidatePort}/`).toString();
			console.log(`Kibble local parity: ${route.id} (${route.path})`);
			await run('npm', ['run', 'test:kibble-parity'], candidateRoot, {
				...baseEnv,
				KIBBLE_PARITY_REFERENCE_URL: referenceUrl,
				KIBBLE_PARITY_CANDIDATE_URL: candidateUrl,
				KIBBLE_PARITY_CONTRACT_ID,
				KIBBLE_PARITY_CONTRACT_VERSION,
				KIBBLE_PARITY_FIXED_DATA_IDENTITY,
				KIBBLE_PARITY_MASKS: '[]',
				KIBBLE_PARITY_MAX_PIXEL_DIFFERENCE_RATIO: process.env.KIBBLE_PARITY_MAX_PIXEL_DIFFERENCE_RATIO ?? '0',
				KIBBLE_PARITY_STRUCTURE_TOLERANCES: process.env.KIBBLE_PARITY_STRUCTURE_TOLERANCES ?? JSON.stringify(KIBBLE_PARITY_DEFAULT_TOLERANCES),
				KIBBLE_PARITY_OUTPUT_DIR: `${evidenceRoot}/${route.id}`,
			});
		}
	} finally {
		await Promise.all([stop(reference), stop(candidate)]);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
