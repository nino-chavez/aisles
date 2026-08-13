<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { buildObserveSessionHref } from '$lib/signals/observe-session-link';
	import KibbleDevInspectorLauncher from './KibbleDevInspectorLauncher.svelte';
	import type { KibbleInspectorPersona } from './kibble-dev-inspector';
	import { describeKibblePdpModelAction, type KibblePdpModelActionStatus } from './kibble-pdp-model-action';
	import { describeKibblePlpModelAction, type KibblePlpModelActionStatus } from './kibble-plp-model-action';

	type ZoneAuthority = 'fixed' | 'rules' | 'model';
	type ZoneEvidence = {
		instanceId: string;
		label: string;
		authority: ZoneAuthority;
		modelCalls: number;
		status: string;
		variant: string;
	};

	let {
		active,
		enableHref,
		disableHref,
		surface,
		policyVersion,
		referenceId,
		referenceVersion,
		sessionId = null,
		initialPersona = null,
	}: {
		active: boolean;
		enableHref: string;
		disableHref: string;
		surface: string;
		policyVersion?: string | null;
		referenceId: string;
		referenceVersion: string;
		sessionId?: string | null;
		initialPersona?: string | null;
	} = $props();

	let expanded = $state(true);
	let showZones = $state(false);
	let zones = $state<ZoneEvidence[]>([]);
	let persona = $state<string | null>(null);
	let pdpModelActionEligible = $state(false);
	let pdpModelActionReady = $state(false);
	let pdpModelActionStatus = $state<KibblePdpModelActionStatus>('idle');
	let plpModelActionEligible = $state(false);
	let plpModelActionReady = $state(false);
	let plpModelActionStatus = $state<KibblePlpModelActionStatus>('idle');
	const pdpModelAction = $derived(describeKibblePdpModelAction(pdpModelActionStatus));
	const plpModelAction = $derived(describeKibblePlpModelAction(plpModelActionStatus));
	const visiblePersona = $derived(persona ?? initialPersona);
	const observeHref = $derived(buildObserveSessionHref(sessionId));
	const templateCount = $derived(zones.filter(({ authority }) => authority === 'fixed').length);
	const rulesCount = $derived(zones.filter(({ authority }) => authority === 'rules').length);
	const modelZoneCount = $derived(zones.filter(({ authority }) => authority === 'model').length);
	const modelCallCount = $derived(zones.reduce((sum, zone) => sum + zone.modelCalls, 0));
	const surfaceLabel = $derived(labelFromId(surface));

	$effect(() => {
		if (initialPersona) persona = initialPersona;
	});

	$effect(() => {
		document.body.classList.toggle('aisles-observe-zone-map', active && showZones);
		return () => document.body.classList.remove('aisles-observe-zone-map');
	});

	const scanZones = () => {
		const evidence = new Map<string, ZoneEvidence>();
		for (const element of document.querySelectorAll<HTMLElement>('[data-aisles-zone-instance], [data-kibble-zone-instance]')) {
			const instanceId = element.dataset.aislesZoneInstance ?? element.dataset.kibbleZoneInstance;
			if (!instanceId) continue;
			const authority = parseAuthority(element.dataset.aislesAuthority, instanceId);
			const modelCalls = boundedCount(element.dataset.aislesModelCalls);
			evidence.set(instanceId, {
				instanceId,
				label: element.dataset.aislesZoneLabel || labelFromId(instanceId),
				authority,
				modelCalls,
				status: element.dataset.kibbleZoneStatus || 'live',
				variant: element.dataset.kibbleZoneVariant || element.dataset.aislesVariant || 'reference-owned',
			});
		}
		pdpModelActionEligible = document.querySelector('[data-aisles-pdp-model-eligible="true"]') !== null;
		plpModelActionEligible = document.querySelector('[data-aisles-plp-model-eligible="true"]') !== null;
		if (!pdpModelActionEligible) {
			pdpModelActionStatus = 'idle';
			pdpModelActionReady = false;
		}
		if (!plpModelActionEligible) { plpModelActionStatus = 'idle'; plpModelActionReady = false; }
		zones = [...evidence.values()];
	};

	onMount(() => {
		const storedExpanded = localStorage.getItem('aisles-observe-expanded');
		if (storedExpanded === 'false') expanded = false;
		const collapseForSignalLab = () => {
			if (window.location.hash === '#kibble-signal-lab') expanded = false;
		};
		collapseForSignalLab();
		showZones = localStorage.getItem('aisles-observe-zones') === 'true';
		void tick().then(scanZones);
		const observer = new MutationObserver(scanZones);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [
				'data-aisles-zone-instance', 'data-aisles-zone-label', 'data-aisles-authority',
				'data-aisles-model-calls', 'data-kibble-zone-instance', 'data-kibble-zone-status',
				'data-aisles-pdp-model-eligible',
				'data-aisles-plp-model-eligible',
			],
		});
		const onInferenceUpdate = (event: Event) => {
			const detail = event instanceof CustomEvent ? event.detail : null;
			const inference = detail && typeof detail === 'object' && 'inference' in detail ? detail.inference : detail;
			if (inference && typeof inference === 'object' && 'primary' in inference && typeof inference.primary === 'string') {
				persona = inference.primary as KibbleInspectorPersona;
			}
		};
		const onPdpModelStatus = (event: Event) => {
			const status = event instanceof CustomEvent ? event.detail : null;
			if (status === 'updating' || status === 'applied' || status === 'failed') pdpModelActionStatus = status;
		};
		const onPdpModelReady = () => { pdpModelActionReady = true; };
		const onPlpModelStatus = (event: Event) => {
			const status = event instanceof CustomEvent ? event.detail : null;
			if (status === 'updating' || status === 'applied' || status === 'failed') plpModelActionStatus = status;
		};
		const onPlpModelReady = () => { plpModelActionReady = true; };
		window.addEventListener('hashchange', collapseForSignalLab);
		window.addEventListener('aisles-inference-update', onInferenceUpdate);
		window.addEventListener('aisles-kibble-pdp-model-status', onPdpModelStatus);
		window.addEventListener('aisles-kibble-pdp-model-ready', onPdpModelReady);
		window.addEventListener('aisles-kibble-plp-model-status', onPlpModelStatus);
		window.addEventListener('aisles-kibble-plp-model-ready', onPlpModelReady);
		return () => {
			observer.disconnect();
			window.removeEventListener('hashchange', collapseForSignalLab);
			window.removeEventListener('aisles-inference-update', onInferenceUpdate);
			window.removeEventListener('aisles-kibble-pdp-model-status', onPdpModelStatus);
			window.removeEventListener('aisles-kibble-pdp-model-ready', onPdpModelReady);
			window.removeEventListener('aisles-kibble-plp-model-status', onPlpModelStatus);
			window.removeEventListener('aisles-kibble-plp-model-ready', onPlpModelReady);
		};
	});

	afterNavigate(({ to }) => {
		if (to?.url.hash === '#kibble-signal-lab') expanded = false;
		// A same-route sort/cursor navigation replaces the PLP listener. Do not
		// let its prior readiness or terminal status govern the new page data.
		plpModelActionReady = false;
		plpModelActionStatus = 'idle';
		void tick().then(scanZones);
	});

	function toggleExpanded() {
		expanded = !expanded;
		localStorage.setItem('aisles-observe-expanded', String(expanded));
	}

	function toggleZones() {
		showZones = !showZones;
		localStorage.setItem('aisles-observe-zones', String(showZones));
	}

	function requestPdpModelDecision() {
		if (!pdpModelActionEligible || !pdpModelActionReady || pdpModelAction.disabled) return;
		pdpModelActionStatus = 'updating';
		window.dispatchEvent(new CustomEvent('aisles-kibble-pdp-model-request'));
	}

	function requestPlpModelDecision() {
		if (!plpModelActionEligible || !plpModelActionReady || plpModelAction.disabled) return;
		plpModelActionStatus = 'updating';
		window.dispatchEvent(new CustomEvent('aisles-kibble-plp-model-request'));
	}

	function parseAuthority(value: string | undefined, instanceId: string): ZoneAuthority {
		if (value === 'rules' || value === 'model') return value;
		if (value === 'fixed') return value;
		return instanceId.startsWith('home.featured-row') ? 'rules' : 'fixed';
	}

	function boundedCount(value: string | undefined): number {
		const count = Number(value ?? '0');
		return Number.isInteger(count) && count >= 0 && count <= 100 ? count : 0;
	}

	function labelFromId(value: string): string {
		return value
			.replace(/^error-/, 'error ')
			.replace(/[._-]+/g, ' ')
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}
</script>

{#if !active}
	<KibbleDevInspectorLauncher href={enableHref} />
{:else}
	<aside class:aisles-observe--collapsed={!expanded} class="aisles-observe" aria-labelledby="aisles-observe-title">
		<header class="aisles-observe__header">
			<div class="aisles-observe__identity">
				<span class="aisles-observe__seam" aria-hidden="true"><i></i><i></i><i></i></span>
				<div>
					<p>Aisles live evidence</p>
					<h2 id="aisles-observe-title">
						{surfaceLabel} · Preserve shell{modelCallCount > 0 ? ' · AI-ranked shelf' : ''}
					</h2>
				</div>
			</div>
			<button type="button" aria-expanded={expanded} aria-controls="aisles-observe-body" onclick={toggleExpanded}>
				{expanded ? 'Collapse' : 'Expand'}
			</button>
		</header>

		<div id="aisles-observe-body" class="aisles-observe__body" hidden={!expanded}>
			<div class="aisles-observe__counts" aria-label="Visible decision authority">
				<div><span class="aisles-observe__pip aisles-observe__pip--fixed"></span><b>Template</b><strong>{templateCount}</strong></div>
				<div><span class="aisles-observe__pip aisles-observe__pip--rules"></span><b>Rules</b><strong>{rulesCount}</strong></div>
				<div><span class="aisles-observe__pip aisles-observe__pip--model"></span><b>AI calls</b><strong>{modelCallCount}</strong></div>
			</div>

			<p class="aisles-observe__truth" aria-live="polite" aria-atomic="true">
				{#if modelCallCount > 0}
					A model returned the product order for the ranked shelf. The shelf component and all shopper-facing product fields remained fixed.
				{:else if modelZoneCount > 0}
					AI authority exists, but no model call produced the current page.
				{:else if rulesCount > 0}
					Signals can change approved product order. The page structure remains the merchant template. No model generated this page.
				{:else}
					This page is the pinned merchant template. No model generated or selected its visible content.
				{/if}
			</p>

			<div class="aisles-observe__facts">
				<div><span>persona</span><b>{visiblePersona ?? 'not inferred yet'}</b></div>
				<div><span>policy</span><b>{policyVersion ?? 'fixed route'}</b></div>
				<div><span>reference</span><b>{referenceId}@{referenceVersion}</b></div>
			</div>

			<div class="aisles-observe__actions">
				<button type="button" class:aisles-observe__action--active={showZones} aria-pressed={showZones} onclick={toggleZones}>
					{showZones ? 'Hide zone map' : 'Show zone map'}
				</button>
				{#if surface === 'home'}<a href="/?observe=true#kibble-signal-lab">Open signal lab</a>{/if}
				{#if surface === 'pdp' && pdpModelActionEligible && pdpModelActionReady}<button type="button" onclick={requestPdpModelDecision} disabled={pdpModelAction.disabled}>{pdpModelAction.label}</button>{/if}
				{#if surface === 'plp' && plpModelActionEligible && plpModelActionReady}<button type="button" onclick={requestPlpModelDecision} disabled={plpModelAction.disabled}>{plpModelAction.label}</button>{/if}
				{#if observeHref}<a href={observeHref} target="_blank" rel="noopener">Open session in Observe <span aria-hidden="true">↗</span></a>{/if}
			</div>
			<p class="aisles-observe__truth" role="status" aria-live="polite">{surface === 'pdp' ? pdpModelAction.detail : surface === 'plp' ? plpModelAction.detail : ''}</p>

			<details class="aisles-observe__zones">
				<summary>Visible page zones ({zones.length})</summary>
				<ul>
					{#each zones as zone (zone.instanceId)}
						<li>
							<span class={`aisles-observe__tag aisles-observe__tag--${zone.authority}`}>
								{zone.authority === 'fixed' ? 'Template' : zone.authority === 'rules' ? 'Rules' : zone.modelCalls ? 'AI live' : 'AI unused'}
							</span>
							<div><b>{zone.label}</b><small>{zone.instanceId} · {zone.status}</small></div>
						</li>
					{/each}
				</ul>
			</details>

			<section class="aisles-observe__boundary" aria-labelledby="aisles-commerce-boundary">
				<h3 id="aisles-commerce-boundary">Why purchase controls stop here</h3>
				<p>Aisles currently preserves this storefront and reads its catalog. Its cart, checkout, account, and Auto-Refill services are not connected, so the demo does not imitate transactions it cannot complete.</p>
				<a href="https://storefront.bcsubs.app/" target="_blank" rel="noopener">Open the connected reference store <span aria-hidden="true">↗</span></a>
			</section>

			<footer class="aisles-observe__footer">
				<p><b>Template</b> is merchant-owned. <b>Rules</b> are deterministic. <b>AI</b> means a model actually returned content.</p>
				<a href={disableHref}>Exit observability demo</a>
			</footer>
		</div>
	</aside>
{/if}

<style>
	.aisles-observe { --observe-ink:#17213b; --observe-muted:#5b657b; --observe-line:#cbd5e8; --observe-blue:#315cc9; --observe-coral:#b94a3b; position:fixed; right:1rem; bottom:1rem; z-index:80; width:min(25rem, calc(100vw - 2rem)); max-height:min(40rem, 70vh); overflow:auto; border:1px solid #9fb0d1; background:#f8faff; color:var(--observe-ink); box-shadow:0 18px 50px rgb(23 33 59 / .24); font-family:var(--kc-font-machinery, ui-monospace, SFMono-Regular, Menlo, monospace); font-size:.73rem; line-height:1.45; }
	.aisles-observe--collapsed { width:auto; overflow:visible; }
	.aisles-observe *, .aisles-observe *::before, .aisles-observe *::after { box-sizing:border-box; }
	.aisles-observe__body[hidden] { display:none; }
	.aisles-observe__header { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:1rem; border-bottom:1px solid var(--observe-line); background:#e8eefb; padding:.7rem .75rem; }
	.aisles-observe--collapsed .aisles-observe__header { border-bottom:0; }
	.aisles-observe__identity { display:flex; align-items:center; gap:.65rem; }
	.aisles-observe__identity p, .aisles-observe__identity h2 { margin:0; }
	.aisles-observe__identity p { color:var(--observe-muted); font-size:.62rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
	.aisles-observe__identity h2 { margin-top:.08rem; font-size:.82rem; letter-spacing:-.015em; }
	.aisles-observe__seam { display:grid; gap:2px; width:5px; }
	.aisles-observe__seam i { display:block; width:5px; height:9px; background:#667796; }
	.aisles-observe__seam i:nth-child(2) { background:var(--observe-blue); }
	.aisles-observe__seam i:nth-child(3) { background:var(--observe-coral); }
	.aisles-observe button, .aisles-observe a { min-height:44px; border:1px solid #a9b9db; background:#fff; color:#1c4cab; padding:.45rem .58rem; font:inherit; font-weight:800; text-decoration:none; }
	.aisles-observe button { cursor:pointer; }
	.aisles-observe button:hover, .aisles-observe a:hover { background:#edf2fc; }
	.aisles-observe button:focus-visible, .aisles-observe a:focus-visible, .aisles-observe summary:focus-visible { outline:3px solid var(--observe-blue); outline-offset:3px; }
	.aisles-observe__counts { display:grid; grid-template-columns:repeat(3, 1fr); border-bottom:1px solid var(--observe-line); background:#fff; }
	.aisles-observe__counts div { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:.35rem; min-width:0; padding:.65rem .7rem; border-right:1px solid var(--observe-line); }
	.aisles-observe__counts div:last-child { border-right:0; }
	.aisles-observe__counts b { font-size:.65rem; }
	.aisles-observe__counts strong { font-size:.85rem; }
	.aisles-observe__pip { width:7px; height:7px; background:#667796; }
	.aisles-observe__pip--rules { background:var(--observe-blue); }
	.aisles-observe__pip--model { background:var(--observe-coral); }
	.aisles-observe__truth { margin:0; border-bottom:1px solid var(--observe-line); background:#fff; padding:.72rem .8rem; color:#3e4961; }
	.aisles-observe__facts { display:grid; grid-template-columns:repeat(3, 1fr); gap:.55rem; border-bottom:1px solid var(--observe-line); padding:.7rem .8rem; }
	.aisles-observe__facts div { min-width:0; }
	.aisles-observe__facts span, .aisles-observe__facts b { display:block; overflow-wrap:anywhere; }
	.aisles-observe__facts span { color:var(--observe-muted); font-size:.6rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
	.aisles-observe__facts b { margin-top:.15rem; font-size:.65rem; }
	.aisles-observe__actions { display:flex; flex-wrap:wrap; gap:.4rem; border-bottom:1px solid var(--observe-line); padding:.7rem .8rem; }
	.aisles-observe__actions > * { display:inline-flex; align-items:center; }
	.aisles-observe__action--active { border-color:var(--observe-blue) !important; box-shadow:inset 0 0 0 1px var(--observe-blue); }
	.aisles-observe__zones { border-bottom:1px solid var(--observe-line); padding:.7rem .8rem; }
	.aisles-observe__zones summary { cursor:pointer; color:#1c4cab; font-weight:800; }
	.aisles-observe__zones ul { display:grid; gap:.4rem; margin:.65rem 0 0; padding:0; list-style:none; }
	.aisles-observe__zones li { display:flex; align-items:start; gap:.5rem; border-top:1px solid #e0e6f2; padding-top:.42rem; }
	.aisles-observe__zones li:first-child { border-top:0; padding-top:0; }
	.aisles-observe__zones b, .aisles-observe__zones small { display:block; overflow-wrap:anywhere; }
	.aisles-observe__zones b { font-size:.68rem; }
	.aisles-observe__zones small { margin-top:.08rem; color:var(--observe-muted); font-size:.6rem; }
	.aisles-observe__tag { flex:none; min-width:4.5rem; border:1px solid #8696b6; color:#344a80; padding:.12rem .28rem; font-size:.57rem; font-weight:900; text-align:center; text-transform:uppercase; }
	.aisles-observe__tag--rules { border-color:#6d89cf; color:#1c4cab; }
	.aisles-observe__tag--model { border-color:#d2978e; color:#963a2e; }
	.aisles-observe__boundary { border-bottom:1px solid var(--observe-line); background:#fff8ed; padding:.75rem .8rem; }
	.aisles-observe__boundary h3, .aisles-observe__boundary p { margin:0; }
	.aisles-observe__boundary h3 { font-size:.7rem; }
	.aisles-observe__boundary p { margin-top:.3rem; color:#5f4b35; }
	.aisles-observe__boundary a { display:inline-flex; align-items:center; margin-top:.55rem; }
	.aisles-observe__footer { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.7rem .8rem; }
	.aisles-observe__footer p { margin:0; color:var(--observe-muted); font-size:.62rem; }
	.aisles-observe__footer a { display:inline-flex; flex:none; align-items:center; }
	:global(body.aisles-observe-zone-map [data-aisles-zone-instance]) { position:relative !important; outline:2px solid #315cc9 !important; outline-offset:-2px; }
	:global(body.aisles-observe-zone-map [data-aisles-authority='model']) { outline-color:#b94a3b !important; }
	:global(body.aisles-observe-zone-map [data-aisles-authority='fixed']) { outline-color:#667796 !important; }
	:global(body.aisles-observe-zone-map [data-aisles-zone-instance]::before) { content:attr(data-aisles-zone-label) ' · ' attr(data-aisles-authority); position:absolute; top:0; left:0; z-index:60; max-width:calc(100% - .5rem); overflow:hidden; background:#17213b; color:#fff; padding:.2rem .35rem; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.6rem; font-weight:800; line-height:1.2; text-overflow:ellipsis; white-space:nowrap; pointer-events:none; }
	@media (max-width: 640px) { .aisles-observe { right:.65rem; bottom:.65rem; width:calc(100vw - 1.3rem); max-height:62vh; } .aisles-observe--collapsed { left:.65rem; width:auto; } .aisles-observe__facts { grid-template-columns:1fr; } .aisles-observe__footer { align-items:flex-start; flex-direction:column; } }
	@media (prefers-reduced-motion: reduce) { .aisles-observe *, .aisles-observe *::before, .aisles-observe *::after { scroll-behavior:auto !important; transition:none !important; } }
</style>
