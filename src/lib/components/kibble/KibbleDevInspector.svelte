<script lang="ts">
	import { onMount } from 'svelte';
	import { getEmitter } from '$lib/signals/emitter';
	import {
		KIBBLE_INSPECTOR_PERSONAS,
		describeKibbleRehearsalStatus,
		isKibbleInspectorInference,
		redactInspectorDebugValue,
		sanitizeInspectorInference,
		type KibbleDevInspectorData,
		type KibbleInspectorInference,
		type KibbleInspectorPersona,
		type KibbleInspectorProductSummary,
		type KibbleInspectorZone,
		type KibbleLivePreviewStatus,
	} from './kibble-dev-inspector';

	let {
		inspector,
		livePreview = { state: 'waiting' },
	}: {
		inspector: KibbleDevInspectorData;
		livePreview?: KibbleLivePreviewStatus;
	} = $props();
	let liveInference = $state<KibbleInspectorInference | null>(null);
	let rehearsalPersona = $state<KibbleInspectorPersona | null>(null);
	let rehearsalQueued = $state(false);
	let rehearsalError = $state<string | null>(null);
	let rehearsalGeneration = 0;
	const safeInspectorInference = $derived(sanitizeInspectorInference(inspector.inference));
	const currentInference = $derived(liveInference ?? safeInspectorInference);
	const syntheticScenario = $derived.by(() => {
		const synthetic = inspector.provenance?.synthetic;
		return !!synthetic && typeof synthetic === 'object' && !Array.isArray(synthetic)
			&& (synthetic as Record<string, unknown>).value === true;
	});
	const rehearsalSignals: ReadonlyArray<{ persona: KibbleInspectorPersona; query: string }> = [
		{ persona: 'gatherer', query: 'cozy inspiration ideas' },
		{ persona: 'hunter', query: 'budget sale discount' },
		{ persona: 'researcher', query: 'compare best reviews' },
		{ persona: 'gifter', query: 'birthday gift present' },
	];

	$effect(() => {
		liveInference = safeInspectorInference;
	});

	onMount(() => {
		const onInferenceUpdate = (event: Event) => {
			const detail = event instanceof CustomEvent ? event.detail : null;
			const candidate = detail && typeof detail === 'object' && 'inference' in detail
				? detail.inference
				: detail;
			if (!isKibbleInspectorInference(candidate)) return;
			liveInference = sanitizeInspectorInference(candidate);
		};
		window.addEventListener('aisles-inference-update', onInferenceUpdate);
		return () => {
			rehearsalGeneration += 1;
			window.removeEventListener('aisles-inference-update', onInferenceUpdate);
		};
	});

	const percent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
	const callStatus = (zone: KibbleInspectorZone) => zone.modelCallStatus ?? { calls: 0, authorized: false };
	const productNames = (products: readonly KibbleInspectorProductSummary[] | undefined) =>
		products?.map((product) => product.variant ? `${product.name} (${product.variant})` : product.name).join(' → ') ?? '—';
	const raw = (value: unknown) => JSON.stringify(redactInspectorDebugValue(value), null, 2);
	const previewMessage = (status: KibbleLivePreviewStatus) => {
		if (status.state === 'updating') return 'updating preview';
		if (status.state === 'applied') return `preview applied for ${status.persona}`;
		if (status.state === 'failed') return 'preview failed; last approved shelf retained';
		return 'waiting for a signal';
	};
	const rehearsalStatus = $derived(describeKibbleRehearsalStatus(rehearsalPersona, livePreview, rehearsalQueued, rehearsalError));
	const sendRehearsalSignal = async (signal: (typeof rehearsalSignals)[number]) => {
		const emitter = getEmitter();
		if (!emitter) {
			rehearsalPersona = null;
			rehearsalQueued = false;
			rehearsalError = 'Signal emitter unavailable; no event was sent.';
			return;
		}
		const generation = ++rehearsalGeneration;
		rehearsalError = null;
		rehearsalPersona = signal.persona;
		rehearsalQueued = true;
		try {
			await emitter.emitConfirmed('nav.search', { query: signal.query });
			if (generation !== rehearsalGeneration) return;
			rehearsalQueued = false;
		} catch (error) {
			if (generation !== rehearsalGeneration) return;
			rehearsalQueued = false;
			const reason = error instanceof Error ? error.message : 'Signal confirmation failed.';
			rehearsalError = `Signal ${signal.persona} was not confirmed. ${reason}`;
		}
	};
	const viewChangedShelf = (event: MouseEvent) => {
		event.preventDefault();
		const shelf = document.getElementById('kibble-featured-shelf');
		if (!shelf) return;
		window.history.replaceState(null, '', '#kibble-featured-shelf');
		shelf.scrollIntoView({ block: 'start' });
		shelf.focus({ preventScroll: true });
	};
</script>

<aside class="kc-dev-inspector" aria-labelledby="kibble-dev-inspector-title">
	<header class="kc-dev-inspector__header">
		<div>
			<p class="kc-dev-inspector__eyebrow">Local development only</p>
			<h2 id="kibble-dev-inspector-title">Dev Mode — Kibble decision inspector</h2>
		</div>
		<p class="kc-dev-inspector__surface">{inspector.surface}</p>
	</header>

	<section class="kc-dev-inspector__summary" aria-label="Inference summary">
		<div class="kc-dev-inspector__inference-heading">
			<div>
				<p class="kc-dev-inspector__label">Inferred persona</p>
				<p class="kc-dev-inspector__persona">{currentInference.primary}</p>
			</div>
			<p class="kc-dev-inspector__confidence">{percent(currentInference.confidence)} confidence gap · {currentInference.dominantSource}</p>
		</div>

		<div class="kc-dev-inspector__probabilities" aria-label="Persona probabilities">
			{#each KIBBLE_INSPECTOR_PERSONAS as persona}
				<div class:kc-dev-inspector__probability--primary={persona === currentInference.primary} class="kc-dev-inspector__probability">
					<span>{persona}</span>
					<div class="kc-dev-inspector__bar" aria-hidden="true"><span style={`width: ${percent(currentInference.probabilities[persona])}`}></span></div>
					<strong>{percent(currentInference.probabilities[persona])}</strong>
				</div>
			{/each}
		</div>

		<div class="kc-dev-inspector__metrics">
			<span><b>{currentInference.signalCount}</b> signals</span>
			<span><b>{currentInference.ruleMatches.length}</b> rules</span>
			<span>price {percent(currentInference.modifiers.priceSensitivity)}</span>
			<span>urgency {percent(currentInference.modifiers.urgency)}</span>
			<span>familiarity {percent(currentInference.modifiers.familiarityWithStore)}</span>
			{#if currentInference.shift.detected}
				<span class="kc-dev-inspector__shift">shift {currentInference.shift.from ?? 'prior'} → {currentInference.primary}</span>
			{/if}
		</div>

		<p class="kc-dev-inspector__notice">
			<b>Live shelf preview:</b> {previewMessage(livePreview)}. Production applies decisions on a route boundary; this live change is a development preview.
		</p>
	</section>

	<section class="kc-dev-inspector__facts" aria-label="Policy and reference facts">
		<div><span>preset</span><b>{inspector.preset}</b></div>
		<div><span>policy</span><b>{inspector.policyVersion}</b></div>
		<div><span>policy publication mode</span><b>{inspector.publicationMode}</b><small>automatic inside this policy; not deployment status</small></div>
		<div><span>reference</span><b>{inspector.reference.id}@{inspector.reference.version}</b></div>
		<div><span>data source</span><b>{inspector.dataSourceLabel}</b></div>
	</section>

	<section class="kc-dev-inspector__scenarios" aria-labelledby="kibble-dev-scenarios">
		<h3 id="kibble-dev-scenarios">Route-boundary scenario</h3>
		<p>Explicit intent adds one deterministic request signal on navigation. It does not change policy authority.</p>
		<nav aria-label="Intent scenarios">
			{#each KIBBLE_INSPECTOR_PERSONAS as persona}
				<a href={`?dev=true&intent=${persona}`}>{persona}</a>
			{/each}
		</nav>
	</section>

	{#if syntheticScenario}
		<section class="kc-dev-inspector__rehearsal" aria-labelledby="kibble-dev-live-rehearsal">
			<h3 id="kibble-dev-live-rehearsal">Live synthetic signal rehearsal</h3>
			<p>Each button sends one allowed <code>nav.search</code> event through the actual signal endpoint. No model is called, and this is not a shopper control.</p>
			<div class="kc-dev-inspector__rehearsal-actions">
				{#each rehearsalSignals as signal}
					<button type="button" disabled={rehearsalQueued || livePreview.state === 'updating'} onclick={() => sendRehearsalSignal(signal)}>Signal {signal.persona}</button>
				{/each}
			</div>
			<p class="kc-dev-inspector__rehearsal-status" aria-live="polite" aria-atomic="true">{rehearsalStatus}</p>
			{#if !rehearsalQueued && !rehearsalError && livePreview.state === 'applied' && livePreview.changed}
				<a class="kc-dev-inspector__view-shelf" href="#kibble-featured-shelf" onclick={viewChangedShelf}>View changed shelf</a>
			{/if}
		</section>
	{/if}

	<section class="kc-dev-inspector__zones" aria-labelledby="kibble-dev-zones">
		<div class="kc-dev-inspector__section-heading">
			<h3 id="kibble-dev-zones">Ordered zones</h3>
			<span>{inspector.zones.length} recipe slots</span>
		</div>
		<ol>
			{#each inspector.zones as zone, index (zone.id)}
				{@const modelStatus = callStatus(zone)}
				<li class="kc-dev-inspector__zone">
					<div class="kc-dev-inspector__zone-header">
						<span class="kc-dev-inspector__ordinal">{index + 1}</span>
						<div>
							<h4>{zone.label}</h4>
							<p>{zone.id}</p>
						</div>
						<span class={`kc-dev-inspector__authority kc-dev-inspector__authority--${zone.authority}`}>{zone.authority === 'fixed' ? 'Fixed' : zone.authority === 'rules' ? 'Rules' : 'Model'}</span>
						<span class:kc-dev-inspector__changed={zone.changed} class="kc-dev-inspector__change">{zone.changed ? 'changed' : 'no change'}</span>
					</div>
					<dl>
						<div><dt>variant</dt><dd>{zone.componentVariant}</dd></div>
						<div><dt>capabilities</dt><dd>{zone.capabilities.length ? zone.capabilities.join(', ') : 'none'}</dd></div>
						<div><dt>decision</dt><dd>{zone.decisionSummary}</dd></div>
						<div><dt>model status</dt><dd>{modelStatus.calls} model call{modelStatus.calls === 1 ? '' : 's'} · {modelStatus.authorized ? 'Authorized' : 'Not authorized in Preserve'}</dd></div>
					</dl>
					{#if zone.inputProducts || zone.outputProducts}
						<div class="kc-dev-inspector__product-order">
							<p><b>input order</b> {productNames(zone.inputProducts)}</p>
							<p><b>output order</b> {productNames(zone.outputProducts)}</p>
						</div>
					{/if}
					{#if zone.decision}
						<details>
							<summary>Raw zone decision JSON</summary>
							<pre>{raw(zone.decision)}</pre>
						</details>
					{/if}
				</li>
			{/each}
		</ol>
	</section>

	<details class="kc-dev-inspector__rules">
		<summary>Fired rules ({currentInference.ruleMatches.length})</summary>
		{#if currentInference.ruleMatches.length}
			<div class="kc-dev-inspector__table-wrap">
				<table>
					<thead><tr><th>rule</th><th>reason</th><th>weight</th><th>adjustment</th></tr></thead>
					<tbody>
						{#each currentInference.ruleMatches as rule}
							<tr><td>{rule.ruleName}</td><td>{rule.reason}</td><td>{rule.weight.toFixed(2)}</td><td>{Object.entries(rule.adjustment).map(([key, value]) => `${key}: ${value}`).join(', ') || '—'}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p>No deterministic rules fired.</p>
		{/if}
	</details>

	<details class="kc-dev-inspector__raw">
		<summary>Raw provenance and decision JSON</summary>
		<pre>{raw({ provenance: inspector.provenance ?? {}, inference: currentInference, zones: inspector.zones.map(({ decision, ...zone }) => ({ ...zone, decision })) })}</pre>
	</details>
</aside>

<style>
	.kc-dev-inspector { --dev-ink:#17213b; --dev-muted:#56617a; --dev-border:#cdd7ea; --dev-panel:#f6f8fd; --dev-blue:#315cc9; --dev-green:#08745d; --dev-amber:#9a6100; margin:1.25rem auto; max-width:1280px; max-height:75vh; overflow:auto; border:1px solid var(--dev-border); background:var(--dev-panel); color:var(--dev-ink); font-family:var(--kc-font-machinery, ui-monospace, SFMono-Regular, Menlo, monospace); font-size:.8rem; line-height:1.45; }
	.kc-dev-inspector *, .kc-dev-inspector *::before, .kc-dev-inspector *::after { box-sizing:border-box; }
	.kc-dev-inspector__header, .kc-dev-inspector__summary, .kc-dev-inspector__facts, .kc-dev-inspector__scenarios, .kc-dev-inspector__rehearsal, .kc-dev-inspector__zones, .kc-dev-inspector__rules, .kc-dev-inspector__raw { padding:1rem 1.125rem; }
	.kc-dev-inspector__header { position:sticky; top:0; z-index:2; display:flex; align-items:start; justify-content:space-between; gap:1rem; border-bottom:1px solid var(--dev-border); background:#e8eefb; }
	.kc-dev-inspector__eyebrow, .kc-dev-inspector h2, .kc-dev-inspector h3, .kc-dev-inspector h4, .kc-dev-inspector p { margin:0; }
	.kc-dev-inspector__eyebrow, .kc-dev-inspector__label, .kc-dev-inspector__facts span, .kc-dev-inspector dt { color:var(--dev-muted); font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
	.kc-dev-inspector h2 { margin-top:.2rem; font-size:.95rem; letter-spacing:-.02em; }
	.kc-dev-inspector__surface { color:var(--dev-blue); font-weight:700; }
	.kc-dev-inspector__summary { border-bottom:1px solid var(--dev-border); background:#fff; }
	.kc-dev-inspector__inference-heading, .kc-dev-inspector__section-heading, .kc-dev-inspector__zone-header { display:flex; align-items:center; justify-content:space-between; gap:.75rem; }
	.kc-dev-inspector__persona { margin-top:.1rem !important; font-size:1.15rem; font-weight:800; }
	.kc-dev-inspector__confidence { color:var(--dev-muted); }
	.kc-dev-inspector__probabilities { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:.625rem; margin-top:.8rem; }
	.kc-dev-inspector__probability { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:.4rem; color:var(--dev-muted); }
	.kc-dev-inspector__probability--primary { color:var(--dev-ink); font-weight:700; }
	.kc-dev-inspector__bar { height:.4rem; overflow:hidden; background:#dce4f2; }
	.kc-dev-inspector__bar span { display:block; height:100%; background:#8294bd; }
	.kc-dev-inspector__probability--primary .kc-dev-inspector__bar span { background:var(--dev-blue); }
	.kc-dev-inspector__metrics { display:flex; flex-wrap:wrap; gap:.35rem 1rem; margin-top:.8rem; color:var(--dev-muted); }
	.kc-dev-inspector__metrics b { color:var(--dev-ink); }
	.kc-dev-inspector__shift { color:#8a2d00; font-weight:700; }
	.kc-dev-inspector__notice { margin-top:.8rem !important; padding:.55rem .65rem; border-left:3px solid var(--dev-amber); background:#fff7e6; color:#704800; }
	.kc-dev-inspector__facts { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:.75rem; border-bottom:1px solid var(--dev-border); }
	.kc-dev-inspector__facts div { min-width:0; }
	.kc-dev-inspector__facts span, .kc-dev-inspector__facts b { display:block; overflow-wrap:anywhere; }
	.kc-dev-inspector__facts small { display:block; margin-top:.2rem; color:var(--dev-muted); font-size:.68rem; line-height:1.35; }
	.kc-dev-inspector__facts b { margin-top:.2rem; font-size:.7rem; }
	.kc-dev-inspector__scenarios { border-bottom:1px solid var(--dev-border); }
	.kc-dev-inspector__rehearsal { border-bottom:1px solid var(--dev-border); background:#edf8f4; }
	.kc-dev-inspector h3 { font-size:.78rem; }
	.kc-dev-inspector__scenarios p, .kc-dev-inspector__rehearsal p { margin-top:.3rem; color:var(--dev-muted); }
	.kc-dev-inspector__scenarios nav { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.65rem; }
	.kc-dev-inspector__rehearsal-actions { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.65rem; }
	.kc-dev-inspector a, .kc-dev-inspector button { display:inline-flex; min-height:44px; align-items:center; border:1px solid #aebee1; background:#fff; color:#1c4cab; font:inherit; font-weight:700; padding:.45rem .65rem; text-decoration:none; }
	.kc-dev-inspector button { cursor:pointer; border-color:#78ae9f; color:#075d4c; }
	.kc-dev-inspector button:disabled { cursor:wait; opacity:.55; }
	.kc-dev-inspector a:hover { background:#e8eefb; }
	.kc-dev-inspector button:hover { background:#ddf1ea; }
	.kc-dev-inspector a:focus-visible, .kc-dev-inspector button:focus-visible, .kc-dev-inspector summary:focus-visible { outline:3px solid var(--dev-blue); outline-offset:3px; }
	.kc-dev-inspector__rehearsal-status { font-weight:700; }
	.kc-dev-inspector__view-shelf { margin-top:.55rem; }
	.kc-dev-inspector__zones ol { display:grid; gap:.65rem; margin:.7rem 0 0; padding:0; list-style:none; }
	.kc-dev-inspector__zone { border:1px solid var(--dev-border); background:#fff; padding:.75rem; }
	.kc-dev-inspector__ordinal { color:var(--dev-muted); font-weight:700; }
	.kc-dev-inspector h4 { font-size:.76rem; }
	.kc-dev-inspector__zone-header p { color:var(--dev-muted); font-size:.65rem; }
	.kc-dev-inspector__authority, .kc-dev-inspector__change { border:1px solid var(--dev-border); padding:.15rem .35rem; color:var(--dev-muted); font-size:.65rem; font-weight:800; text-transform:uppercase; }
	.kc-dev-inspector__authority--fixed { border-color:#8d9cc2; color:#344a80; }
	.kc-dev-inspector__authority--rules { border-color:#7bb8a9; color:var(--dev-green); }
	.kc-dev-inspector__authority--model { border-color:#d3a466; color:var(--dev-amber); }
	.kc-dev-inspector__changed { border-color:#7bb8a9; color:var(--dev-green); }
	.kc-dev-inspector dl { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:.55rem; margin:.7rem 0 0; }
	.kc-dev-inspector dd { margin:.12rem 0 0; overflow-wrap:anywhere; }
	.kc-dev-inspector__product-order { display:grid; gap:.3rem; margin-top:.7rem; padding:.55rem .65rem; background:#f4f7fc; color:var(--dev-muted); }
	.kc-dev-inspector__product-order b { color:var(--dev-ink); }
	.kc-dev-inspector details { margin-top:.7rem; }
	.kc-dev-inspector summary { cursor:pointer; color:#1c4cab; font-weight:800; }
	.kc-dev-inspector pre { max-height:18rem; margin:.55rem 0 0; overflow:auto; padding:.7rem; background:#111a2e; color:#e5ecff; font-size:.67rem; white-space:pre-wrap; overflow-wrap:anywhere; }
	.kc-dev-inspector__rules, .kc-dev-inspector__raw { border-top:1px solid var(--dev-border); }
	.kc-dev-inspector__rules > p { margin-top:.5rem; color:var(--dev-muted); }
	.kc-dev-inspector__table-wrap { overflow-x:auto; margin-top:.6rem; }
	.kc-dev-inspector table { width:100%; border-collapse:collapse; text-align:left; }
	.kc-dev-inspector th, .kc-dev-inspector td { border-bottom:1px solid var(--dev-border); padding:.45rem; vertical-align:top; }
	.kc-dev-inspector th { color:var(--dev-muted); font-size:.64rem; text-transform:uppercase; }
	@media (max-width: 760px) { .kc-dev-inspector { margin-inline:.75rem; } .kc-dev-inspector__probabilities, .kc-dev-inspector__facts, .kc-dev-inspector dl { grid-template-columns:repeat(2, minmax(0, 1fr)); } .kc-dev-inspector__header, .kc-dev-inspector__inference-heading, .kc-dev-inspector__zone-header { align-items:flex-start; flex-wrap:wrap; } }
</style>
