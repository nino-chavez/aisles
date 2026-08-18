<script lang="ts">
	import './kibble-reference.css';
	import KibbleAccountReference from './KibbleAccountReference.svelte';
	import KibbleSubscriptionPortal from './KibbleSubscriptionPortal.svelte';
	import type { KibbleMerchantCapabilityCoverage, KibbleObserveCountExpectation } from '$lib/brand/reference/kibble-catalog-enrichment';
	import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';
	import type { CustomerSessionStateView } from '$lib/commerce/customer-contract';

	type SubscriptionSubtype = 'portal' | 'account' | 'detail';
	let {
		subtype,
		availabilityMessage,
		policyVersion,
		brandName,
		capabilityCoverage = null,
		customerSessionState = 'disabled',
		subscriptionId = null,
		services = { mode: 'off', cart: 'not_connected', checkout: 'not_connected', orderCreation: 'not_exposed', orderHistory: 'customer_session_required', account: 'merchant_decision_required', payment: 'provider_owned', subscription: 'provider_not_connected', subscriptionPortal: 'provider_not_connected' },
	}: {
		subtype: SubscriptionSubtype;
		availabilityMessage: string;
		policyVersion?: string;
		brandName: string;
		capabilityCoverage?: KibbleMerchantCapabilityCoverage | null;
		services?: CommerceServiceBoundary;
		customerSessionState?: CustomerSessionStateView;
		subscriptionId?: string | null;
	} = $props();

	function countLabel(expectation: KibbleObserveCountExpectation): string {
		return expectation.kind === 'exact' ? String(expectation.value) : `${expectation.min}–${expectation.max}`;
	}
</script>

<div class:kc-reference-route={subtype === 'detail'} class="kibble-reference kc-reference-subscriptions-page" data-kibble-route-shell="subscriptions" data-kibble-route-policy={policyVersion} data-kibble-subscriptions-subtype={subtype} aria-labelledby={subtype === 'detail' ? 'kibble-subscriptions-heading' : undefined}>
	{#if subtype === 'portal' || subtype === 'account'}
		<section class="kc-subscription-boundary" aria-label="Auto-Refill connection status" data-kibble-subscription-state={services.subscription} data-kibble-portal-state={services.subscriptionPortal}>
			<p class="kc-reference-eyebrow">Service status</p>
			<p><strong>{services.subscription === 'provider_not_connected' ? 'Auto-Refill is not connected.' : 'Auto-Refill plan lookup is connected.'}</strong> {services.subscription === 'authenticated_intent_ready' ? 'Signed-in shoppers can confirm a provider plan on their BigCommerce cart.' : services.subscription === 'plan_lookup_ready' ? 'Live plans are visible, but a verified customer session is still required before a cart intent can be written.' : 'Catalog source evidence remains display-only.'}</p>
			<dl>
				<div><dt>One-time purchase</dt><dd>{services.cart === 'bigcommerce_sandbox' ? 'Live through the BigCommerce sandbox cart and hosted checkout.' : 'Not connected.'}</dd></div>
				<div><dt>Plan and cart intent</dt><dd>{services.subscription === 'authenticated_intent_ready' ? 'Provider-backed plan lookup and authenticated cart-intent confirmation are ready.' : services.subscription === 'plan_lookup_ready' ? 'Provider-backed plan lookup is ready. Cart-intent writes remain customer-session gated.' : 'Subscription provider not connected.'}</dd></div>
				<div><dt>Recurring schedule</dt><dd>Created only by the provider after its signed order webhook verifies the completed order and payment state.</dd></div>
				<div><dt>Portal</dt><dd>{services.subscriptionPortal === 'provider_not_connected' ? 'Subscription provider not connected.' : services.subscriptionPortal === 'handoff_secret_required' ? 'Shared server-to-server handoff secret required.' : 'Provider-backed portal session and customer ownership check required.'}</dd></div>
				<div><dt>Payment</dt><dd>Provider-owned. Aisles does not collect or authorize payment credentials here.</dd></div>
			</dl>
		</section>
		{#if capabilityCoverage}
			<section class="kc-reference-container kc-reference-capability-map" aria-labelledby="kibble-capability-map-heading">
				<header>
					<p class="kc-reference-eyebrow">Merchant capability manifest</p>
					<h1 id="kibble-capability-map-heading">See every intended Kibble capability in one place.</h1>
					<p>The source snapshot captured {capabilityCoverage.source.demoStateGeneratedAt.slice(0, 10)} reports these seven capabilities as live. Aisles exposes catalog evidence or a fixed service boundary without creating a cart, account, order, payment, or subscription.</p>
				</header>

				<div class="kc-reference-capability-map__grid">
					{#each capabilityCoverage.subscriptionCapabilities as capability (capability.id)}
						<article id={`kibble-capability-${capability.id}`}>
							<div class="kc-reference-capability-map__status"><span>Snapshot: live · {capabilityCoverage.source.demoStateGeneratedAt.slice(0, 10)}</span><span>{capability.sourceSurface}</span></div>
							<h2>{capability.label}</h2>
							<p>{capability.shopperOutcome}</p>
							<p><strong>Canonical registry: {capability.canonicalRegistryDisposition}</strong> — {capability.canonicalRegistryEvidence}</p>
							<small>Aisles mode: {capability.aislesMode === 'catalog-offer-projection' ? 'catalog evidence' : 'fixed service preview'}</small>
							<a class="kc-reference-focus" href={capability.demoHref}>{capability.demoLabel}</a>
						</article>
					{/each}
				</div>

				<details class="kc-reference-capability-map__aisles">
					<summary>Aisles capability proof matrix ({capabilityCoverage.aislesCapabilities.length} action types · {capabilityCoverage.aislesCapabilities.reduce((total, capability) => total + capability.proofs.length, 0)} surface proofs)</summary>
					<p class="kc-reference-capability-matrix__intro">Action types describe what may change. Each surface proof names its stable route, exact zone instances, prerequisites, and expected rendered evidence. Readiness is separate from both AI-zone and provider-call counts.</p>
					<ol class="kc-reference-capability-matrix">
						{#each capabilityCoverage.aislesCapabilities as capability (capability.id)}
							<li id={`kibble-aisles-capability-${capability.id}`}>
								<header>
									<div><small>Action type</small><code>{capability.id}</code></div>
									<span>{capability.authority.join(' + ')} · {capability.surfaces.join(', ')}</span>
								</header>
							<h2>{capability.label}</h2>
							<p>{capability.boundary}</p>
							<div class="kc-reference-capability-matrix__surfaces">
								{#each capability.proofs as proof (proof.route.surface)}
									<section aria-labelledby={`kibble-aisles-capability-${capability.id}-${proof.route.surface}`}>
										<h3 id={`kibble-aisles-capability-${capability.id}-${proof.route.surface}`}>{proof.route.surface} proof</h3>
										<dl>
											<div><dt>Route and trigger</dt><dd><code>{proof.route.href}</code><br />{proof.trigger.label} · {proof.trigger.requiresUserAction ? 'user-triggered' : 'automatic'}</dd></div>
											<div><dt>Named zones</dt><dd>{proof.namedZoneInstances.join(' · ')}</dd></div>
											<div><dt>Candidates</dt><dd>{proof.candidatePrerequisites.join(' ')}</dd></div>
											<div><dt>Before</dt><dd>{proof.before.presentation}<br /><strong>Observe: {countLabel(proof.before.observe.aiZones)} AI zones · {countLabel(proof.before.observe.aiCalls)} AI calls</strong></dd></div>
											<div><dt>Changed</dt><dd>{proof.result.changed}</dd></div>
											<div><dt>Kept</dt><dd>{proof.result.kept}</dd></div>
											<div><dt>Expected result</dt><dd><strong>{countLabel(proof.result.observe.aiZones)} AI zones · {countLabel(proof.result.observe.aiCalls)} AI calls</strong><br />{proof.result.observe.aiZones.note}</dd></div>
											<div><dt>Fixed facts</dt><dd>{capability.fixedFacts.join(' · ')}</dd></div>
											<div><dt>Fail closed</dt><dd>{proof.failClosedReason}</dd></div>
										</dl>
										<p class="kc-reference-capability-matrix__proof">Why this route is stable: {proof.route.stableProof}</p>
										<a class="kc-reference-focus" href={proof.route.href}>Open {proof.route.surface} evidence</a>
									</section>
								{/each}
							</div>
						</li>
						{/each}
					</ol>
				</details>

				<details class="kc-reference-capability-map__aisles">
					<summary>Source models not claimed for this Kibble demo ({capabilityCoverage.sourceCapabilitiesOutsideKibble.length})</summary>
					<ul>
						{#each capabilityCoverage.sourceCapabilitiesOutsideKibble as capability (capability.id)}
							<li><div><strong>{capability.label}</strong><span>{capability.sourceTier} · demo-state {capability.demoStateStatus}</span><p>{capability.reason}</p></div></li>
						{/each}
					</ul>
				</details>

				<aside class="kc-reference-capability-map__boundary">
					<strong>What remains unproven</strong>
					<p>{capabilityCoverage.commerceBoundary} Merchant outcome proof is {capabilityCoverage.outcomeProof === 'not-measured' ? 'not yet measured' : capabilityCoverage.outcomeProof}.</p>
				</aside>
			</section>
		{/if}
		<div class="kc-reference-container kc-reference-subscriptions-page__portal" data-kibble-source-resolution={customerSessionState === 'authenticated' ? 'provider-portal' : 'account-login'} data-kibble-backend-state={services.subscription}>
			{#if customerSessionState === 'authenticated'}
				<KibbleSubscriptionPortal {customerSessionState} />
			{:else}
				<KibbleAccountReference subtype="login" {brandName} {availabilityMessage} {policyVersion} {services} {customerSessionState} pageHeadingLevel={capabilityCoverage ? 'h2' : 'h1'} />
			{/if}
		</div>
	{:else}
		<div class="kc-reference-container kc-reference-subscriptions-page__content kc-reference-subscriptions-page__content--detail" data-kibble-backend-state={services.subscriptionPortal} data-kibble-subscription-state={services.subscription}>
			<h1 id="kibble-subscriptions-heading">Subscription detail</h1>
			<p>{availabilityMessage}</p>
			<KibbleSubscriptionPortal {customerSessionState} {subscriptionId} />
		</div>
	{/if}
</div>

<style>
	.kc-reference-capability-matrix__intro { max-width:72ch; margin:.75rem 0 0; color:var(--kc-muted-text); line-height:1.6; }
	.kc-subscription-boundary { width:min(100% - 2rem, 72rem); margin:clamp(1.5rem, 4vw, 3rem) auto 0; border:1px solid var(--kc-border-strong); background:var(--kc-panel); padding:clamp(1rem, 3vw, 1.4rem); }
	.kc-subscription-boundary > p { max-width:72ch; margin:.35rem 0 0; line-height:1.55; }
	.kc-subscription-boundary dl { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:.75rem; margin:1rem 0 0; }
	.kc-subscription-boundary dl > div { border:1px solid var(--kc-border); background:var(--kc-surface); padding:.8rem; }
	.kc-subscription-boundary dt { color:var(--kc-identity); font-size:.72rem; font-weight:900; letter-spacing:.06em; text-transform:uppercase; }
	.kc-subscription-boundary dd { margin:.25rem 0 0; color:var(--kc-muted-text); line-height:1.5; }
	.kc-reference-subscriptions-page__portal { margin-top:1.5rem; margin-bottom:2rem; }
	.kc-reference-capability-matrix { display:grid; grid-template-columns:minmax(0, 1fr); gap:1rem; margin:1rem 0 0; padding:0; list-style:none; }
	.kc-reference-capability-matrix > li { display:flex; flex-direction:column; align-items:stretch; justify-content:flex-start; gap:0; min-width:0; border:1px solid var(--kc-border); background:var(--kc-surface); padding:clamp(1rem, 2.5vw, 1.4rem); }
	.kc-reference-capability-matrix header { display:flex; align-items:start; justify-content:space-between; gap:1rem; }
	.kc-reference-capability-matrix header div > * { display:block; }
	.kc-reference-capability-matrix header small, .kc-reference-capability-matrix dt { color:var(--kc-muted-text); font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
	.kc-reference-capability-matrix header code { margin-top:.2rem; color:var(--kc-action); font-weight:800; overflow-wrap:anywhere; }
	.kc-reference-capability-matrix header span { border:1px solid var(--kc-border-strong); padding:.25rem .45rem; color:var(--kc-identity); font-size:.72rem; font-weight:800; white-space:nowrap; }
	.kc-reference-capability-matrix h2 { margin:1rem 0 .35rem; font-size:clamp(1.25rem, 3vw, 1.65rem); }
	.kc-reference-capability-matrix > li > p { margin:.25rem 0 0; color:var(--kc-muted-text); line-height:1.55; }
	.kc-reference-capability-matrix__surfaces { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:1rem; margin-top:1rem; }
	.kc-reference-capability-matrix__surfaces > section { display:flex; flex-direction:column; min-width:0; border:1px solid var(--kc-border); background:var(--kc-panel); padding:1rem; }
	.kc-reference-capability-matrix__surfaces > section:only-child { grid-column:1 / -1; justify-self:center; width:100%; max-width:52rem; }
	.kc-reference-capability-matrix__surfaces h3 { margin:0; color:var(--kc-identity); font-size:.82rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
	.kc-reference-capability-matrix dl { display:grid; gap:0; margin:1rem 0; }
	.kc-reference-capability-matrix dl div { border-top:1px solid var(--kc-border); padding:.65rem 0; }
	.kc-reference-capability-matrix dd { margin:.2rem 0 0; overflow-wrap:anywhere; line-height:1.5; }
	.kc-reference-capability-matrix__proof { border-left:3px solid var(--kc-action); padding-left:.7rem; overflow-wrap:anywhere; }
	.kc-reference-capability-matrix__surfaces a { display:inline-flex; align-items:center; justify-content:center; min-height:44px; margin-top:auto; border:1px solid var(--kc-action); color:var(--kc-action); padding:.65rem .8rem; font-weight:800; text-decoration:none; }
	.kc-reference-capability-matrix__surfaces a:hover { background:var(--kc-surface); }
	@media (max-width: 760px) { .kc-subscription-boundary dl, .kc-reference-capability-matrix__surfaces { grid-template-columns:1fr; } .kc-reference-capability-matrix header { align-items:flex-start; flex-direction:column; } .kc-reference-capability-matrix header span { max-width:100%; white-space:normal; overflow-wrap:anywhere; } }
</style>
