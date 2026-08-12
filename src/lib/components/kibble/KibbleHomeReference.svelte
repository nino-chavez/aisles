<script lang="ts">
	import KibbleFeaturedGrid from './KibbleFeaturedGrid.svelte';
	import KibbleHero from './KibbleHero.svelte';
	import KibbleServiceProof from './KibbleServiceProof.svelte';
	import KibbleVisualModule from './KibbleVisualModule.svelte';
	import type {
		KibbleAutoRefillOffer,
		KibbleCta,
		KibbleFeaturedBundle,
		KibbleFeaturedCopy,
		KibbleProduct,
		KibbleProofItem,
		KibbleServiceProofItem,
		KibbleVisualTile,
	} from './types';

	let {
		hero,
		products,
		productHrefs,
		categories,
		serviceProof,
		featuredCopy,
		browseHref,
		subscriptionOffers = {},
		categoryTitle,
		categoryEyebrow,
	}: {
			hero: {
				eyebrow: string;
				headline: string;
				body: string;
			ctas: KibbleCta[];
			featured: KibbleFeaturedBundle;
				proofItems: KibbleProofItem[];
		};
		products: KibbleProduct[];
		productHrefs: Partial<Record<string, string>>;
		categories: KibbleVisualTile[];
		serviceProof: KibbleServiceProofItem[];
		featuredCopy: KibbleFeaturedCopy;
		browseHref: string;
		subscriptionOffers?: Record<string, KibbleAutoRefillOffer>;
		categoryTitle: string;
		categoryEyebrow: string;
	} = $props();
</script>

<!-- The order is the Preserve recipe. Runtime data may fill slots; it may not move them. -->
<KibbleHero
	eyebrow={hero.eyebrow}
	headline={hero.headline}
	body={hero.body}
	ctas={hero.ctas}
	featured={hero.featured}
	proofItems={hero.proofItems}
/>
<KibbleFeaturedGrid
	copy={featuredCopy}
	{products}
	{productHrefs}
	{browseHref}
	{subscriptionOffers}
/>
<KibbleVisualModule
	variant="category"
	title={categoryTitle}
	eyebrow={categoryEyebrow}
	tiles={categories}
	columns={4}
/>
<KibbleServiceProof items={serviceProof} />
