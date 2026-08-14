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
	import type { materializeKibbleHomePresentation } from '$lib/brand/reference/kibble-presentation-decisions';

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
		zoneAdapters,
		modelEligible = false,
		presentation = null,
		modelCallCount = 0,
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
		zoneAdapters?: {
			hero: any;
			featuredRows: any[];
			editorial: any;
			belowFold: any;
		};
		modelEligible?: boolean;
		presentation?: ReturnType<typeof materializeKibbleHomePresentation> | null;
		modelCallCount?: number;
	} = $props();
	const activeHero = $derived(modelCallCount > 0 && presentation ? presentation.hero : { eyebrow: hero.eyebrow, headline: hero.headline, body: hero.body });
	const activeFeaturedCopy = $derived(modelCallCount > 0 && presentation ? presentation.featuredCopy : featuredCopy);
	const activeCatalogCopy = $derived(modelCallCount > 0 && presentation ? presentation.catalogCopy : { title: categoryTitle, eyebrow: categoryEyebrow });
	const activeCatalogColumns = $derived(modelCallCount > 0 && presentation ? presentation.catalogComponent.columns : 4);
	const activeSectionOrder = $derived(modelCallCount > 0 && presentation ? presentation.sectionOrder.order : ['featured', 'catalog']);
</script>

<KibbleHero
	eyebrow={activeHero.eyebrow}
	headline={activeHero.headline}
	body={activeHero.body}
	ctas={hero.ctas}
	featured={hero.featured}
	proofItems={hero.proofItems}
	zoneAdapter={zoneAdapters?.hero}
	{modelEligible}
	{modelCallCount}
/>
<div
	id="kibble-home-recipe-order"
	tabindex="-1"
	data-aisles-zone-instance="home.recipe-order"
	data-aisles-zone-label="Home section order"
	data-aisles-authority={modelCallCount > 0 ? 'model' : 'fixed'}
	data-aisles-model-calls={modelCallCount}
	data-aisles-model-eligible={modelEligible ? 'true' : undefined}
	data-kibble-zone-status="live"
	data-kibble-zone-variant={presentation?.decision.sectionOrderId ?? 'featured-then-catalog'}
>
	{#if activeSectionOrder[0] === 'featured'}
		<KibbleFeaturedGrid copy={activeFeaturedCopy} {products} {productHrefs} {browseHref} {subscriptionOffers} zoneAdapters={zoneAdapters?.featuredRows} {modelEligible} copyModelCallCount={modelCallCount} />
		<KibbleVisualModule variant="category" title={activeCatalogCopy.title} eyebrow={activeCatalogCopy.eyebrow} tiles={categories} columns={activeCatalogColumns} zoneAdapter={zoneAdapters?.editorial} {modelEligible} {modelCallCount} componentVariantId={presentation?.decision.catalogComponentVariantId ?? 'four-column'} />
	{:else}
		<KibbleVisualModule variant="category" title={activeCatalogCopy.title} eyebrow={activeCatalogCopy.eyebrow} tiles={categories} columns={activeCatalogColumns} zoneAdapter={zoneAdapters?.editorial} {modelEligible} {modelCallCount} componentVariantId={presentation?.decision.catalogComponentVariantId ?? 'four-column'} />
		<KibbleFeaturedGrid copy={activeFeaturedCopy} {products} {productHrefs} {browseHref} {subscriptionOffers} zoneAdapters={zoneAdapters?.featuredRows} {modelEligible} copyModelCallCount={modelCallCount} />
	{/if}
</div>
<KibbleServiceProof items={serviceProof} zoneAdapter={zoneAdapters?.belowFold} />
