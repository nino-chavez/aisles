<script lang="ts">
	import KibbleFeaturedGrid from './KibbleFeaturedGrid.svelte';
	import KibbleHero from './KibbleHero.svelte';
	import KibbleServiceProof from './KibbleServiceProof.svelte';
	import KibbleVisualModule from './KibbleVisualModule.svelte';
	import type {
		KibbleAutoRefillOffer,
		KibbleCta,
		KibbleFeaturedBundle,
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
		featuredTitle = 'New arrivals',
		featuredEyebrow = 'Catalog',
		browseHref,
		subscriptionOffers = {},
		categoryTitle = 'Shop by category',
		categoryEyebrow = 'Browse',
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
		productHrefs: Record<string, string>;
		categories: KibbleVisualTile[];
		serviceProof: KibbleServiceProofItem[];
		featuredTitle?: string;
		featuredEyebrow?: string;
		browseHref: string;
		subscriptionOffers?: Record<string, KibbleAutoRefillOffer>;
		categoryTitle?: string;
		categoryEyebrow?: string;
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
	title={featuredTitle}
	eyebrow={featuredEyebrow}
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
