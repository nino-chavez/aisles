<script lang="ts">
	import { afterNavigate, replaceState } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { buildObserveSessionHref } from '$lib/signals/observe-session-link';
	import KibbleDevInspectorLauncher from './KibbleDevInspectorLauncher.svelte';
	import { describeKibbleDecisionDimensions, hasKibbleDecisionChanged, type KibbleDecisionEvidence, type KibbleInspectorPersona, type KibbleLivePreviewStatus, type KibblePresentationChange } from './kibble-dev-inspector';
	import { KIBBLE_CART_PRESENTATION_POLICY, KIBBLE_CHECKOUT_PRESENTATION_POLICY, KIBBLE_HOME_PRESENTATION_POLICY, KIBBLE_PDP_PRESENTATION_POLICY, KIBBLE_PLP_PRESENTATION_POLICY, KIBBLE_SEARCH_PRESENTATION_POLICY } from '$lib/brand/reference/kibble-presentation-decisions';
	import { KIBBLE_DEMO_ACTION_COOLDOWN_MS } from '$lib/kibble-demo-ai-boundary';
	import { describeKibblePdpModelAction, type KibblePdpModelActionStatus } from './kibble-pdp-model-action';
	import { describeKibblePlpModelAction, type KibblePlpModelActionStatus } from './kibble-plp-model-action';
	import type { KibbleMerchantCapabilityCoverage } from '$lib/brand/reference/kibble-catalog-enrichment';

	type ZoneAuthority = 'fixed' | 'rules' | 'model';
	type ZoneEvidence = {
		instanceId: string;
		label: string;
		authority: ZoneAuthority;
		modelCalls: number;
		modelEligible: boolean;
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
		capabilityCoverage = null,
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
		capabilityCoverage?: KibbleMerchantCapabilityCoverage | null;
	} = $props();

	let expanded = $state(true);
	let showZones = $state(true);
	let zones = $state<ZoneEvidence[]>([]);
	let persona = $state<string | null>(null);
	let homeModelActionEligible = $state(false);
	let homeModelActionReady = $state(false);
	let homeModelActionStatus = $state<KibblePdpModelActionStatus>('idle');
	let pdpModelActionEligible = $state(false);
	let pdpModelActionReady = $state(false);
	let pdpModelActionStatus = $state<KibblePdpModelActionStatus>('idle');
	let plpModelActionEligible = $state(false);
	let plpModelActionReady = $state(false);
	let plpModelActionStatus = $state<KibblePlpModelActionStatus>('idle');
	let searchModelActionEligible = $state(false);
	let searchModelActionReady = $state(false);
	let searchModelActionStatus = $state<KibblePdpModelActionStatus>('idle');
	let cartModelActionEligible = $state(false);
	let cartModelActionReady = $state(false);
	let cartModelActionStatus = $state<KibblePdpModelActionStatus>('idle');
	let checkoutModelActionEligible = $state(false);
	let checkoutModelActionReady = $state(false);
	let checkoutModelActionStatus = $state<KibblePdpModelActionStatus>('idle');
	let modelActionCooldownUntil = $state(0);
	let clockNow = $state(0);
	let decisionEvidence = $state<KibbleDecisionEvidence | null>(null);
	const pdpModelAction = $derived(describeKibblePdpModelAction(pdpModelActionStatus));
	const plpModelAction = $derived(describeKibblePlpModelAction(plpModelActionStatus));
	const homeModelAction = $derived(describeHomeModelAction(homeModelActionStatus));
	const searchModelAction = $derived(describeNarrowModelAction('search', searchModelActionStatus));
	const cartModelAction = $derived(describeNarrowModelAction('cart', cartModelActionStatus));
	const checkoutModelAction = $derived(describeNarrowModelAction('checkout', checkoutModelActionStatus));
	const visiblePersona = $derived(persona ?? initialPersona);
	const observeHref = $derived(buildObserveSessionHref(sessionId));
	const templateCount = $derived(zones.filter(({ authority }) => authority === 'fixed').length);
	const rulesCount = $derived(zones.filter(({ authority }) => authority === 'rules').length);
	const modelCallCount = $derived(decisionEvidence?.calls ?? Math.max(0, ...zones.map(({ modelCalls }) => modelCalls)));
	const surfaceLabel = $derived(labelFromId(surface));
	const surfaceLatitude = $derived(latitudeForSurface(surface));
	const cooldownRemainingSeconds = $derived(Math.max(0, Math.ceil((modelActionCooldownUntil - clockNow) / 1000)));
	const modelActionEligible = $derived(
		surface === 'home' ? homeModelActionEligible : surface === 'pdp' ? pdpModelActionEligible : surface === 'plp' ? plpModelActionEligible : surface === 'search' ? searchModelActionEligible : surface === 'cart' ? cartModelActionEligible : surface === 'checkout' ? checkoutModelActionEligible : false,
	);
	const modelReadyCount = $derived(modelActionEligible ? readyZoneIds(surface).length : 0);
	const modelActionReady = $derived(
		surface === 'home' ? homeModelActionReady : surface === 'pdp' ? pdpModelActionReady : surface === 'plp' ? plpModelActionReady : surface === 'search' ? searchModelActionReady : surface === 'cart' ? cartModelActionReady : surface === 'checkout' ? checkoutModelActionReady : false,
	);
	const modelAction = $derived(
		surface === 'home' ? homeModelAction : surface === 'pdp' ? pdpModelAction : surface === 'plp' ? plpModelAction : surface === 'search' ? searchModelAction : surface === 'cart' ? cartModelAction : surface === 'checkout' ? checkoutModelAction : null,
	);
	const modelZoneCount = $derived(zones.filter(({ authority, modelCalls }) => authority === 'model' && modelCalls > 0).length);
	const modelActionStatus = $derived(
		surface === 'home' ? homeModelActionStatus : surface === 'pdp' ? pdpModelActionStatus : surface === 'plp' ? plpModelActionStatus : surface === 'search' ? searchModelActionStatus : surface === 'cart' ? cartModelActionStatus : surface === 'checkout' ? checkoutModelActionStatus : 'idle',
	);
	const railSummary = $derived(
		modelActionStatus === 'updating' ? `${surfaceLabel} · AI running` : decisionEvidence?.state === 'failed' ? `${surfaceLabel} · AI failed · fallback` : decisionEvidence?.state === 'applied' ? `${surfaceLabel} · ${hasKibbleDecisionChanged(decisionEvidence) ? 'AI changed' : 'AI kept'}` : modelCallCount > 0 ? `${surfaceLabel} · AI evidence missing` : modelReadyCount > 0 ? `${surfaceLabel} · AI ready` : `${surfaceLabel} · Template and rules`,
	);

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
			const modelEligible = element.dataset.aislesModelEligible === 'true';
			const stateForZone = decisionEvidence && isDecisionZone(instanceId)
				? decisionEvidence.state === 'failed' ? 'Fallback' : hasDecisionZoneChanged(instanceId) ? 'AI changed' : 'AI kept'
				: modelActionStatus === 'updating' && modelEligible ? 'AI running' : modelCalls > 0 || authority === 'model' ? 'AI evidence missing' : modelEligible ? 'AI ready' : authority === 'rules' ? 'Rules' : 'Template';
			element.dataset.aislesObserveState = stateForZone;
			evidence.set(instanceId, {
				instanceId,
				label: element.dataset.aislesZoneLabel || labelFromId(instanceId),
				authority,
				modelCalls,
				modelEligible,
				status: element.dataset.kibbleZoneStatus || 'live',
				variant: element.dataset.kibbleZoneVariant || element.dataset.aislesVariant || 'reference-owned',
			});
		}
		homeModelActionEligible = surface === 'home' && [...evidence.values()].some(({ modelEligible }) => modelEligible);
		pdpModelActionEligible = document.querySelector('[data-aisles-pdp-model-eligible="true"]') !== null;
		plpModelActionEligible = document.querySelector('[data-aisles-plp-model-eligible="true"]') !== null;
		searchModelActionEligible = document.querySelector('[data-aisles-search-model-eligible="true"]') !== null;
		cartModelActionEligible = document.querySelector('[data-aisles-cart-model-eligible="true"]') !== null;
		checkoutModelActionEligible = document.querySelector('[data-aisles-checkout-model-eligible="true"]') !== null;
		if (!homeModelActionEligible) {
			homeModelActionStatus = 'idle';
			homeModelActionReady = false;
		}
		if (!pdpModelActionEligible) {
			pdpModelActionStatus = 'idle';
			pdpModelActionReady = false;
		}
		if (!plpModelActionEligible) { plpModelActionStatus = 'idle'; plpModelActionReady = false; }
		if (!searchModelActionEligible) { searchModelActionStatus = 'idle'; searchModelActionReady = false; }
		if (!cartModelActionEligible) { cartModelActionStatus = 'idle'; cartModelActionReady = false; }
		if (!checkoutModelActionEligible) { checkoutModelActionStatus = 'idle'; checkoutModelActionReady = false; }
		zones = [...evidence.values()];
	};

	onMount(() => {
		const storedExpanded = localStorage.getItem('aisles-observe-expanded');
		if (storedExpanded === 'false') expanded = false;
		const collapseForSignalLab = () => {
			if (window.location.hash === '#kibble-signal-lab') expanded = false;
		};
		collapseForSignalLab();
		const storedZones = localStorage.getItem('aisles-observe-zones-v2');
		showZones = storedZones === null ? true : storedZones === 'true';
		clockNow = Date.now();
		const clock = window.setInterval(() => { clockNow = Date.now(); }, 1_000);
		void tick().then(scanZones);
		const observer = new MutationObserver(scanZones);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [
				'data-aisles-zone-instance', 'data-aisles-zone-label', 'data-aisles-authority',
				'data-aisles-model-calls', 'data-kibble-zone-instance', 'data-kibble-zone-status',
				'data-aisles-model-eligible',
				'data-aisles-pdp-model-eligible',
				'data-aisles-plp-model-eligible',
				'data-aisles-search-model-eligible',
				'data-aisles-cart-model-eligible',
				'data-aisles-checkout-model-eligible',
			],
		});
		const onInferenceUpdate = (event: Event) => {
			const detail = event instanceof CustomEvent ? event.detail : null;
			const inference = detail && typeof detail === 'object' && 'inference' in detail ? detail.inference : detail;
			if (inference && typeof inference === 'object' && 'primary' in inference && typeof inference.primary === 'string') {
				persona = inference.primary as KibbleInspectorPersona;
			}
		};
		const onHomeModelStatus = (event: Event) => applyModelStatus(event, 'home');
		const onHomeModelReady = () => { homeModelActionReady = true; };
		const onPdpModelStatus = (event: Event) => applyModelStatus(event, 'pdp');
		const onPdpModelReady = () => { pdpModelActionReady = true; };
		const onPlpModelStatus = (event: Event) => applyModelStatus(event, 'plp');
		const onPlpModelReady = () => { plpModelActionReady = true; };
		const onSearchModelStatus = (event: Event) => applyModelStatus(event, 'search');
		const onSearchModelReady = () => { searchModelActionReady = true; };
		const onCartModelStatus = (event: Event) => applyModelStatus(event, 'cart');
		const onCartModelReady = () => { cartModelActionReady = true; };
		const onCheckoutModelStatus = (event: Event) => applyModelStatus(event, 'checkout');
		const onCheckoutModelReady = () => { checkoutModelActionReady = true; };
		window.addEventListener('hashchange', collapseForSignalLab);
		window.addEventListener('aisles-inference-update', onInferenceUpdate);
		window.addEventListener('aisles-kibble-home-model-status', onHomeModelStatus);
		window.addEventListener('aisles-kibble-home-model-ready', onHomeModelReady);
		window.addEventListener('aisles-kibble-pdp-model-status', onPdpModelStatus);
		window.addEventListener('aisles-kibble-pdp-model-ready', onPdpModelReady);
		window.addEventListener('aisles-kibble-plp-model-status', onPlpModelStatus);
		window.addEventListener('aisles-kibble-plp-model-ready', onPlpModelReady);
		window.addEventListener('aisles-kibble-search-model-status', onSearchModelStatus);
		window.addEventListener('aisles-kibble-search-model-ready', onSearchModelReady);
		window.addEventListener('aisles-kibble-cart-model-status', onCartModelStatus);
		window.addEventListener('aisles-kibble-cart-model-ready', onCartModelReady);
		window.addEventListener('aisles-kibble-checkout-model-status', onCheckoutModelStatus);
		window.addEventListener('aisles-kibble-checkout-model-ready', onCheckoutModelReady);
		return () => {
			window.clearInterval(clock);
			observer.disconnect();
			window.removeEventListener('hashchange', collapseForSignalLab);
			window.removeEventListener('aisles-inference-update', onInferenceUpdate);
			window.removeEventListener('aisles-kibble-home-model-status', onHomeModelStatus);
			window.removeEventListener('aisles-kibble-home-model-ready', onHomeModelReady);
			window.removeEventListener('aisles-kibble-pdp-model-status', onPdpModelStatus);
			window.removeEventListener('aisles-kibble-pdp-model-ready', onPdpModelReady);
			window.removeEventListener('aisles-kibble-plp-model-status', onPlpModelStatus);
			window.removeEventListener('aisles-kibble-plp-model-ready', onPlpModelReady);
			window.removeEventListener('aisles-kibble-search-model-status', onSearchModelStatus);
			window.removeEventListener('aisles-kibble-search-model-ready', onSearchModelReady);
			window.removeEventListener('aisles-kibble-cart-model-status', onCartModelStatus);
			window.removeEventListener('aisles-kibble-cart-model-ready', onCartModelReady);
			window.removeEventListener('aisles-kibble-checkout-model-status', onCheckoutModelStatus);
			window.removeEventListener('aisles-kibble-checkout-model-ready', onCheckoutModelReady);
		};
	});

	afterNavigate(({ to }) => {
		if (to?.url.hash === '#kibble-signal-lab') expanded = false;
		// Each navigation replaces the lazy page listener. Reset every readiness
		// bit before the new page can announce its handshake; otherwise a stale
		// Home/PDP bit can enable a button while no listener is attached.
		homeModelActionReady = false;
		homeModelActionStatus = 'idle';
		pdpModelActionReady = false;
		pdpModelActionStatus = 'idle';
		plpModelActionReady = false;
		plpModelActionStatus = 'idle';
		searchModelActionReady = false;
		searchModelActionStatus = 'idle';
		cartModelActionReady = false;
		cartModelActionStatus = 'idle';
		checkoutModelActionReady = false;
		checkoutModelActionStatus = 'idle';
		modelActionCooldownUntil = 0;
		decisionEvidence = null;
		void tick().then(scanZones);
	});

	function applyModelStatus(event: Event, statusSurface: 'home' | 'pdp' | 'plp' | 'search' | 'cart' | 'checkout') {
		const detail = event instanceof CustomEvent ? event.detail : null;
		const status = isLivePreviewStatus(detail) ? detail : null;
		if (!status || (status.mode && status.mode !== 'model')) return;
		if (statusSurface === 'home') homeModelActionStatus = status.state === 'waiting' ? 'idle' : status.state;
		if (statusSurface === 'pdp') pdpModelActionStatus = status.state === 'waiting' ? 'idle' : status.state;
		if (statusSurface === 'plp') plpModelActionStatus = status.state === 'waiting' ? 'idle' : status.state;
		if (statusSurface === 'search') searchModelActionStatus = status.state === 'waiting' ? 'idle' : status.state;
		if (statusSurface === 'cart') cartModelActionStatus = status.state === 'waiting' ? 'idle' : status.state;
		if (statusSurface === 'checkout') checkoutModelActionStatus = status.state === 'waiting' ? 'idle' : status.state;
		if ('persona' in status && status.persona) persona = status.persona;
		if (status.evidence) decisionEvidence = status.evidence;
		void tick().then(scanZones);
	}

	function isLivePreviewStatus(value: unknown): value is KibbleLivePreviewStatus {
		return !!value && typeof value === 'object' && 'state' in value && ['waiting', 'updating', 'applied', 'failed'].includes(String(value.state));
	}

	function toggleExpanded() {
		expanded = !expanded;
		localStorage.setItem('aisles-observe-expanded', String(expanded));
	}

	function toggleZones() {
		showZones = !showZones;
		localStorage.setItem('aisles-observe-zones-v2', String(showZones));
	}

	function requestPdpModelDecision() {
		if (!pdpModelActionEligible || !pdpModelActionReady || pdpModelAction.disabled || cooldownRemainingSeconds > 0) return;
		startActionCooldown();
		pdpModelActionStatus = 'updating';
		window.dispatchEvent(new CustomEvent('aisles-kibble-pdp-model-request'));
	}

	function requestHomeModelDecision() {
		if (!homeModelActionEligible || !homeModelActionReady || homeModelAction.disabled || cooldownRemainingSeconds > 0) return;
		startActionCooldown();
		homeModelActionStatus = 'updating';
		window.dispatchEvent(new CustomEvent('aisles-kibble-model-request'));
	}

	function requestPlpModelDecision() {
		if (!plpModelActionEligible || !plpModelActionReady || plpModelAction.disabled || cooldownRemainingSeconds > 0) return;
		startActionCooldown();
		plpModelActionStatus = 'updating';
		window.dispatchEvent(new CustomEvent('aisles-kibble-plp-model-request'));
	}

	function requestNarrowModelDecision(actionSurface: 'search' | 'cart' | 'checkout') {
		if (!modelActionEligible || !modelActionReady || modelAction?.disabled || cooldownRemainingSeconds > 0) return;
		startActionCooldown();
		if (actionSurface === 'search') searchModelActionStatus = 'updating';
		if (actionSurface === 'cart') cartModelActionStatus = 'updating';
		if (actionSurface === 'checkout') checkoutModelActionStatus = 'updating';
		window.dispatchEvent(new CustomEvent(`aisles-kibble-${actionSurface}-model-request`));
	}

	function startActionCooldown() {
		clockNow = Date.now();
		modelActionCooldownUntil = clockNow + KIBBLE_DEMO_ACTION_COOLDOWN_MS;
	}

	function requestModelDecision() {
		if (surface === 'home') requestHomeModelDecision();
		else if (surface === 'pdp') requestPdpModelDecision();
		else if (surface === 'plp') requestPlpModelDecision();
		else if (surface === 'search' || surface === 'cart' || surface === 'checkout') requestNarrowModelDecision(surface);
	}

	function describeHomeModelAction(status: KibblePdpModelActionStatus) {
		if (status === 'updating') return { label: 'AI composing presentation…', detail: 'A bounded provider action is selecting approved product, copy, component, and section decisions, with at most two attempts.', disabled: true };
		if (status === 'applied') return { label: 'Run AI presentation again', detail: decisionEvidence?.state === 'applied' ? `${describeKibbleDecisionDimensions(decisionEvidence)} View the exact before and after below.` : 'The model response returned without before-and-after evidence, so the rail does not claim success.', disabled: false };
		if (status === 'failed') return { label: 'AI presentation failed — retry', detail: 'The model result was not applied. The last approved storefront remains visible.', disabled: false };
		return { label: 'Run AI presentation', detail: 'Ready to run one bounded action with up to two provider attempts across the approved Home presentation zones.', disabled: false };
	}

	function compactModelActionLabel(status: KibblePdpModelActionStatus | KibblePlpModelActionStatus) {
		if (cooldownRemainingSeconds > 0 && status !== 'updating') return `AI again in ${cooldownRemainingSeconds}s`;
		if (status === 'updating') return 'AI running…';
		if (status === 'failed') return 'Retry AI';
		if (status === 'applied') return 'Run AI again';
		return 'Run AI';
	}

	function visibleModelActionLabel() {
		if (!modelAction) return '';
		return cooldownRemainingSeconds > 0 && modelActionStatus !== 'updating' ? `Run AI again in ${cooldownRemainingSeconds}s` : modelAction.label;
	}

	function describeNarrowModelAction(actionSurface: 'search' | 'cart' | 'checkout', status: KibblePdpModelActionStatus) {
		const noun = actionSurface === 'search' ? 'search recovery' : actionSurface === 'cart' ? 'cart recovery' : 'checkout assurance';
		const boundary = actionSurface === 'search' ? 'The result list and query stay fixed.' : actionSurface === 'cart' ? 'No cart contents, prices, or operations are created.' : 'Payment, order, and customer state stay fixed and unavailable.';
		if (status === 'updating') return { label: `AI selecting ${noun}…`, detail: `A bounded provider action is selecting one merchant-approved copy variant, with at most two attempts. ${boundary}`, disabled: true };
		if (status === 'applied') return { label: `Run AI ${noun} again`, detail: `The model selected a validated merchant-approved variant. ${boundary}`, disabled: false };
		if (status === 'failed') return { label: `AI ${noun} failed — retry`, detail: `The model result was not applied. The existing approved copy remains visible. ${boundary}`, disabled: false };
		return { label: `Run AI ${noun}`, detail: `Ready to run one bounded action with up to two provider attempts that may select one approved copy variant. ${boundary}`, disabled: false };
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
		if (value === 'plp') return 'CLP + PLP';
		if (value === 'pdp') return 'PDP';
		return value
			.replace(/^error-/, 'error ')
			.replace(/[._-]+/g, ' ')
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function latitudeForSurface(value: string): string {
		if (value === 'home') return 'wide · section, component, copy, marketing, and product order';
		if (value === 'plp') return 'medium · CLP framing, marketing, and first-eight PLP order';
		if (value === 'search') return 'narrow · zero-results recovery copy only';
		if (value === 'pdp') return 'narrow · related order, approved heading, and optional marketing';
		if (value === 'cart') return 'narrower · unavailable-cart recovery copy only';
		if (value === 'checkout') return 'narrowest · assurance copy only; transaction state fixed';
		return 'none · merchant template and deterministic rules';
	}

	function zoneState(zone: ZoneEvidence): string {
		if (decisionEvidence && isDecisionZone(zone.instanceId)) return decisionEvidence.state === 'failed' ? 'Fallback' : hasDecisionZoneChanged(zone.instanceId) ? 'AI changed' : 'AI kept';
		if (modelActionStatus === 'updating' && zone.modelEligible) return 'AI running';
		return zone.modelCalls > 0 || zone.authority === 'model' ? 'AI evidence missing' : zone.modelEligible ? 'AI ready' : zone.authority === 'fixed' ? 'Template' : 'Rules';
	}

	function tagTone(zone: ZoneEvidence): string {
		const state = zoneState(zone);
		return state === 'Template' ? 'fixed' : state === 'Rules' ? 'rules' : 'model';
	}

	function isDecisionZone(instanceId: string): boolean {
		return decisionEvidence?.zoneIds.includes(instanceId) ?? false;
	}

	function hasDecisionZoneChanged(instanceId: string): boolean {
		if (!decisionEvidence) return false;
		const productOrderChanged = decisionEvidence.moved.length > 0 || decisionEvidence.added.length > 0 || decisionEvidence.removed.length > 0;
		const changedCopy = (id: string) => decisionEvidence?.copy.some((entry) => entry.id === id && entry.changed) ?? false;
		const changedComponent = (id: string) => decisionEvidence?.components.some((entry) => entry.id === id && entry.changed) ?? false;
		const changedSection = (id: string) => decisionEvidence?.sections.some((entry) => entry.id === id && entry.changed) ?? false;
		const changedMarketing = (id: string) => decisionEvidence?.marketingBlocks.some((entry) => entry.id === id && entry.changed) ?? false;
		if (instanceId === 'home.featured-row.1') return productOrderChanged || changedCopy(instanceId) || changedSection(instanceId);
		if (instanceId === 'plp.product-ranking') return productOrderChanged;
		if (instanceId === 'pdp.related') return productOrderChanged || changedCopy('pdp.related');
		if (instanceId === 'home.hero' || instanceId === 'plp.editorial-header'
			|| instanceId === 'search.empty-state' || instanceId === 'cart.empty-state' || instanceId === 'checkout.assurance-strip') return changedCopy(instanceId);
		if (instanceId === 'home.editorial-strip') return changedCopy(instanceId) || changedComponent(instanceId);
		if (instanceId === 'plp.marketing-block' || instanceId === 'pdp.below-description') return changedMarketing(instanceId);
		return false;
	}

	function formatProducts(products: readonly { name: string }[]): string {
		return products.length ? products.map(({ name }) => name).join(' · ') : 'none';
	}

	function viewDecisionChanges() {
		if (!decisionEvidence) return;
		const changedPresentationId = [...decisionEvidence.copy, ...decisionEvidence.components, ...decisionEvidence.sections, ...decisionEvidence.marketingBlocks].find(({ changed }) => changed)?.id;
		const changedPresentation = changedPresentationId;
		const productChanged = decisionEvidence.moved.length || decisionEvidence.added.length || decisionEvidence.removed.length;
		const defaultZone = decisionEvidence.surface === 'home' ? 'home.hero'
			: decisionEvidence.surface === 'plp' ? 'plp.editorial-header'
				: decisionEvidence.surface === 'pdp' ? 'pdp.related'
					: decisionEvidence.surface === 'search' ? 'search.empty-state'
						: decisionEvidence.surface === 'cart' ? 'cart.empty-state'
							: 'checkout.assurance-strip';
		const productZone = decisionEvidence.surface === 'home' ? 'home.featured-row.1' : decisionEvidence.surface === 'plp' ? 'plp.product-ranking' : 'pdp.related';
		const instanceId = changedPresentation ?? (productChanged ? productZone : defaultZone);
		const element = [...document.querySelectorAll<HTMLElement>('[data-aisles-zone-instance]')].find((candidate) => candidate.dataset.aislesZoneInstance === instanceId);
		if (!element) return;
		if (!element.id) element.id = `kibble-${instanceId.replaceAll('.', '-')}`;
		element.setAttribute('tabindex', '-1');
		replaceState(`#${element.id}`, {});
		element.scrollIntoView({ block: 'center', behavior: 'smooth' });
		element.focus({ preventScroll: true });
	}

	function formatPresentationChanges(changes: readonly KibblePresentationChange[]): string {
		return changes.length ? changes.map(({ label, before, after, changed }) => `${label}: ${changed ? `${before} → ${after}` : `${after} (unchanged)`}`).join(' · ') : 'not enabled for this surface';
	}

	function readyZoneIds(currentSurface: string): readonly string[] {
		if (currentSurface === 'home') return KIBBLE_HOME_PRESENTATION_POLICY.zoneIds;
		if (currentSurface === 'plp') return KIBBLE_PLP_PRESENTATION_POLICY.zoneIds;
		if (currentSurface === 'pdp') return KIBBLE_PDP_PRESENTATION_POLICY.zoneIds;
		if (currentSurface === 'search') return KIBBLE_SEARCH_PRESENTATION_POLICY.zoneIds;
		if (currentSurface === 'cart') return KIBBLE_CART_PRESENTATION_POLICY.zoneIds;
		if (currentSurface === 'checkout') return KIBBLE_CHECKOUT_PRESENTATION_POLICY.zoneIds;
		return [];
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
					<h2 id="aisles-observe-title">{railSummary}</h2>
				</div>
			</div>
			<div class="aisles-observe__header-actions">
				{#if !expanded && modelActionEligible && modelAction}
					<button
						type="button"
						class="aisles-observe__model-action"
						aria-label={visibleModelActionLabel()}
						onclick={requestModelDecision}
						disabled={!modelActionReady || modelAction.disabled || cooldownRemainingSeconds > 0}
					>
						{modelActionReady ? compactModelActionLabel(modelActionStatus) : 'AI loading…'}
					</button>
				{/if}
				<button type="button" aria-expanded={expanded} aria-controls="aisles-observe-body" onclick={toggleExpanded}>
					{expanded ? 'Collapse' : 'Expand'}
				</button>
			</div>
		</header>

		<div id="aisles-observe-body" class="aisles-observe__body" hidden={!expanded}>
			<div class="aisles-observe__counts" aria-label="Visible decision authority and model evidence">
				<div><span class="aisles-observe__pip aisles-observe__pip--fixed"></span><b>Template</b><strong>{templateCount}</strong></div>
				<div><span class="aisles-observe__pip aisles-observe__pip--rules"></span><b>Rules</b><strong>{rulesCount}</strong></div>
				<div><span class="aisles-observe__pip aisles-observe__pip--ready"></span><b>AI ready</b><strong>{modelReadyCount}</strong></div>
				<div><span class="aisles-observe__pip aisles-observe__pip--model"></span><b>AI zones</b><strong>{modelZoneCount}</strong></div>
				<div><span class="aisles-observe__pip aisles-observe__pip--model"></span><b>AI calls</b><strong>{modelCallCount}</strong></div>
			</div>

			<p class="aisles-observe__truth" aria-live="polite" aria-atomic="true">
				{#if decisionEvidence?.state === 'failed'}
					AI failed. Fallback kept the existing order, copy, and presentation. The provider result was not published.
				{:else if decisionEvidence?.state === 'applied'}
					{describeKibbleDecisionDimensions(decisionEvidence)} Every visible result came from merchant-approved IDs; product facts, prices, links, actions, and styling remained merchant-owned.
				{:else if modelActionStatus === 'updating'}
					AI is running a bounded provider action with at most two attempts. The current approved presentation remains visible until every returned ID passes validation.
				{:else if modelCallCount > 0}
					A model call is recorded, but no validated before-and-after evidence is available. The rail does not claim a successful change.
				{:else if modelReadyCount > 0}
					{modelReadyCount} named {modelReadyCount === 1 ? 'zone is' : 'zones are'} ready for an explicit model action. AI zones and AI calls stay zero until validated model-selected output is rendered.
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
				<div><span>model latitude</span><b>{surfaceLatitude}</b></div>
			</div>

			<div class="aisles-observe__actions">
				<button type="button" class:aisles-observe__action--active={showZones} aria-pressed={showZones} onclick={toggleZones}>
					{showZones ? 'Hide zone map' : 'Show zone map'}
				</button>
				{#if surface === 'home'}<a href="/?observe=true#kibble-signal-lab">Open signal lab</a>{/if}
				{#if modelActionEligible && modelAction}<button type="button" class="aisles-observe__model-action" onclick={requestModelDecision} disabled={!modelActionReady || modelAction.disabled || cooldownRemainingSeconds > 0}>{modelActionReady ? visibleModelActionLabel() : 'AI control loading…'}</button>{/if}
				{#if observeHref}<a href={observeHref} target="_blank" rel="noopener">Open session in Observe <span aria-hidden="true">↗</span></a>{/if}
			</div>
			{#if modelActionEligible && modelAction}<p class="aisles-observe__truth" role="status" aria-live="polite">{cooldownRemainingSeconds > 0 && modelActionStatus !== 'updating' ? `The last call completed. Retry is available in ${cooldownRemainingSeconds} seconds so the server budget cannot reject an action the interface offered.` : modelAction.detail}</p>{/if}

			{#if decisionEvidence}
				<section class="aisles-observe__evidence" aria-labelledby="aisles-decision-evidence">
					<div class="aisles-observe__evidence-heading">
						<div>
							<h3 id="aisles-decision-evidence">Decision outcome</h3>
							<p>{decisionEvidence.zoneLabel} · {decisionEvidence.state === 'failed' ? 'Fallback retained' : describeKibbleDecisionDimensions(decisionEvidence)}</p>
						</div>
						<button type="button" onclick={viewDecisionChanges}>View changes</button>
					</div>
					<div class="aisles-observe__before-after">
						<div><span>Before</span><b>{formatProducts(decisionEvidence.before)}</b></div>
						<div><span>After</span><b>{formatProducts(decisionEvidence.after)}</b></div>
					</div>
					<div class="aisles-observe__diff" aria-label="Decision changes">
						<div><span>moved</span><b>{formatProducts(decisionEvidence.moved)}</b></div>
						<div><span>added</span><b>{formatProducts(decisionEvidence.added)}</b></div>
						<div><span>removed</span><b>{formatProducts(decisionEvidence.removed)}</b></div>
						<div><span>unchanged</span><b>{formatProducts(decisionEvidence.unchanged)}</b></div>
					</div>
					<div class="aisles-observe__evidence-facts">
						<div><span>copy</span><b>{formatPresentationChanges(decisionEvidence.copy)}</b></div>
						<div><span>component</span><b>{formatPresentationChanges(decisionEvidence.components)}</b></div>
						<div><span>section order</span><b>{formatPresentationChanges(decisionEvidence.sections)}</b></div>
						<div><span>marketing block</span><b>{formatPresentationChanges(decisionEvidence.marketingBlocks)}</b></div>
						<div><span>provider / model</span><b>{decisionEvidence.provider ?? 'not confirmed'} / {decisionEvidence.model ?? 'not confirmed'}</b></div>
						<div><span>calls</span><b>{decisionEvidence.calls ?? 'not confirmed'}</b></div>
						<div><span>policy / named zones</span><b>{decisionEvidence.policyVersion} / {decisionEvidence.zoneIds.join(' · ')}</b></div>
					</div>
				</section>
			{/if}

			<details class="aisles-observe__zones">
				<summary>Visible page zones ({zones.length})</summary>
				<ul>
					{#each zones as zone (zone.instanceId)}
						<li>
							<span class={`aisles-observe__tag aisles-observe__tag--${tagTone(zone)}`}>
								{zoneState(zone)}
							</span>
							<div><b>{zone.label}</b><small>{zone.instanceId} · {zone.status}</small></div>
						</li>
					{/each}
				</ul>
			</details>

			{#if capabilityCoverage}
				<details class="aisles-observe__capabilities">
					<summary>Merchant capability coverage</summary>
					<p>{capabilityCoverage.catalog.totalProducts} catalog products · {capabilityCoverage.catalog.pinnedOfferProducts} pinned offer rows · {capabilityCoverage.catalog.canonicalStorefrontRegistryProducts} canonical storefront products · {capabilityCoverage.subscriptionCapabilities.length} live capabilities in the {capabilityCoverage.source.demoStateGeneratedAt.slice(0, 10)} snapshot · {capabilityCoverage.aislesCapabilities.length} Aisles presentation capabilities.</p>
					<h3>Subscription service</h3>
					<ul>{#each capabilityCoverage.subscriptionCapabilities as capability (capability.id)}<li><a href={capability.demoHref}><b>{capability.label}</b><small>demo-state live · {capabilityCoverage.source.demoStateGeneratedAt.slice(0, 10)} · canonical registry {capability.canonicalRegistryDisposition} · {capability.sourceSurface} · Aisles {capability.aislesMode === 'catalog-offer-projection' ? 'catalog evidence' : 'fixed preview'}</small></a></li>{/each}</ul>
					<h3>Aisles presentation</h3>
					<ul>{#each capabilityCoverage.aislesCapabilities as capability (capability.id)}<li><a href={capability.demoHref}><b>{capability.label}</b><small>{capability.authority.join(' + ')} · {capability.surfaces.join(', ')}</small></a></li>{/each}</ul>
					<h3>Not claimed for Kibble</h3>
					<ul>{#each capabilityCoverage.sourceCapabilitiesOutsideKibble as capability (capability.id)}<li><b>{capability.label}</b><small>{capability.sourceTier} · demo-state {capability.demoStateStatus}</small></li>{/each}</ul>
					<p>{capabilityCoverage.sourceRegistryNote}</p>
					<p><b>Outcome proof:</b> not measured. This is capability evidence, not conversion or revenue evidence.</p>
				</details>
			{/if}

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
	.aisles-observe__header-actions { display:flex; align-items:center; gap:.4rem; }
	.aisles-observe__identity p, .aisles-observe__identity h2 { margin:0; }
	.aisles-observe__identity p { color:var(--observe-muted); font-size:.62rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
	.aisles-observe__identity h2 { margin-top:.08rem; font-size:.82rem; letter-spacing:-.015em; }
	.aisles-observe__seam { display:grid; gap:2px; width:5px; }
	.aisles-observe__seam i { display:block; width:5px; height:9px; background:#667796; }
	.aisles-observe__seam i:nth-child(2) { background:var(--observe-blue); }
	.aisles-observe__seam i:nth-child(3) { background:var(--observe-coral); }
	.aisles-observe button, .aisles-observe a { min-height:44px; border:1px solid #a9b9db; background:#fff; color:#1c4cab; padding:.45rem .58rem; font:inherit; font-weight:800; text-decoration:none; }
	.aisles-observe button { cursor:pointer; }
	.aisles-observe button:disabled { cursor:wait; opacity:.62; }
	.aisles-observe button:hover, .aisles-observe a:hover { background:#edf2fc; }
	.aisles-observe .aisles-observe__model-action { border-color:#c9796d; background:#fff2ef; color:#8f3025; }
	.aisles-observe .aisles-observe__model-action:hover { background:#ffe4df; }
	.aisles-observe button:focus-visible, .aisles-observe a:focus-visible, .aisles-observe summary:focus-visible { outline:3px solid var(--observe-blue); outline-offset:3px; }
	.aisles-observe__counts { display:grid; grid-template-columns:repeat(5, 1fr); border-bottom:1px solid var(--observe-line); background:#fff; }
	.aisles-observe__counts div { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:.35rem; min-width:0; padding:.65rem .7rem; border-right:1px solid var(--observe-line); }
	.aisles-observe__counts div:last-child { border-right:0; }
	.aisles-observe__counts b { font-size:.65rem; }
	.aisles-observe__counts strong { font-size:.85rem; }
	.aisles-observe__pip { width:7px; height:7px; background:#667796; }
	.aisles-observe__pip--rules { background:var(--observe-blue); }
	.aisles-observe__pip--ready { border:1px solid var(--observe-coral); background:#fff; }
	.aisles-observe__pip--model { background:var(--observe-coral); }
	.aisles-observe__truth { margin:0; border-bottom:1px solid var(--observe-line); background:#fff; padding:.72rem .8rem; color:#3e4961; }
	.aisles-observe__evidence { border-bottom:1px solid var(--observe-line); background:#fffdf8; padding:.75rem .8rem; }
	.aisles-observe__evidence h3, .aisles-observe__evidence p { margin:0; }
	.aisles-observe__evidence h3 { font-size:.72rem; }
	.aisles-observe__evidence p { margin-top:.12rem; color:var(--observe-muted); font-size:.62rem; }
	.aisles-observe__evidence-heading { display:flex; align-items:start; justify-content:space-between; gap:.5rem; }
	.aisles-observe__evidence-heading button { min-height:44px; }
	.aisles-observe__before-after, .aisles-observe__diff, .aisles-observe__evidence-facts { display:grid; gap:.45rem; margin-top:.65rem; }
	.aisles-observe__before-after { grid-template-columns:repeat(2, minmax(0, 1fr)); }
	.aisles-observe__diff { grid-template-columns:repeat(2, minmax(0, 1fr)); }
	.aisles-observe__evidence-facts { grid-template-columns:repeat(2, minmax(0, 1fr)); }
	.aisles-observe__before-after div, .aisles-observe__diff div, .aisles-observe__evidence-facts div { min-width:0; border-top:1px solid #e0e6f2; padding-top:.35rem; }
	.aisles-observe__before-after span, .aisles-observe__diff span, .aisles-observe__evidence-facts span { display:block; color:var(--observe-muted); font-size:.58rem; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
	.aisles-observe__before-after b, .aisles-observe__diff b, .aisles-observe__evidence-facts b { display:block; margin-top:.12rem; overflow-wrap:anywhere; font-size:.63rem; }
	.aisles-observe__facts { display:grid; grid-template-columns:repeat(2, 1fr); gap:.55rem; border-bottom:1px solid var(--observe-line); padding:.7rem .8rem; }
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
	.aisles-observe__tag--fixed { border-color:#8696b6; color:#344a80; }
	.aisles-observe__capabilities { border-bottom:1px solid var(--observe-line); background:#f4f7fd; padding:.7rem .8rem; }
	.aisles-observe__capabilities summary { cursor:pointer; color:#1c4cab; font-weight:800; }
	.aisles-observe__capabilities h3 { margin:.75rem 0 .35rem; font-size:.68rem; text-transform:uppercase; letter-spacing:.05em; }
	.aisles-observe__capabilities p { margin:.55rem 0 0; color:var(--observe-muted); }
	.aisles-observe__capabilities ul { display:grid; gap:.35rem; margin:0; padding:0; list-style:none; }
	.aisles-observe__capabilities li a { display:block; min-height:44px; padding:.45rem .55rem; }
	.aisles-observe__capabilities li b, .aisles-observe__capabilities li small { display:block; }
	.aisles-observe__capabilities li small { margin-top:.08rem; color:var(--observe-muted); font-size:.58rem; }
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
	:global(body.aisles-observe-zone-map [data-aisles-model-eligible='true']) { outline-color:#b94a3b !important; }
	:global(body.aisles-observe-zone-map [data-aisles-authority='fixed']) { outline-color:#667796 !important; }
	:global(body.aisles-observe-zone-map [data-aisles-model-eligible='true'][data-aisles-authority='fixed']) { outline-color:#b94a3b !important; }
	:global(body.aisles-observe-zone-map [data-aisles-zone-instance]::before) { content:attr(data-aisles-zone-label) ' · ' attr(data-aisles-observe-state); position:absolute; top:0; left:0; z-index:60; max-width:calc(100% - .5rem); overflow:hidden; background:#17213b; color:#fff; padding:.2rem .35rem; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.6rem; font-weight:800; line-height:1.2; text-overflow:ellipsis; white-space:nowrap; pointer-events:none; }
	@media (max-width: 640px) { .aisles-observe { right:.65rem; bottom:.65rem; width:calc(100vw - 1.3rem); max-height:62vh; } .aisles-observe--collapsed { left:.65rem; width:auto; } .aisles-observe__header { align-items:flex-start; } .aisles-observe__header-actions { flex-wrap:wrap; justify-content:flex-end; } .aisles-observe__counts { grid-template-columns:repeat(2, 1fr); } .aisles-observe__counts div { border-bottom:1px solid var(--observe-line); } .aisles-observe__counts div:nth-child(2n) { border-right:0; } .aisles-observe__counts div:last-child { grid-column:1 / -1; border-bottom:0; } .aisles-observe__facts, .aisles-observe__before-after, .aisles-observe__diff, .aisles-observe__evidence-facts { grid-template-columns:1fr; } .aisles-observe__footer { align-items:flex-start; flex-direction:column; } }
	@media (prefers-reduced-motion: reduce) { .aisles-observe *, .aisles-observe *::before, .aisles-observe *::after { scroll-behavior:auto !important; transition:none !important; } }
</style>
