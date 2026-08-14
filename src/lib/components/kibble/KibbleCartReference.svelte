<script lang="ts">
	import './kibble-reference.css';
	import { KIBBLE_COMMERCE_COPY, type KibbleCartView, type KibbleCommerceCopy, type KibbleZoneAdapterBinding } from './types';

	let {
		availabilityMessage,
		policyVersion,
		zoneAdapter,
		cartModelDecision = null,
		presentationModelCallCount = 0,
		commerceEnabled = false,
		commerceCopy = KIBBLE_COMMERCE_COPY,
		cart = null,
		cartError = null,
	}: {
		availabilityMessage: string;
		policyVersion?: string;
		zoneAdapter?: KibbleZoneAdapterBinding<any> | null;
		cartModelDecision?: { zoneId: 'cart.empty-state'; routePath: '/cart'; policyVersion: string } | null;
		presentationModelCallCount?: number;
		commerceEnabled?: boolean;
		commerceCopy?: KibbleCommerceCopy;
		cart?: KibbleCartView | null;
		cartError?: string | null;
	} = $props();

	let currentCart = $state<KibbleCartView | null | undefined>(undefined);
	let items = $state<KibbleCartView['lineItems']['physicalItems'] | undefined>(undefined);
	let isUpdating = $state<string | null>(null);
	let isCheckingOut = $state(false);
	let actionError = $state('');
	const activeCart = $derived(currentCart === undefined ? cart : currentCart);
	const activeItems = $derived(items === undefined ? cart?.lineItems.physicalItems ?? [] : items);

	$effect(() => {
		currentCart = cart;
		items = cart?.lineItems.physicalItems ?? [];
		actionError = cartError ?? '';
	});

	const itemCount = $derived(activeItems.reduce((sum, item) => sum + item.quantity, 0));
	const total = $derived(activeCart?.amount.value ?? activeItems.reduce((sum, item) => sum + (item.extendedSalePrice?.value ?? item.salePrice?.value ?? item.listPrice.value) * item.quantity, 0));
	const currencyCode = $derived(activeCart?.currencyCode ?? 'USD');
	const backendState = $derived(!commerceEnabled ? 'unavailable' : actionError ? 'error' : activeItems.length > 0 ? 'loaded' : 'empty');

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value);
	}

	function productHref(path: string | null): string | null {
		if (!path) return null;
		try {
			const pathname = new URL(path, 'https://commerce.invalid').pathname;
			const slug = pathname.replace(/^\/+|\/+$/g, '');
			return /^[a-z0-9][a-z0-9-]*$/.test(slug) ? `/product/${slug}` : null;
		} catch {
			return null;
		}
	}

	async function updateQuantity(item: KibbleCartView['lineItems']['physicalItems'][number], quantity: number): Promise<void> {
		if (isUpdating) return;
		isUpdating = item.entityId;
		actionError = '';
		try {
			const response = await fetch('/api/cart', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lineItemEntityId: item.entityId, quantity }),
			});
			const result = await response.json() as { cart?: KibbleCartView | null; itemCount?: number; error?: string };
			if (!response.ok) throw new Error(result.error || commerceCopy.cartErrorLabel);
			currentCart = result.cart ?? null;
			items = result.cart?.lineItems.physicalItems ?? [];
			window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: result.itemCount ?? 0 } }));
		} catch (error) {
			actionError = error instanceof Error ? error.message : commerceCopy.cartErrorLabel;
		} finally {
			isUpdating = null;
		}
	}

	async function checkout(): Promise<void> {
		if (!activeCart || isCheckingOut) return;
		isCheckingOut = true;
		actionError = '';
		try {
			const response = await fetch('/api/checkout/redirect', { method: 'POST' });
			const result = await response.json() as { url?: string; error?: string };
			if (!response.ok || !result.url) throw new Error(result.error || commerceCopy.checkoutErrorLabel);
			window.location.assign(result.url);
		} catch (error) {
			actionError = error instanceof Error ? error.message : commerceCopy.checkoutErrorLabel;
			isCheckingOut = false;
		}
	}
</script>

<div class="kibble-reference kc-reference-route kc-reference-cart-page" data-kibble-route-shell="cart" data-kibble-route-policy={policyVersion} data-kibble-backend-state={backendState} aria-labelledby="kibble-cart-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">Cart</span>
		</nav>
		<header class="kc-reference-route__header">
			<h1 id="kibble-cart-heading" class="kc-reference-display">Your cart</h1>
			{#if commerceEnabled && itemCount > 0}<p class="kc-reference-machinery">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>{/if}
		</header>

		{#if !commerceEnabled}
			<div class="kc-reference-route__empty">
				<p>{availabilityMessage}</p>
				{#if zoneAdapter}
					<section id="kibble-cart-empty-state" tabindex="-1" data-kibble-zone-instance={zoneAdapter.instanceId} data-kibble-zone-status={zoneAdapter.sharedStatus} data-kibble-zone-content-kind={zoneAdapter.sharedContentKind} data-kibble-zone-adapter={zoneAdapter.adapterId} data-kibble-zone-variant={zoneAdapter.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter.inputSha256} data-aisles-zone-instance={zoneAdapter.instanceId} data-aisles-zone-label="Cart recovery" data-aisles-authority={presentationModelCallCount > 0 ? 'model' : (zoneAdapter.decisionMode ?? 'fixed')} data-aisles-model-calls={presentationModelCallCount} data-aisles-model-eligible={cartModelDecision ? 'true' : undefined} data-aisles-cart-model-eligible={cartModelDecision ? 'true' : undefined}>
						<p class="kc-reference-eyebrow">{zoneAdapter.content.props.eyebrow}</p>
						<h2>{zoneAdapter.content.props.headline}</h2>
						<p class="kc-reference-route__supporting">{zoneAdapter.content.props.body}</p>
					</section>
				{:else}
					<p class="kc-reference-route__supporting">No cart was read, created, priced, or changed.</p>
				{/if}
				<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">Start shopping</a>
				<a href="/checkout/prepaid" class="kc-reference-route__text-link kc-reference-focus">View checkout presentation boundary</a>
			</div>
		{:else if actionError}
			<div class="kc-reference-route__empty" role="alert">
				<p>{actionError}</p>
				<a href="/cart" class="kc-reference-button kc-reference-button--primary kc-reference-focus">Try again</a>
			</div>
		{:else if activeItems.length === 0}
			<div class="kc-reference-route__empty">
				<p>{availabilityMessage}</p>
				<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">Start shopping</a>
			</div>
		{:else}
			<div class="kc-reference-cart__layout">
				<ul class="kc-reference-cart__items" aria-label="Cart items">
					{#each activeItems as item (item.entityId)}
						<li class="kc-reference-cart__item">
							{#if item.imageUrl}<img src={item.imageUrl} alt={item.name} width="112" height="112" loading="lazy" />{:else}<div class="kc-reference-cart__image" aria-hidden="true"></div>{/if}
							<div class="kc-reference-cart__item-detail">
								{#if productHref(item.path)}<a class="kc-reference-focus" href={productHref(item.path)}><h2>{item.name}</h2></a>{:else}<h2>{item.name}</h2>{/if}
								{#if item.selectedOptions.length > 0}<ul class="kc-reference-cart__options">{#each item.selectedOptions as option (option.entityId)}{#if option.value}<li>{option.name}: {option.value}</li>{/if}{/each}</ul>{/if}
								<p>{money(item.salePrice?.value ?? item.listPrice.value)} each</p>
								<div class="kc-reference-cart__quantity" aria-label={`Quantity for ${item.name}`}>
									<button type="button" class="kc-reference-focus" disabled={isUpdating === item.entityId} onclick={() => updateQuantity(item, item.quantity - 1)} aria-label={`Decrease quantity of ${item.name}`}>−</button>
									<span>{item.quantity}</span>
									<button type="button" class="kc-reference-focus" disabled={isUpdating === item.entityId || item.quantity >= 99} onclick={() => updateQuantity(item, item.quantity + 1)} aria-label={`Increase quantity of ${item.name}`}>+</button>
									<button type="button" class="kc-reference-route__text-link kc-reference-focus" disabled={isUpdating === item.entityId} onclick={() => updateQuantity(item, 0)}>Remove</button>
								</div>
							</div>
							<strong>{money(item.extendedSalePrice?.value ?? (item.salePrice?.value ?? item.listPrice.value) * item.quantity)}</strong>
						</li>
					{/each}
				</ul>
				<aside class="kc-reference-cart__summary" aria-label="Cart summary">
					<p class="kc-reference-eyebrow">Order summary</p>
					<div><span>Cart total</span><strong>{money(total)}</strong></div>
					<p class="kc-reference-route__supporting">Taxes, shipping, promotions, and payment are calculated in hosted checkout.</p>
					<button type="button" class="kc-reference-button kc-reference-button--primary kc-reference-focus" disabled={isCheckingOut} onclick={() => void checkout()}>{isCheckingOut ? commerceCopy.checkingOutLabel : commerceCopy.checkoutLabel}</button>
				</aside>
			</div>
		{/if}
	</div>
</div>
