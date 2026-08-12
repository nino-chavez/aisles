<script lang="ts">
	import './kibble-reference.css';
	import KibbleProofStrip from './KibbleProofStrip.svelte';
	import type { KibbleCta, KibbleFeaturedBundle, KibbleProofItem } from './types';

	const defaultProof: KibbleProofItem[] = [
		{ label: 'Subscription GMV', value: '$30M' },
		{ label: 'Vetted brands', value: '5' },
		{ label: 'Member savings', value: '10–20%' },
		{ label: 'Cadence', value: '1 · 2 · 3 mo' },
	];

	let {
		eyebrow = 'The brands on your shelf · kept in stock',
		headline = 'The brands worth trusting, on a refill that never lapses.',
		body = 'Open Farm, Native Pet, Wild One, Finn — curated and kept stocked by Auto-Refill, the standing order you control. Member pricing, free US shipping, every 1, 2, or 3 months. Skip, swap, or pause anytime.',
		ctas = [],
		featured = null,
		proofItems = defaultProof,
	}: {
		eyebrow?: string;
		headline?: string;
		body?: string;
		ctas?: KibbleCta[];
		featured?: KibbleFeaturedBundle | null;
		proofItems?: KibbleProofItem[];
	} = $props();

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: value % 1 === 0 ? 0 : 2,
		}).format(value);
	}
</script>

<section class="kibble-reference kc-reference-hero" aria-labelledby="kibble-reference-hero-heading">
	<div class="kc-reference-container kc-reference-hero__inner">
		<div class="kc-reference-hero__copy">
			{#if eyebrow}<span class="kc-reference-hero__tag">{eyebrow}</span>{/if}
			<h1 id="kibble-reference-hero-heading">{headline}</h1>
			<p class="kc-reference-hero__body">{body}</p>

			{#if ctas.length > 0}
				<div class="kc-reference-hero__ctas">
					{#each ctas as cta (cta.href)}
						<a href={cta.href} class:kc-reference-button--primary={cta.primary} class="kc-reference-button kc-reference-focus">{cta.label}</a>
					{/each}
				</div>
			{/if}

			<KibbleProofStrip items={proofItems} />
		</div>

		{#if featured}
			<article class="kc-reference-bundle">
				<div class="kc-reference-bundle__media">
					<img src={featured.image} alt={featured.imageAlt ?? featured.name} />
					<span class="kc-reference-autorefill-seal kc-reference-bundle__seal">Auto-Refill</span>
				</div>
				<div class="kc-reference-bundle__content">
					<p class="kc-reference-eyebrow">Featured bundle</p>
					<h2>{featured.name}</h2>
					<ul class="kc-reference-bundle__list">
						{#each featured.contents as content (content.role)}
							<li><span>{content.role}</span><span class="kc-reference-bundle__brand">{content.brand}</span></li>
						{/each}
					</ul>
					<div class="kc-reference-bundle__price">
						<span class="kc-reference-price kc-reference-bundle__price-current">{money(featured.subscribePrice)}</span>
						<span class="kc-reference-price kc-reference-bundle__price-old">{money(featured.oneTimePrice)}</span>
						<span class="kc-reference-savings">Save {featured.savingsPercent}%</span>
					</div>
					<a href={featured.href} class="kc-reference-button kc-reference-button--primary kc-reference-focus" style="width:100%;margin-top:1rem;">Shop the bundle</a>
				</div>
			</article>
		{/if}
	</div>
</section>
