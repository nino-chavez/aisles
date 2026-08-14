<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import { KIBBLE_COMMERCE_COPY, type KibbleCommerceCopy, type KibblePdpBundle, type KibblePdpCopy, type KibblePdpProduct, type KibbleProductOption, type KibbleProduct, type KibbleSubscriptionPlanView, type KibbleZoneAdapterBinding } from './types';
	import KibbleMarketingBlock from './KibbleMarketingBlock.svelte';
	import type { materializeKibblePdpPresentation } from '$lib/brand/reference/kibble-presentation-decisions';
	type RelatedContent = { component: 'product-carousel'; props: { title: string; products: Array<{ productId: string; role: 'standard' }>; showQuickAdd: false } };

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
		copy,
		zoneAdapter,
		relatedModelDecision = null,
		presentation = null,
		presentationModelCallCount = 0,
		commerceEnabled = false,
		commerceCopy = KIBBLE_COMMERCE_COPY,
		subscriptionPlans = [],
		subscriptionError = null,
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
		copy: KibblePdpCopy;
		zoneAdapter?: KibbleZoneAdapterBinding<any> | null;
		relatedModelDecision?: { zoneId: 'pdp.related'; routePath: string } | null;
		presentation?: ReturnType<typeof materializeKibblePdpPresentation> | null;
		presentationModelCallCount?: number;
		commerceEnabled?: boolean;
		commerceCopy?: KibbleCommerceCopy;
		subscriptionPlans?: KibbleSubscriptionPlanView[];
		subscriptionError?: string | null;
	} = $props();

	let activeImage = $state(0);
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
	let selectedOptions = $state<Record<string, string>>({});
	let isAddingToCart = $state(false);
	let cartMessage = $state('');
	let cartMessageTone = $state<'neutral' | 'error'>('neutral');
	let purchaseMode = $state<'one-time' | 'auto-refill'>('one-time');
	let selectedPlanId = $state('');
	const activeSubscriptionPlans = $derived(subscriptionPlans.filter((plan) => plan.salesMode !== 'one_time_only'));
	const selectedPlan = $derived(activeSubscriptionPlans.find((plan) => plan.id === selectedPlanId) ?? activeSubscriptionPlans[0] ?? null);

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currencyCode || 'USD' }).format(value);
	}

	function planMoney(plan: KibbleSubscriptionPlanView): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.currency }).format(plan.amountCents / 100);
	}

	function cadence(plan: KibbleSubscriptionPlanView): string {
		const unit = plan.intervalCount === 1 ? plan.interval : `${plan.interval}s`;
		return `every ${plan.intervalCount} ${unit}`;
	}

	$effect(() => {
		if (activeImage >= gallery.length) activeImage = 0;
	});

	function selectedOptionValue(option: KibbleProductOption): string {
		return selectedOptions[String(option.entityId)] ?? String(option.values.find((value) => value.isDefault)?.entityId ?? '');
	}

	function setSelectedOption(optionEntityId: number, event: Event): void {
		selectedOptions = { ...selectedOptions, [String(optionEntityId)]: (event.currentTarget as HTMLSelectElement).value };
	}

	async function addSelectedPurchaseToCart(): Promise<void> {
		if (!commerceEnabled || isAddingToCart || product.isInStock === false) return;
		const selected = options.map((option) => ({ option, value: selectedOptionValue(option) })).filter(({ value }) => value);
		if (options.some((option) => option.isRequired && !selectedOptionValue(option))) {
			cartMessageTone = 'error';
			cartMessage = 'Choose the required options before adding this product.';
			return;
		}
		isAddingToCart = true;
		cartMessage = '';
		let oneTimeItemAdded = false;
		try {
			const response = await fetch('/api/cart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					productEntityId: product.entityId,
					productSlug: product.id,
					quantity: 1,
					purchaseMode,
					selectedOptions: selected.map(({ option, value }) => ({ optionEntityId: option.entityId, optionValueEntityId: Number(value) })),
				}),
			});
			const result = await response.json() as { itemCount?: number; lineItemEntityId?: string | null; error?: string };
			if (!response.ok) throw new Error(result.error || commerceCopy.cartErrorLabel);
			oneTimeItemAdded = true;
			if (purchaseMode === 'auto-refill') {
				if (!selectedPlan || !result.lineItemEntityId) throw new Error(commerceCopy.autoRefillErrorLabel);
				const intentResponse = await fetch('/api/cart/intents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ lineEntityId: result.lineItemEntityId, planId: selectedPlan.id }),
				});
				await intentResponse.json();
				if (!intentResponse.ok) throw new Error(commerceCopy.autoRefillErrorLabel);
				cartMessageTone = 'neutral';
				cartMessage = `${commerceCopy.autoRefillLabel} confirmed · ${selectedPlan.name}`;
			} else {
				cartMessageTone = 'neutral';
				cartMessage = commerceCopy.addedToCartLabel;
			}
			window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: result.itemCount ?? 0 } }));
		} catch (error) {
			cartMessageTone = 'error';
			cartMessage = oneTimeItemAdded && purchaseMode === 'auto-refill' ? commerceCopy.autoRefillErrorLabel : error instanceof Error ? error.message : commerceCopy.cartErrorLabel;
		} finally {
			isAddingToCart = false;
		}
	}
</script>

<article class="kibble-reference kc-reference-pdp" data-kibble-pdp-recipe={commerceEnabled ? 'catalog-one-time-commerce' : 'fixed-catalog-display-only'}>
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
					<fieldset class="kc-reference-pdp__options" disabled={!commerceEnabled} aria-describedby={commerceEnabled ? 'purchase-status' : 'purchase-unavailable'}>
						<legend>{copy.optionsLegend}</legend>
						{#each options as option (option.entityId)}
							<label>{option.displayName}{option.isRequired ? ` ${copy.requiredSuffix}` : ''}
								<select aria-label={option.displayName} value={selectedOptionValue(option)} onchange={(event) => setSelectedOption(option.entityId, event)}>{#each option.values as value (value.entityId)}<option value={value.entityId}>{value.label}</option>{/each}</select>
							</label>
						{/each}
					</fieldset>
				{/if}

				{#if commerceEnabled}
					{#if activeSubscriptionPlans.length > 0}
						<fieldset class="kc-reference-pdp__purchase-methods" aria-describedby="purchase-status">
							<legend>Purchase options</legend>
							<label class:kc-reference-pdp__purchase-method--active={purchaseMode === 'one-time'}>
								<input type="radio" name="purchase-mode" value="one-time" checked={purchaseMode === 'one-time'} onchange={() => purchaseMode = 'one-time'} />
								<span><strong>{commerceCopy.oneTimeLabel}</strong><small>{money(salePrice ?? product.price)} today</small></span>
							</label>
							{#each activeSubscriptionPlans as plan (plan.id)}
								<label class:kc-reference-pdp__purchase-method--active={purchaseMode === 'auto-refill' && selectedPlanId === plan.id}>
									<input type="radio" name="purchase-mode" value="auto-refill" checked={purchaseMode === 'auto-refill' && (selectedPlanId === plan.id || (!selectedPlanId && plan.id === activeSubscriptionPlans[0].id))} onchange={() => { purchaseMode = 'auto-refill'; selectedPlanId = plan.id; }} />
									<span><strong>{commerceCopy.autoRefillLabel} · {plan.name}</strong><small>{planMoney(plan)} · {cadence(plan)}{plan.discountPct ? ` · ${plan.discountPct}% off` : ''}</small></span>
								</label>
							{/each}
						</fieldset>
					{:else if subscriptionError}
						<p class="kc-reference-pdp__subscription-note" role="status">{subscriptionError} One-time purchase remains available.</p>
					{/if}
					<form class="kc-reference-pdp__purchase" onsubmit={(event) => { event.preventDefault(); void addSelectedPurchaseToCart(); }}>
						<button type="submit" class="kc-reference-button kc-reference-button--primary kc-reference-focus" disabled={isAddingToCart || product.isInStock === false}>
							{isAddingToCart ? commerceCopy.addingToCartLabel : product.isInStock === false ? copy.outOfStockLabel : purchaseMode === 'auto-refill' ? commerceCopy.autoRefillLabel : commerceCopy.addToCartLabel}
						</button>
						<p id="purchase-status" aria-live="polite" class:error={cartMessageTone === 'error'}>{cartMessage}</p>
					</form>
				{:else}
					<aside class="kc-reference-pdp__purchase-unavailable" id="purchase-unavailable" aria-live="polite">
						<p class="kc-reference-eyebrow">{purchaseUnavailableLabel}</p>
						<p>{purchaseUnavailableBody}</p>
					</aside>
				{/if}

				{#if product.description}<div class="kc-reference-pdp__description"><h2>{copy.detailsHeading}</h2><div>{@html product.description}</div></div>{/if}
				{#if Object.keys(product.specs).length > 0}<dl class="kc-reference-pdp__specs">{#each Object.entries(product.specs) as [label, value]}<div><dt>{label}</dt><dd>{value}</dd></div>{/each}</dl>{/if}
			</div>
		</div>
	</div>

	{#if presentation?.marketingBlock || relatedModelDecision}
		<KibbleMarketingBlock block={presentation?.marketingBlock ?? null} zoneId="pdp.marketing-block" modelCallCount={presentationModelCallCount} modelEligible={Boolean(relatedModelDecision)} />
	{/if}

	{#if zoneAdapter}
		<div id="kibble-pdp-related" tabindex="-1" class="kc-reference-pdp__related" data-kibble-zone-instance={zoneAdapter.instanceId} data-kibble-zone-status={zoneAdapter.sharedStatus} data-kibble-zone-content-kind={zoneAdapter.sharedContentKind} data-kibble-zone-adapter={zoneAdapter.adapterId} data-kibble-zone-variant={presentation?.decision.relatedCopyVariantId ?? zoneAdapter.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter.inputSha256} data-aisles-zone-instance={zoneAdapter.instanceId} data-aisles-zone-label="Related products" data-aisles-authority={presentationModelCallCount > 0 ? 'model' : (zoneAdapter.decisionMode ?? 'fixed')} data-aisles-model-calls={presentationModelCallCount} data-aisles-model-eligible={relatedModelDecision?.zoneId === 'pdp.related' ? 'true' : undefined} data-aisles-pdp-model-eligible={relatedModelDecision?.zoneId === 'pdp.related' ? 'true' : undefined}><div class="kc-reference-container"><h2 class="kc-reference-display">{presentationModelCallCount > 0 ? (presentation?.relatedHeading ?? relatedHeading) : relatedHeading}</h2><div class="kc-reference-product-grid">{#each zoneAdapter.content.props.products as productRef (productRef.productId)}{@const related = relatedByEntityId.get(productRef.productId)}{#if related}<KibbleProductCard product={related} productHref={relatedProductHrefs[related.id]} />{/if}{/each}</div></div></div>
	{/if}
</article>
