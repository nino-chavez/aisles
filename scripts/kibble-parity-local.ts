import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { KIBBLE_REFERENCE_CONTRACT } from '../src/lib/brand/reference/kibble';

export const KIBBLE_PARITY_CONTRACT_ID = KIBBLE_REFERENCE_CONTRACT.id;
export const KIBBLE_PARITY_CONTRACT_VERSION = KIBBLE_REFERENCE_CONTRACT.version;
export const KIBBLE_PARITY_FIXED_DATA_IDENTITY = KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256;
export const KIBBLE_PARITY_PDP_SOURCE_FILES = KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.dependencyClosure.adapted;
const KIBBLE_PARITY_SOURCE_GROUPS = [
	KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.dependencyClosure.adapted,
	KIBBLE_REFERENCE_CONTRACT.recipes.search.source.dependencyClosure.adapted,
	KIBBLE_REFERENCE_CONTRACT.recipes.cart.source.dependencyClosure.adapted,
	KIBBLE_REFERENCE_CONTRACT.recipes.account.source.dependencyClosure.adapted,
	KIBBLE_REFERENCE_CONTRACT.recipes.checkout.source.dependencyClosure.adapted,
	KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.source.dependencyClosure.adapted,
] as const;
export const KIBBLE_PARITY_ADAPTED_SOURCE_FILES = [...new Map(
	KIBBLE_PARITY_SOURCE_GROUPS.flatMap((group) => [...group]).map((file) => [file.path, file]),
).values()];
export const KIBBLE_PARITY_DEFAULT_TOLERANCES = {
	header: 0, nav: 0, main: 0, footer: 0, h1: 0, h2: 0, h3: 0,
	section: 0, image: 0, link: 0, button: 0, pageHeight: 0,
};

export type LocalParityRoute = { id: string; referencePath: string; candidatePath: string };

export const KIBBLE_PARITY_DEFAULT_ROUTES: LocalParityRoute[] = [
	{ id: 'home', referencePath: '/', candidatePath: '/' },
	{ id: 'plp', referencePath: '/category/dog-food', candidatePath: '/category/dog-food' },
	{ id: 'pdp-review', referencePath: '/products/openfarm-goodgut-grass-fed-beef-dog-kibble', candidatePath: '/product/openfarm-goodgut-grass-fed-beef-dog-kibble?dev=true' },
	{ id: 'search', referencePath: '/search?q=goodgut', candidatePath: '/search?q=goodgut' },
	{ id: 'cart', referencePath: '/cart', candidatePath: '/cart' },
	{ id: 'account', referencePath: '/account/login', candidatePath: '/account/login' },
	{ id: 'subscriptions', referencePath: '/subscriptions', candidatePath: '/subscriptions' },
	{ id: 'checkout-gift', referencePath: '/checkout/gift', candidatePath: '/checkout/gift' },
	{ id: 'checkout-prepaid', referencePath: '/checkout/prepaid', candidatePath: '/checkout/prepaid' },
	{ id: 'checkout-confirmation', referencePath: '/checkout/confirmation', candidatePath: '/checkout/confirmation' },
	{ id: 'error-404', referencePath: '/missing-kibble-route', candidatePath: '/missing-kibble-route' },
];

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
	if (!value) return KIBBLE_PARITY_DEFAULT_ROUTES.map((route) => ({ ...route }));
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
		const sharedPath = typeof candidate.path === 'string' ? candidate.path : null;
		const referencePath = typeof candidate.referencePath === 'string' ? candidate.referencePath : sharedPath;
		const candidatePath = typeof candidate.candidatePath === 'string' ? candidate.candidatePath : sharedPath;
		for (const [field, path] of [['referencePath', referencePath], ['candidatePath', candidatePath]] as const) {
			if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new Error(`KIBBLE_PARITY_LOCAL_ROUTES[${index}].${field} must be an absolute storefront path.`);
		}
		ids.add(candidate.id);
		return { id: candidate.id, referencePath, candidatePath };
	});
}

export function verifyPinnedFixture(fixturePath: string, referenceRoot: string): void {
	const digest = createHash('sha256').update(readFileSync(fixturePath)).digest('hex');
	if (digest !== KIBBLE_PARITY_FIXED_DATA_IDENTITY) throw new Error(`Pinned Kibble fixture SHA mismatch: expected ${KIBBLE_PARITY_FIXED_DATA_IDENTITY}, received ${digest}.`);
	verifyPinnedAdaptedSourceFiles(referenceRoot);
	const source = readFileSync(resolve(referenceRoot, 'src/lib/brand/kibble-shelf-reference.ts'), 'utf8');
	for (const marker of [KIBBLE_PARITY_CONTRACT_ID, KIBBLE_PARITY_CONTRACT_VERSION, KIBBLE_PARITY_FIXED_DATA_IDENTITY]) {
		if (!source.includes(marker)) throw new Error(`Canonical reference provenance does not contain ${marker}.`);
	}
}

export function verifyPinnedPdpSourceFiles(referenceRoot: string): void {
	verifyPinnedAdaptedSourceFiles(referenceRoot);
}

export function verifyPinnedAdaptedSourceFiles(referenceRoot: string): void {
	const applicationPrefix = `${KIBBLE_REFERENCE_CONTRACT.source.applicationPath}/`;
	const digests = Object.fromEntries(KIBBLE_PARITY_ADAPTED_SOURCE_FILES.map(({ path }) => {
		if (!path.startsWith(applicationPrefix)) {
			throw new Error(`Pinned Kibble adapted source path is outside ${KIBBLE_REFERENCE_CONTRACT.source.applicationPath}: ${path}.`);
		}
		const relativePath = path.slice(applicationPrefix.length);
		const digest = createHash('sha256').update(readFileSync(resolve(referenceRoot, relativePath))).digest('hex');
		return [path, digest];
	}));
	verifyPinnedAdaptedSourceDigests(digests);
}

export function verifyPinnedPdpSourceDigests(digests: Readonly<Record<string, string>>): void {
	for (const { path, sha256 } of KIBBLE_PARITY_PDP_SOURCE_FILES) {
		const received = digests[path];
		if (received !== sha256) throw new Error(`Pinned Kibble PDP source SHA mismatch for ${path}: expected ${sha256}, received ${received ?? 'missing'}.`);
	}
}

export function verifyPinnedAdaptedSourceDigests(digests: Readonly<Record<string, string>>): void {
	for (const { path, sha256 } of KIBBLE_PARITY_ADAPTED_SOURCE_FILES) {
		const received = digests[path];
		if (received !== sha256) {
			throw new Error(`Pinned Kibble adapted source SHA mismatch for ${path}: expected ${sha256}, received ${received ?? 'missing'}.`);
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

function runForStatus(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<number> {
	return new Promise((resolveRun) => {
		const process = child(command, args, { cwd, env });
		process.once('exit', (code) => resolveRun(code ?? 1));
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
		KIBBLE_PARITY_FIXED_DATA_IDENTITY,
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
		const routeResults: Array<{ id: string; referencePath: string; candidatePath: string; status: 'passed' | 'failed' }> = [];
		for (const route of routes) {
			const referenceUrl = new URL(route.referencePath.replace(/^\//, ''), `http://127.0.0.1:${referencePort}/`).toString();
			const candidateUrl = new URL(route.candidatePath.replace(/^\//, ''), `http://127.0.0.1:${candidatePort}/`).toString();
			console.log(`Kibble local parity: ${route.id} (${route.referencePath} -> ${route.candidatePath})`);
			const code = await runForStatus('npm', ['run', 'test:kibble-parity'], candidateRoot, {
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
				KIBBLE_PARITY_ROUTE_ID: route.id,
				KIBBLE_PARITY_REFERENCE_PROVENANCE_MODE: 'verified-local-harness',
			});
			routeResults.push({ ...route, status: code === 0 ? 'passed' : 'failed' });
		}
		await mkdir(evidenceRoot, { recursive: true });
		const differenceLedger = {
			status: routeResults.some(({ status }) => status === 'failed') ? 'open' : 'passed',
			generatedAt: new Date().toISOString(),
			masks: [],
			routes: routeResults,
			requiredFixes: routeResults.filter(({ status }) => status === 'failed').map(({ id }) => ({ routeId: id, evidence: `${evidenceRoot}/${id}`, reason: 'Executable visual or structural parity reported unresolved differences.' })),
			deliberateOpenApprovalItems: [{ routeId: 'home', reason: 'Truth and accessibility differences, including omission of unsubstantiated reference claims, remain visible and require named human approval. They are not masked or accepted by this runner.' }],
		};
		await writeFile(`${evidenceRoot}/difference-ledger.json`, `${JSON.stringify(differenceLedger, null, 2)}\n`);
		console.log(`Kibble local parity difference ledger: ${evidenceRoot}/difference-ledger.json`);
		if (differenceLedger.status === 'open') throw new Error(`Kibble local parity remains open after the full route matrix. Evidence: ${evidenceRoot}`);
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
