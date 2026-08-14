<script lang="ts">
	import './kibble-reference.css';
	import KibbleProofStrip from './KibbleProofStrip.svelte';
	import type { KibbleCta, KibbleFeaturedBundle, KibbleProofItem, KibbleZoneAdapterBinding } from './types';

	let {
		eyebrow,
		headline,
		body,
		ctas,
		featured,
		proofItems,
		zoneAdapter,
		modelEligible = false,
		modelCallCount = 0,
	}: {
		eyebrow: string;
		headline: string;
		body: string;
		ctas: KibbleCta[];
		featured: KibbleFeaturedBundle;
		proofItems: KibbleProofItem[];
		zoneAdapter?: KibbleZoneAdapterBinding<any>;
		modelEligible?: boolean;
		modelCallCount?: number;
	} = $props();

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: value % 1 === 0 ? 0 : 2,
		}).format(value);
	}
</script>

<section class="kibble-reference kc-reference-hero" aria-labelledby="kibble-reference-hero-heading" data-kibble-zone-instance={zoneAdapter?.instanceId} data-kibble-zone-status={zoneAdapter?.sharedStatus} data-kibble-zone-content-kind={zoneAdapter?.sharedContentKind} data-kibble-zone-adapter={zoneAdapter?.adapterId} data-kibble-zone-variant={zoneAdapter?.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter?.inputSha256} data-aisles-zone-instance={zoneAdapter?.instanceId ?? 'home.hero'} data-aisles-zone-label="Opening hero" data-aisles-authority={modelCallCount > 0 ? 'model' : (zoneAdapter?.decisionMode ?? 'fixed')} data-aisles-model-calls={modelCallCount} data-aisles-model-eligible={modelEligible ? 'true' : undefined}>
	<div class="kc-reference-container kc-reference-hero__inner">
		<div class="kc-reference-hero__copy">
			<span class="kc-reference-hero__tag">{modelCallCount > 0 ? eyebrow : (zoneAdapter?.content.props.eyebrow ?? eyebrow)}</span>
			<h1 id="kibble-reference-hero-heading">{modelCallCount > 0 ? headline : (zoneAdapter?.content.props.headline ?? headline)}</h1>
			<p class="kc-reference-hero__body">{modelCallCount > 0 ? body : (zoneAdapter?.content.props.body ?? body)}</p>

			{#if ctas.length > 0}
				<div class="kc-reference-hero__ctas">
					{#each ctas as cta (cta.href)}
						<a href={cta.href} class:kc-reference-button--primary={cta.primary} class="kc-reference-button kc-reference-focus">{cta.label}</a>
					{/each}
				</div>
			{/if}

			<KibbleProofStrip items={proofItems} />
		</div>

		<article class="kc-reference-bundle">
				<div class="kc-reference-bundle__media">
					<img src={featured.image} alt={featured.imageAlt ?? featured.name} />
				</div>
				<div class="kc-reference-bundle__content">
					<p class="kc-reference-eyebrow">{featured.eyebrow}</p>
					<h3>{featured.name}</h3>
					<ul class="kc-reference-bundle__list">
						{#each featured.contents as content (content.role)}
							<li><span>{content.role}</span><span class="kc-reference-bundle__brand">{content.brand}</span></li>
						{/each}
					</ul>
					<div class="kc-reference-bundle__price">
						<span class="kc-reference-price kc-reference-bundle__price-current">{money(featured.oneTimePrice)}</span>
					</div>
					<a href={featured.href} class="kc-reference-button kc-reference-button--primary kc-reference-focus" style="width:100%;margin-top:1rem;">{featured.ctaLabel}</a>
				</div>
		</article>
	</div>
</section>
