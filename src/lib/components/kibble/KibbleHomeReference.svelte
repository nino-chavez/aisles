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
	import {
		materializeKibbleHomePresentation,
		parseKibbleHomePresentationDecision,
	} from '$lib/brand/reference/kibble-presentation-decisions';

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
	} = $props();
	const modelHero = $derived(zoneAdapters?.hero?.decisionMode === 'model' ? zoneAdapters.hero : null);
	const modelFeatured = $derived(zoneAdapters?.featuredRows?.[0]?.decisionMode === 'model' ? zoneAdapters.featuredRows[0] : null);
	const modelEditorial = $derived(zoneAdapters?.editorial?.decisionMode === 'model' ? zoneAdapters.editorial : null);
	const modelDecision = $derived(modelHero?.selection && modelFeatured?.selection && modelEditorial?.selection
		? parseKibbleHomePresentationDecision({
			heroCopyVariantId: modelHero.selection.copyVariantId,
			featuredCopyVariantId: modelFeatured.selection.copyVariantId,
			catalogCopyVariantId: modelEditorial.selection.copyVariantId,
			catalogComponentVariantId: modelEditorial.selection.componentVariantId === 'kibble.visual-module.category' ? 'four-column' : 'two-column',
			sectionOrderId: modelFeatured.selection.placementId,
		})
		: null);
	const modelPresentation = $derived(modelDecision ? materializeKibbleHomePresentation(modelDecision, {
		hero: { eyebrow: hero.eyebrow, headline: hero.headline, body: hero.body },
		featuredCopy,
		catalogCopy: { title: categoryTitle, eyebrow: categoryEyebrow },
	}) : null);
	const activeHero = $derived(modelPresentation ? modelPresentation.hero : { eyebrow: hero.eyebrow, headline: hero.headline, body: hero.body });
	const activeFeaturedCopy = $derived(modelPresentation ? modelPresentation.featuredCopy : featuredCopy);
	const activeCatalogCopy = $derived(modelPresentation ? modelPresentation.catalogCopy : { title: categoryTitle, eyebrow: categoryEyebrow });
	const activeCatalogColumns = $derived(modelPresentation ? modelPresentation.catalogComponent.columns : 4);
	const activeSectionOrder = $derived(modelPresentation ? modelPresentation.sectionOrder.order : ['featured', 'catalog']);
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
	modelCallCount={modelHero?.modelCallCount ?? 0}
/>
<div
	id="kibble-home-recipe-order"
	tabindex="-1"
	data-kibble-presentation-order={modelDecision?.sectionOrderId ?? 'featured-then-catalog'}
>
	{#if activeSectionOrder[0] === 'featured'}
		<KibbleFeaturedGrid copy={activeFeaturedCopy} {products} {productHrefs} {browseHref} {subscriptionOffers} zoneAdapters={zoneAdapters?.featuredRows} {modelEligible} copyModelCallCount={modelFeatured?.modelCallCount ?? 0} />
		<KibbleVisualModule variant="category" title={activeCatalogCopy.title} eyebrow={activeCatalogCopy.eyebrow} tiles={categories} columns={activeCatalogColumns} zoneAdapter={zoneAdapters?.editorial} {modelEligible} modelCallCount={modelEditorial?.modelCallCount ?? 0} componentVariantId={modelDecision?.catalogComponentVariantId ?? 'four-column'} />
	{:else}
		<KibbleVisualModule variant="category" title={activeCatalogCopy.title} eyebrow={activeCatalogCopy.eyebrow} tiles={categories} columns={activeCatalogColumns} zoneAdapter={zoneAdapters?.editorial} {modelEligible} modelCallCount={modelEditorial?.modelCallCount ?? 0} componentVariantId={modelDecision?.catalogComponentVariantId ?? 'four-column'} />
		<KibbleFeaturedGrid copy={activeFeaturedCopy} {products} {productHrefs} {browseHref} {subscriptionOffers} zoneAdapters={zoneAdapters?.featuredRows} {modelEligible} copyModelCallCount={modelFeatured?.modelCallCount ?? 0} />
	{/if}
</div>
<KibbleServiceProof items={serviceProof} zoneAdapter={zoneAdapters?.belowFold} />
