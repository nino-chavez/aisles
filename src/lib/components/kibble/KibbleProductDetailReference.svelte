<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleAutoRefillOffer, KibbleModelZoneAdapterBinding, KibblePdpBundle, KibblePdpCopy, KibblePdpProduct, KibbleProductOption, KibbleProduct, KibbleRenderedModelZoneAdapterBinding, KibbleZoneAdapterBinding } from './types';
	import KibbleMarketingBlock from './KibbleMarketingBlock.svelte';
	import { cadenceLabel, type SubscriptionPlan } from '$lib/commerce/subscription-contract';
	type RelatedContent = { component: 'product-carousel'; props: { title: string; products: Array<{ productId: string; role: 'standard' }>; showQuickAdd: false } };
	type MarketingContent = { component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } };

	let {
		product,
		bundle,
		breadcrumbs,
		options,
		relatedProducts,
		relatedProductHrefs,
		purchaseUnavailableLabel,
		purchaseUnavailableBody,
		relatedHeading,
		relatedCandidateSource = null,
		relatedRelationKind = null,
		copy,
		zoneAdapter,
		relatedModelDecision = null,
		marketingZoneArtifact = null,
		autoRefill = null,
		subscriptionPlans = [],
		subscriptionPlansStatus = 'disabled',
		customerSessionState = 'disabled',
		onAddToCart,
		onAddAutoRefill,
		isAddingToCart = false,
		cartMessage = '',
		commerceEnabled = false,
	}: {
		product: KibblePdpProduct;
		bundle: KibblePdpBundle | null;
		breadcrumbs: Array<{ label: string; href?: string }>;
		options: KibbleProductOption[];
		relatedProducts: KibbleProduct[];
		relatedProductHrefs: Record<string, string>;
		purchaseUnavailableLabel: string;
		purchaseUnavailableBody: string;
		relatedHeading: string;
		relatedCandidateSource?: 'native_related' | 'category_sibling' | null;
		relatedRelationKind?: 'related' | null;
		copy: KibblePdpCopy;
		zoneAdapter?: KibbleZoneAdapterBinding<any> | KibbleRenderedModelZoneAdapterBinding<RelatedContent> | null;
		relatedModelDecision?: { zoneId: 'pdp.related'; routePath: string } | null;
		marketingZoneArtifact?: KibbleModelZoneAdapterBinding<MarketingContent> | null;
		autoRefill?: KibbleAutoRefillOffer | null;
		subscriptionPlans?: SubscriptionPlan[];
		subscriptionPlansStatus?: 'ready' | 'empty' | 'unavailable' | 'disabled';
		customerSessionState?: 'disabled' | 'anonymous' | 'authenticated' | 'unavailable';
		onAddToCart?: () => void;
		onAddAutoRefill?: (planId: string) => void;
		isAddingToCart?: boolean;
		cartMessage?: string;
		commerceEnabled?: boolean;
	} = $props();

	let activeImage = $state(0);
	let purchaseMode = $state<'one_time' | 'auto_refill'>('one_time');
	let selectedPlanId = $state('');
	const gallery = $derived(bundle?.contents.some(({ image }) => image)
		? bundle.contents.map(({ brand, title, image }) => ({ url: image, alt: `${brand} ${title}` }))
		: product.images.length > 0
			? product.images
			: product.image
				? [{ url: product.image, alt: product.imageAlt }]
				: []);
	const currentImage = $derived(gallery[activeImage] ?? null);
	const salePrice = $derived(typeof product.salePrice === 'number' && product.salePrice < product.price ? product.salePrice : null);
	const relatedByEntityId = $derived(new Map(relatedProducts.map((related) => [String(related.entityId), related])));
	const commerceReady = $derived(
		commerceEnabled &&
		product.isInStock === true &&
		options.length === 0 &&
		(typeof onAddToCart === 'function')
	);
	const selectedPlan = $derived(subscriptionPlans.find(({ id }) => id === selectedPlanId) ?? subscriptionPlans[0] ?? null);
	const autoRefillActionReady = $derived(
		commerceReady &&
		purchaseMode === 'auto_refill' &&
		customerSessionState === 'authenticated' &&
		selectedPlan !== null &&
		typeof onAddAutoRefill === 'function'
	);
	const purchaseActionReady = $derived(purchaseMode === 'one_time' ? commerceReady : autoRefillActionReady);

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currencyCode || 'USD' }).format(value);
	}

	$effect(() => {
		if (activeImage >= gallery.length) activeImage = 0;
	});

	$effect(() => {
		if (subscriptionPlans.length > 0 && !subscriptionPlans.some(({ id }) => id === selectedPlanId)) selectedPlanId = subscriptionPlans[0].id;
		if (subscriptionPlans.length === 0) purchaseMode = 'one_time';
	});

	function runPurchaseAction() {
		if (purchaseMode === 'auto_refill' && selectedPlan && onAddAutoRefill) onAddAutoRefill(selectedPlan.id);
		else onAddToCart?.();
	}
</script>

<article class="kibble-reference kc-reference-pdp" data-kibble-pdp-recipe="fixed-catalog-display-only" data-kibble-commerce-mode={commerceEnabled ? 'sandbox-cart' : 'off'}>
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label={copy.breadcrumbLabel}>
			{#each breadcrumbs as crumb, index}
				{#if crumb.href}<a class="kc-reference-focus" href={crumb.href}>{crumb.label}</a>{:else}<span aria-current="page">{crumb.label}</span>{/if}
				{#if index < breadcrumbs.length - 1}<span aria-hidden="true">/</span>{/if}
			{/each}
		</nav>

		<div class="kc-reference-pdp__layout">
			<div role="group" class:kc-reference-pdp__gallery--with-thumbnails={gallery.length > 1} class="kc-reference-pdp__gallery" data-gallery-count={gallery.length} aria-label={`${product.name} ${copy.galleryLabel}`}>
				{#if gallery.length > 1}
					<div class="kc-reference-pdp__thumbnails" aria-label={copy.galleryImagesLabel}>
						{#each gallery as image, index (image.url)}
							<button type="button" class:kc-reference-pdp__thumbnail--active={activeImage === index} class="kc-reference-pdp__thumbnail kc-reference-focus" onclick={() => activeImage = index} aria-label={`${copy.viewImageLabel} ${index + 1} ${product.name}`} aria-pressed={activeImage === index} aria-current={activeImage === index ? 'true' : undefined}>
								<img src={image.url} alt="" width="80" height="80" loading="lazy" />
							</button>
						{/each}
					</div>
				{/if}
				<div class="kc-reference-pdp__primary-image">
					{#if currentImage}<img src={currentImage.url} alt={currentImage.alt || product.name} width="1200" height="1200" loading="eager" />{:else}<span>{copy.imageUnavailableLabel}</span>{/if}
				</div>
			</div>

			<div class="kc-reference-pdp__details">
				{#if product.category}<p class="kc-reference-eyebrow">{product.category}</p>{/if}
				<h1 class="kc-reference-display">{product.name}</h1>
				{#if bundle}<p class="kc-reference-pdp__bundle-summary">{copy.bundleEyebrow} · {bundle.contents.length} {bundle.contents.length === 1 ? copy.bundleProductSingular : copy.bundleProductPlural}</p>{/if}
				<div class="kc-reference-pdp__price" aria-label={copy.priceLabel}>
					{#if salePrice !== null}<span class="kc-reference-price">{money(salePrice)}</span><s>{money(product.price)}</s>{:else}<span class="kc-reference-price">{money(product.price)}</span>{/if}
				</div>
				{#if product.sku}<p class="kc-reference-pdp__sku">{copy.skuLabel}: {product.sku}</p>{/if}
				<p class:kc-reference-pdp__stock--in={product.isInStock === true} class="kc-reference-pdp__stock">{product.isInStock === true ? copy.inStockLabel : product.isInStock === false ? copy.outOfStockLabel : copy.availabilityUnavailableLabel}</p>

				{#if subscriptionPlansStatus === 'ready' && subscriptionPlans.length > 0}
					<section class="kc-reference-pdp__autorefill" data-aisles-zone-instance="pdp.subscription-offer" data-aisles-zone-label="Provider subscription plans" data-aisles-authority="provider" data-aisles-model-calls="0" data-kibble-subscription-state="live-plans" aria-labelledby="kibble-pdp-autorefill-heading">
						<div>
							<p class="kc-reference-eyebrow">Live Auto-Refill plans</p>
							<h2 id="kibble-pdp-autorefill-heading">Choose how you buy</h2>
						</div>
						<fieldset class="kc-reference-pdp__purchase-modes">
							<legend>Purchase option</legend>
							<label><input type="radio" name="purchase-mode" value="one_time" bind:group={purchaseMode} /> <span><strong>One-time purchase</strong><small>{money(salePrice ?? product.price)}</small></span></label>
							<label><input type="radio" name="purchase-mode" value="auto_refill" bind:group={purchaseMode} /> <span><strong>Auto-Refill</strong><small>{selectedPlan ? `${money(selectedPlan.price.value)} recurring` : ''}</small></span></label>
						</fieldset>
						<label class="kc-reference-pdp__cadence" for="kibble-pdp-cadence">Delivery cadence
							<select id="kibble-pdp-cadence" bind:value={selectedPlanId} disabled={purchaseMode !== 'auto_refill'}>
								{#each subscriptionPlans as plan (plan.id)}<option value={plan.id}>{cadenceLabel(plan)} — {money(plan.price.value)} recurring</option>{/each}
							</select>
						</label>
						{#if customerSessionState !== 'authenticated'}
							<p class="kc-reference-pdp__subscription-gate"><a class="kc-reference-focus" href="/account/login">Sign in</a>
								before starting Auto-Refill. One-time checkout stays available without an account.</p>
						{/if}
						<small>The subscription service owns plan eligibility, cadence, recurring price, and schedule creation. Aisles only confirms the selected cart intent; it does not create a subscription.</small>
					</section>
				{:else if autoRefill}
					<section class="kc-reference-pdp__autorefill" data-aisles-zone-instance="pdp.subscription-offer" data-aisles-zone-label="Subscription source evidence" data-aisles-authority="fixed" data-aisles-model-calls="0" data-kibble-subscription-state={subscriptionPlansStatus} aria-labelledby="kibble-pdp-autorefill-heading">
						<div><p class="kc-reference-eyebrow">Pinned subscription evidence</p><h2 id="kibble-pdp-autorefill-heading">{autoRefill.label}</h2></div>
						<p><strong>{money(autoRefill.price)}</strong> · {autoRefill.cadenceLabel}</p>
						{#if autoRefill.capabilityEvidence?.length}
							<dl aria-label="Pinned subscription capability evidence">
								{#each autoRefill.capabilityEvidence as evidence (evidence.label)}<div><dt>{evidence.label}</dt><dd>{evidence.detail}</dd></div>{/each}
							</dl>
						{/if}
						<small>{subscriptionPlansStatus === 'unavailable' ? 'Live plans could not be confirmed, so Auto-Refill is unavailable.' : 'The subscription service owns plan eligibility. This is a hash-pinned, display-only source projection and cannot be selected or purchased.'}</small>
					</section>
				{/if}

				{#if bundle}
					<div class="kc-reference-pdp__bundle-contents">
						<h2 class="kc-reference-eyebrow">{copy.bundleContentsHeading}</h2>
						<ul>
							{#each bundle.contents as content (content.title)}
								<li>
									<img src={content.image} alt={`${content.brand} ${content.title}`} width="56" height="56" loading="lazy" />
									<div><strong>{content.title}</strong><span>{content.brand} · {content.role}</span></div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if options.length > 0}
					<fieldset class="kc-reference-pdp__options" disabled aria-describedby="purchase-unavailable">
						<legend>{copy.optionsLegend}</legend>
						{#each options as option (option.entityId)}
							<label>{option.displayName}{option.isRequired ? ` ${copy.requiredSuffix}` : ''}
								<select aria-label={option.displayName}>{#each option.values as value (value.entityId)}<option selected={value.isDefault}>{value.label}</option>{/each}</select>
							</label>
						{/each}
					</fieldset>
				{/if}


				{#if commerceReady}
					<div class="kc-reference-pdp__purchase" aria-live="polite">
						{#if purchaseMode === 'one_time'}
							<button type="button" class="kc-reference-button kc-reference-button--primary kc-reference-focus" onclick={onAddToCart} disabled={isAddingToCart || !purchaseActionReady}>{isAddingToCart ? 'Adding…' : `Add to cart — ${money(salePrice ?? product.price)}`}</button>
						{:else}
							<button type="button" class="kc-reference-button kc-reference-button--primary kc-reference-focus" onclick={runPurchaseAction} disabled={isAddingToCart || !purchaseActionReady}>{isAddingToCart ? 'Adding…' : selectedPlan ? 'Add Auto-Refill' : 'Auto-Refill unavailable'}</button>
						{/if}
						<small>{purchaseMode === 'auto_refill' ? 'The provider must confirm the recurring plan on the cart. BigCommerce hosted checkout owns the current order total.' : 'One-time purchase. BigCommerce owns the cart and price.'}</small>
						{#if cartMessage}<p>{cartMessage}</p>{/if}
					</div>
				{:else}
					<aside class="kc-reference-pdp__purchase-unavailable" id="purchase-unavailable" aria-live="polite">
						<p class="kc-reference-eyebrow">{purchaseUnavailableLabel}</p>
						<p>{commerceEnabled && options.length > 0 ? 'Product options are not connected to the cart yet.' : purchaseUnavailableBody}</p>
					</aside>
				{/if}

				{#if product.description}<div class="kc-reference-pdp__description"><h2>{copy.detailsHeading}</h2><div>{@html product.description}</div></div>{/if}
				{#if Object.keys(product.specs).length > 0}<dl class="kc-reference-pdp__specs">{#each Object.entries(product.specs) as [label, value]}<div><dt>{label}</dt><dd>{value}</dd></div>{/each}</dl>{/if}
			</div>
		</div>
	</div>

	{#if marketingZoneArtifact?.sharedContentKind === 'content'}
		<KibbleMarketingBlock zoneArtifact={marketingZoneArtifact} />
	{/if}

	{#if zoneAdapter}
		<div id="kibble-pdp-related" tabindex="-1" class="kc-reference-pdp__related" data-kibble-zone-instance={zoneAdapter.instanceId} data-kibble-zone-status={zoneAdapter.sharedStatus} data-kibble-zone-content-kind={zoneAdapter.sharedContentKind} data-kibble-zone-adapter={zoneAdapter.adapterId} data-kibble-zone-variant={'selection' in zoneAdapter ? zoneAdapter.selection.copyVariantId : zoneAdapter.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter.inputSha256} data-aisles-zone-instance={zoneAdapter.instanceId} data-aisles-zone-label="Related products" data-aisles-authority={zoneAdapter.decisionMode ?? 'fixed'} data-aisles-model-calls={zoneAdapter.modelCallCount ?? 0} data-aisles-model-eligible={relatedModelDecision?.zoneId === 'pdp.related' ? 'true' : undefined} data-aisles-pdp-model-eligible={relatedModelDecision?.zoneId === 'pdp.related' ? 'true' : undefined} data-aisles-candidate-source={relatedCandidateSource ?? undefined} data-aisles-relation-kind={relatedRelationKind ?? undefined}><div class="kc-reference-container"><h2 class="kc-reference-display">{zoneAdapter.content.props.title || relatedHeading}</h2><div class="kc-reference-product-grid">{#each zoneAdapter.content.props.products as productRef (productRef.productId)}{@const related = relatedByEntityId.get(productRef.productId)}{#if related}<KibbleProductCard product={related} productHref={relatedProductHrefs[related.id]} />{/if}{/each}</div></div></div>
	{/if}
</article>
