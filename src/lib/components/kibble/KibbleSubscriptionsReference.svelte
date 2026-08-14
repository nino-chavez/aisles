<script lang="ts">
	import './kibble-reference.css';
	import KibbleAccountReference from './KibbleAccountReference.svelte';
	import type { KibbleMerchantCapabilityCoverage } from '$lib/brand/reference/kibble-catalog-enrichment';

	type SubscriptionSubtype = 'portal' | 'account' | 'detail';
	let { subtype, availabilityMessage, policyVersion, brandName, capabilityCoverage = null }: { subtype: SubscriptionSubtype; availabilityMessage: string; policyVersion?: string; brandName: string; capabilityCoverage?: KibbleMerchantCapabilityCoverage | null } = $props();
</script>

<div class:kc-reference-route={subtype === 'detail'} class="kibble-reference kc-reference-subscriptions-page" data-kibble-route-shell="subscriptions" data-kibble-route-policy={policyVersion} data-kibble-subscriptions-subtype={subtype} aria-labelledby={subtype === 'detail' ? 'kibble-subscriptions-heading' : undefined}>
	{#if subtype === 'portal' || subtype === 'account'}
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
					<summary>Aisles presentation capabilities ({capabilityCoverage.aislesCapabilities.length})</summary>
					<ul>
						{#each capabilityCoverage.aislesCapabilities as capability (capability.id)}
							<li><div><strong>{capability.label}</strong><span>{capability.authority.join(' + ')} · {capability.surfaces.join(', ')}</span><p>{capability.boundary}</p></div><a class="kc-reference-focus" href={capability.demoHref}>Open evidence</a></li>
						{/each}
					</ul>
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
		<div data-kibble-source-resolution="account-login" data-kibble-backend-state="unavailable">
			<KibbleAccountReference subtype="login" {brandName} {availabilityMessage} {policyVersion} pageHeadingLevel={capabilityCoverage ? 'h2' : 'h1'} />
		</div>
	{:else}
		<div class="kc-reference-container kc-reference-subscriptions-page__content kc-reference-subscriptions-page__content--detail" data-kibble-backend-state="unavailable">
			<a class="kc-reference-route__text-link kc-reference-focus" href="/subscriptions">← Back to subscriptions</a>
			<h1 id="kibble-subscriptions-heading">Subscription detail</h1>
			<p>{availabilityMessage}</p>
			<div class="kc-reference-subscriptions-page__detail">
				<h2>Subscription unavailable</h2>
				<p>No plan, status, charge, renewal, address, or payment data was requested.</p>
				<button type="button" disabled>Manage subscription unavailable</button>
			</div>
		</div>
	{/if}
</div>
