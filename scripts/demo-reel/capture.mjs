#!/usr/bin/env node
/**
 * Playwright capture script for the new UIP-era scenes.
 *
 * Automates three of the four new screenshots. Voucherify and the config
 * file still need manual capture (see README.md for guidance).
 *
 * Prereqs:
 *   - Dev server running: npm run dev (http://localhost:5173)
 *   - Voucherify sandbox creds in .env.local (VOUCHERIFY_APP_ID / SECRET_KEY)
 *   - BLCKFRDY campaign enabled in the Voucherify sandbox
 *   - Playwright chromium installed: npx playwright install chromium
 *
 * Outputs into scripts/demo-reel/screenshots/:
 *   demo-14-cart-drawer.png      — cart drawer with BLCKFRDY applied
 *   demo-15-uip-response.png     — pretty-printed JSON view of /api/cart
 *   demo-17-observe-incentives.png — Observe dashboard with Incentives panel
 *
 * Still capture manually (see README.md):
 *   demo-16-voucherify.png
 *   demo-18-config-moat.png
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE_URL = process.env.AISLES_URL ?? 'http://localhost:5173';
const VIEWPORT = { width: 1440, height: 900 };

fs.mkdirSync(OUT_DIR, { recursive: true });

function log(msg) {
	console.log(`  ${msg}`);
}

async function addSampleProduct(page) {
	// Grab a valid productEntityId from the SSR'd category HTML, then POST
	// directly to /api/cart. The Gatherer layout (our default demo frame)
	// renders no quick-add buttons, so a UI click path isn't reliable here.
	await page.goto(`${BASE_URL}/category/living-room`, { waitUntil: 'networkidle' });
	const html = await page.content();
	const match = html.match(/entityId[":]+(\d+)/);
	if (!match) throw new Error('No productEntityId found on /category/living-room');
	const productEntityId = parseInt(match[1], 10);
	const res = await page.request.post(`${BASE_URL}/api/cart`, {
		data: { productEntityId, quantity: 1 },
		headers: { 'Content-Type': 'application/json' },
	});
	if (!res.ok()) throw new Error(`Cart seed failed: ${res.status()} ${await res.text()}`);
}

async function applyCode(page, code) {
	const res = await page.request.post(`${BASE_URL}/api/cart`, {
		data: { action: 'apply', code },
		headers: { 'Content-Type': 'application/json' },
	});
	if (!res.ok()) {
		throw new Error(`Failed to apply code: ${res.status()} ${await res.text()}`);
	}
	return await res.json();
}

// ─── Scene: cart drawer with BLCKFRDY applied ────────────────────────
async function captureCartDrawer(context) {
	const page = await context.newPage();
	await page.setViewportSize(VIEWPORT);
	log('→ adding a product to the cart');
	await addSampleProduct(page);
	log('→ applying BLCKFRDY');
	await applyCode(page, 'BLCKFRDY');
	log('→ opening the cart drawer');
	await page.goto(`${BASE_URL}/category/living-room`, { waitUntil: 'networkidle' });
	const cartBtn = page.locator('button[aria-label*="Cart" i]').first();
	await cartBtn.click();
	await page.waitForTimeout(1200);
	const outPath = path.join(OUT_DIR, 'demo-14-cart-drawer.png');
	await page.screenshot({ path: outPath, fullPage: false });
	log(`✓ ${path.basename(outPath)}`);
	await page.close();
}

// ─── Scene: UIP JSON response (rendered in a dedicated HTML view) ────
async function captureUipResponse(context) {
	const page = await context.newPage();
	await page.setViewportSize(VIEWPORT);
	log('→ fetching the /api/cart UIP payload');
	const res = await page.request.get(`${BASE_URL}/api/cart`);
	if (!res.ok()) throw new Error(`Cart fetch failed: ${res.status()}`);
	const data = await res.json();

	const uipOnly = {
		promotions: data.promotions ?? {},
		loyalty: data.loyalty ?? {},
	};
	const jsonStr = JSON.stringify(uipOnly, null, 2);

	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
	html, body { margin: 0; padding: 0; background: #0a0a0a; color: #e5e5e5; font-family: ui-sans-serif, system-ui, sans-serif; }
	body { padding: 56px 72px; }
	.header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 28px; }
	.dot { width: 10px; height: 10px; border-radius: 9999px; background: #10b981; }
	.label { font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #737373; }
	.endpoint { font-family: ui-monospace, monospace; color: #fafafa; font-size: 15px; }
	.code { font-family: ui-monospace, 'JetBrains Mono', monospace; font-size: 15px; line-height: 1.6; background: #171717; border: 1px solid #262626; border-radius: 8px; padding: 28px 32px; white-space: pre; overflow: hidden; }
	.kw { color: #a5b4fc; }
	.str { color: #86efac; }
	.num { color: #fbbf24; }
	.bool { color: #fb7185; }
	.key { color: #f5f5f5; }
	.brace { color: #a3a3a3; }
</style>
</head>
<body>
	<div class="header">
		<span class="dot"></span>
		<span class="label">GET</span>
		<span class="endpoint">/api/cart</span>
		<span class="label" style="margin-left: auto;">UIP · Unified Incentives Protocol</span>
	</div>
	<pre class="code" id="out"></pre>
<script>
const source = ${JSON.stringify(jsonStr)};
function highlight(s) {
	return s
		.replace(/"([^"]+)"(\\s*:)/g, '<span class="key">"$1"</span>$2')
		.replace(/: "([^"]*)"/g, ': <span class="str">"$1"</span>')
		.replace(/: (-?\\d+(?:\\.\\d+)?)/g, ': <span class="num">$1</span>')
		.replace(/: (true|false|null)/g, ': <span class="bool">$1</span>');
}
document.getElementById('out').innerHTML = highlight(source);
</script>
</body>
</html>`;
	await page.setContent(html, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	const outPath = path.join(OUT_DIR, 'demo-15-uip-response.png');
	await page.screenshot({ path: outPath, fullPage: false });
	log(`✓ ${path.basename(outPath)}`);
	await page.close();
}

// ─── Scene: Observe dashboard — Incentives panel ─────────────────────
async function captureObserveIncentives(context) {
	const page = await context.newPage();
	await page.setViewportSize(VIEWPORT);
	log('→ warming a session by browsing a code-landing URL');
	await page.goto(`${BASE_URL}/category/living-room?code=BLCKFRDY`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	log('→ opening the Observe dashboard');
	await page.goto(`${BASE_URL}/observe?key=aisles-observe`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(2500);
	// Pick the most recent session if a selector is present.
	const sessionSelect = page.locator('select, [role="combobox"]').first();
	if (await sessionSelect.isVisible().catch(() => false)) {
		try {
			const options = sessionSelect.locator('option');
			const count = await options.count();
			if (count > 1) {
				const value = await options.nth(1).getAttribute('value');
				if (value) await sessionSelect.selectOption(value);
			}
		} catch {
			// selector flow optional — skip silently
		}
	}
	await page.waitForTimeout(1500);
	const outPath = path.join(OUT_DIR, 'demo-17-observe-incentives.png');
	await page.screenshot({ path: outPath, fullPage: false });
	log(`✓ ${path.basename(outPath)}`);
	await page.close();
}

// ─── Scene: Voucherify campaign card (real API data, branded render) ─
function loadVoucherifyCreds() {
	const envPath = path.join(REPO_ROOT, '.env.local');
	const text = fs.readFileSync(envPath, 'utf-8');
	const get = (key) => (text.match(new RegExp(`^${key}=(.+)$`, 'm')) || [])[1]?.trim();
	return {
		url: get('VOUCHERIFY_API_URL') || 'https://api.voucherify.io',
		appId: get('VOUCHERIFY_APP_ID'),
		secret: get('VOUCHERIFY_SECRET_KEY'),
	};
}

async function captureVoucherify(context) {
	const page = await context.newPage();
	await page.setViewportSize(VIEWPORT);
	log('→ fetching BLCKFRDY voucher from Voucherify');
	const creds = loadVoucherifyCreds();
	if (!creds.appId || !creds.secret) throw new Error('Voucherify creds missing from .env.local');
	const res = await page.request.get(`${creds.url}/v1/vouchers/BLCKFRDY`, {
		headers: {
			'x-app-id': creds.appId,
			'x-app-token': creds.secret,
			accept: 'application/json',
		},
	});
	if (!res.ok()) throw new Error(`Voucherify fetch failed: ${res.status()}`);
	const v = await res.json();

	const discountStr = v.discount?.type === 'AMOUNT'
		? `$${(v.discount.amount_off / 100).toFixed(2)} off`
		: v.discount?.type === 'PERCENT'
			? `${v.discount.percent_off}% off`
			: JSON.stringify(v.discount);
	const created = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	const redeemed = v.redemption?.redeemed_quantity ?? 0;
	const quantity = v.redemption?.quantity ?? '∞';

	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
	* { box-sizing: border-box; }
	html, body { margin: 0; padding: 0; background: #f4f5f7; color: #1a1a2e; font-family: -apple-system, 'Segoe UI', system-ui, sans-serif; }
	.topbar { background: #1e1b4b; color: #e0e7ff; padding: 14px 32px; display: flex; align-items: center; gap: 24px; }
	.logo { font-weight: 700; letter-spacing: -0.01em; font-size: 17px; }
	.logo .mark { color: #818cf8; }
	.crumbs { font-size: 13px; color: #c7d2fe; }
	.crumbs .sep { margin: 0 8px; color: #6366f1; }
	.spacer { flex: 1; }
	.user { width: 28px; height: 28px; border-radius: 9999px; background: #6366f1; }
	.container { padding: 48px 64px; }
	.title { font-size: 26px; font-weight: 600; margin: 0 0 8px 0; }
	.subtitle { color: #64748b; margin: 0 0 32px 0; font-size: 14px; }
	.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); padding: 32px; }
	.codeline { display: flex; align-items: baseline; gap: 14px; margin-bottom: 4px; }
	.code { font-family: ui-monospace, 'SF Mono', monospace; font-size: 28px; font-weight: 700; letter-spacing: 0.02em; color: #1e1b4b; }
	.status { display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
	.status .dot { width: 6px; height: 6px; border-radius: 9999px; background: #16a34a; }
	.name { color: #475569; font-size: 15px; margin: 0 0 28px 0; }
	.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid #f1f5f9; padding-top: 24px; }
	.cell { padding-right: 24px; border-right: 1px solid #f1f5f9; }
	.cell:last-child { border-right: 0; }
	.label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
	.value { font-size: 18px; font-weight: 600; color: #0f172a; }
	.value.mono { font-family: ui-monospace, monospace; font-size: 15px; }
	.foot { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; gap: 20px; font-size: 13px; color: #64748b; }
	.foot .k { color: #94a3b8; margin-right: 6px; }
	.hint { margin-top: 40px; padding: 18px 24px; background: #eef2ff; border-left: 3px solid #6366f1; color: #312e81; font-size: 14px; border-radius: 0 8px 8px 0; }
</style>
</head>
<body>
	<div class="topbar">
		<div class="logo"><span class="mark">v</span>oucherify</div>
		<div class="crumbs">Campaigns <span class="sep">›</span> Standalone vouchers <span class="sep">›</span> BLCKFRDY</div>
		<div class="spacer"></div>
		<div class="user"></div>
	</div>
	<div class="container">
		<h1 class="title">BLCKFRDY</h1>
		<p class="subtitle">Standalone discount voucher · Publishes to storefronts, AI agents, and loyalty emails through one API</p>
		<div class="card">
			<div class="codeline">
				<div class="code">${v.code}</div>
				<span class="status"><span class="dot"></span>${v.active ? 'Active' : 'Inactive'}</span>
			</div>
			<p class="name">${v.metadata?.name || 'Discount voucher'}</p>
			<div class="grid">
				<div class="cell">
					<div class="label">Discount</div>
					<div class="value">${discountStr}</div>
				</div>
				<div class="cell">
					<div class="label">Type</div>
					<div class="value mono">${v.type}</div>
				</div>
				<div class="cell">
					<div class="label">Redemptions</div>
					<div class="value">${redeemed} <span style="color:#94a3b8; font-weight: 400;">of ${quantity}</span></div>
				</div>
				<div class="cell">
					<div class="label">Created</div>
					<div class="value">${created}</div>
				</div>
			</div>
			<div class="foot">
				<div><span class="k">Campaign</span>${v.campaign || '—'}</div>
				<div><span class="k">ID</span><span style="font-family: ui-monospace, monospace;">${v.id}</span></div>
			</div>
		</div>
		<div class="hint">Aisles reads this voucher through the Voucherify API and emits it in UIP format. Shopper cart, AI agent, Observe — all sourced from one rule set.</div>
	</div>
</body>
</html>`;
	await page.setContent(html, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	const outPath = path.join(OUT_DIR, 'demo-16-voucherify.png');
	await page.screenshot({ path: outPath, fullPage: false });
	log(`✓ ${path.basename(outPath)}`);
	await page.close();
}

// ─── Scene: Ember config with incentives block highlighted ──────────
async function captureConfigMoat(context) {
	const page = await context.newPage();
	await page.setViewportSize(VIEWPORT);
	log('→ rendering Ember brand config as a code panel');
	const configPath = path.join(REPO_ROOT, 'src', 'lib', 'brand', 'config.ts');
	const source = fs.readFileSync(configPath, 'utf-8');

	// Extract the Ember block. Start at `ember: {` and match braces until close.
	const emberStart = source.indexOf('ember: {');
	if (emberStart === -1) throw new Error('Ember block not found in config.ts');
	let depth = 0;
	let emberEnd = emberStart;
	for (let i = emberStart; i < source.length; i++) {
		const ch = source[i];
		if (ch === '{') depth++;
		else if (ch === '}') {
			depth--;
			if (depth === 0) {
				emberEnd = i + 1;
				break;
			}
		}
	}
	const emberBlockRaw = source.slice(emberStart, emberEnd);

	// Build a condensed view that keeps the narrative beats visible in one frame:
	// identity → theme (collapsed) → prompt (collapsed) → incentives (full).
	const incentivesMatch = emberBlockRaw.match(/(\t\tincentives:\s*\{[\s\S]*?\n\t\t\},?)/);
	const incentivesBlock = incentivesMatch ? incentivesMatch[1].replace(/^\t\t/gm, '\t') : '';
	const emberBlock = `ember: {
	id: 'ember',
	name: 'Ember',
	tagline: 'Gather around something real',
	domain: 'outdoor lifestyle & fire',

	bc: { channelId: 1846324, categoryPrefix: 'Ember' },
	categories: { /* fire-pits, camp-stoves, grills, accessories */ },
	theme: { /* Libre Baskerville, terracotta, olive */ },
	homepage: { /* hero + editorial + value props */ },
	prompt: {
		storeName: 'Ember',
		personaDefinitions: { gatherer, hunter, researcher, gifter },
		voiceGuidance: 'Warm and rugged. Evocative but honest...',
	},

${incentivesBlock}
}`;

	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
	html, body { margin: 0; padding: 0; background: #0a0a0a; color: #e5e5e5; font-family: ui-sans-serif, system-ui, sans-serif; }
	body { padding: 48px 64px; }
	.header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 20px; }
	.dot { width: 10px; height: 10px; border-radius: 9999px; background: #c2410c; }
	.label { font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #737373; }
	.filepath { font-family: ui-monospace, monospace; color: #fafafa; font-size: 15px; }
	.code { font-family: ui-monospace, 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.6; background: #171717; border: 1px solid #262626; border-radius: 8px; padding: 26px 32px; white-space: pre; overflow: hidden; }
	.kw { color: #a5b4fc; }
	.str { color: #86efac; }
	.num { color: #fbbf24; }
	.bool { color: #fb7185; }
	.comment { color: #525252; font-style: italic; }
	.prop { color: #e5e5e5; }
	.hl { background: rgba(194, 65, 12, 0.10); border-left: 2px solid #c2410c; display: block; padding: 0 12px; margin: 0 -28px; }
</style>
</head>
<body>
	<div class="header">
		<span class="dot"></span>
		<span class="label">src/lib/brand/config.ts</span>
		<span class="filepath">→ ember</span>
		<span class="label" style="margin-left: auto;">Configuration, not code</span>
	</div>
	<pre class="code" id="out"></pre>
<script>
const source = ${JSON.stringify(emberBlock)};
function esc(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function highlight(s) {
	let h = esc(s);
	// comments
	h = h.replace(/(\\/\\/[^\\n]*)/g, '<span class="comment">$1</span>');
	// strings
	h = h.replace(/'([^']*)'/g, "<span class=\\"str\\">'$1'</span>");
	// keywords
	h = h.replace(/\\b(true|false|null)\\b/g, '<span class="bool">$1</span>');
	h = h.replace(/\\b(\\d+(?:\\.\\d+)?)\\b/g, '<span class="num">$1</span>');
	// property keys (simple heuristic)
	h = h.replace(/^(\\s+)([a-zA-Z_][a-zA-Z0-9_]*)(:)/gm, '$1<span class="prop">$2</span>$3');
	return h;
}
let html = highlight(source);
// highlight the incentives block with a subtle left bar
html = html.replace(/(\\s*)(<span class="prop">incentives<\\/span>:[\\s\\S]*?},)(\\s*\\n\\s*},)/, '<span class="hl">$1$2</span>$3');
document.getElementById('out').innerHTML = html;
</script>
</body>
</html>`;
	await page.setContent(html, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	const outPath = path.join(OUT_DIR, 'demo-18-config-moat.png');
	await page.screenshot({ path: outPath, fullPage: false });
	log(`✓ ${path.basename(outPath)}`);
	await page.close();
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
	console.log(`\nDemo reel capture — UIP scenes`);
	console.log(`  base URL: ${BASE_URL}`);
	console.log(`  output:   ${OUT_DIR}\n`);

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: VIEWPORT });

	try {
		console.log('[1/5] Cart drawer with discount');
		await captureCartDrawer(context);
		console.log('\n[2/5] UIP JSON response');
		await captureUipResponse(context);
		console.log('\n[3/5] Observe — Incentives panel');
		await captureObserveIncentives(context);
		console.log('\n[4/5] Voucherify — BLCKFRDY campaign');
		await captureVoucherify(context);
		console.log('\n[5/5] Ember config — the moat');
		await captureConfigMoat(context);
	} finally {
		await context.close();
		await browser.close();
	}

	console.log('\nDone. All five UIP scenes captured automatically.\n');
}

main().catch((err) => {
	console.error('\n✗', err.message);
	process.exit(1);
});
