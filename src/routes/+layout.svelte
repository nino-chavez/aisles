<script lang="ts">
	import '../app.css';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import CartDrawer from '$lib/components/CartDrawer.svelte';
	import PicksTray from '$lib/components/PicksTray.svelte';
	import { KibbleFooter, KibbleHeader } from '$lib/components/kibble';
	import { pickCount } from '$lib/stores/picks.svelte';
	import { initEmitter, destroyEmitter, getEmitter } from '$lib/signals/emitter';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
	let brandName = $derived(data.brand?.name ?? 'Haven');
	let brandTagline = $derived(data.brand?.tagline ?? '');
	let brandFooterNote = $derived(data.brand?.footerNote ?? '');
	let themeStyle = $derived.by(() => {
		const t = data.brand?.theme;
		if (!t) return '';
		return `--color-primary:${t.primary};--color-secondary:${t.secondary};--color-accent:${t.accent};--color-surface-bg:${t.surfaceBg};--color-surface-fg:${t.surfaceFg};--color-surface-card:${t.surfaceCard};--color-surface-card-fg:${t.surfaceCardFg};--color-surface-muted:${t.surfaceMuted};--color-surface-muted-fg:${t.surfaceMutedFg};--color-surface-border:${t.surfaceBorder};--font-display:${t.fontDisplay};--font-body:${t.fontBody};--font-mono:${t.fontMono};--font-weight-display:${t.fontWeightDisplay};--heading-tracking:${t.headingTracking};--font-numeric:${t.numericStyle === 'mono' ? t.fontMono : t.fontBody}`;
	});
	let cartCount = $state(0);
	let cartOpen = $state(false);
	let picksOpen = $state(false);
	let picksCount = $state(0);

	// Track picks count reactively
	$effect(() => {
		if (data.chromeMode === 'reference') return;
		picksCount = pickCount();
		const handlePicksUpdate = (e: Event) => {
			picksCount = (e as CustomEvent).detail?.count ?? pickCount();
		};
		window.addEventListener('picks-updated', handlePicksUpdate);
		return () => window.removeEventListener('picks-updated', handlePicksUpdate);
	});

	// Svelte's body class directive is not emitted for this root layout build.
	// Own the page-level Preserve surface explicitly and remove it on teardown.
	$effect(() => {
		const className = 'kibble-reference-body';
		document.body.classList.toggle(className, data.chromeMode === 'reference');
		return () => document.body.classList.remove(className);
	});

	// Observe dashboard uses its own chrome-less shell
	let isObserve = $derived($page.url.pathname.startsWith('/observe'));

	// ─── Signal Emitter (client-side singleton) ────────────────────
	$effect(() => {
		initEmitter();
		return () => destroyEmitter();
	});

	afterNavigate(({ to, from }) => {
		const emitter = getEmitter();
		if (!emitter || !to?.url) return;

		const toPath = to.url.pathname;
		const fromPath = from?.url.pathname || null;

		// Category navigation
		const category = toPath.match(/^\/category\/([^/]+)/)?.[1] || null;
		if (category) {
			emitter.emit('nav.category_view', {
				category,
				fromCategory: fromPath?.match(/^\/category\/([^/]+)/)?.[1] || null,
				fromPage: fromPath,
			});
		}

		// Product page view
		const product = toPath.match(/^\/product\/([^/]+)/)?.[1] || null;
		if (product) {
			emitter.emit('nav.product_view', {
				productId: product,
				fromPage: fromPath,
			});
		}

		// Back navigation: went from product page back to category grid
		const fromProduct = fromPath?.match(/^\/product\//);
		const toCategory = toPath.match(/^\/category\//);
		if (fromProduct && toCategory) {
			emitter.emit('nav.back', {
				fromProduct: fromPath,
				toCategory: toPath,
			});
		}
	});

	// ─── Cart ──────────────────────────────────────────────────────
	$effect(() => {
		if (data.chromeMode === 'reference') return;
		fetch('/api/cart')
			.then((res) => res.json())
			.then((data) => { cartCount = data.itemCount || 0; })
			.catch(() => {});

		const handleCartUpdate = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.itemCount !== undefined) {
				cartCount = detail.itemCount;
			}
		};

		window.addEventListener('cart-updated', handleCartUpdate);
		return () => window.removeEventListener('cart-updated', handleCartUpdate);
	});

	function openCart() {
		cartOpen = true;
	}

	function closeCart() {
		cartOpen = false;
		fetch('/api/cart')
			.then((res) => res.json())
			.then((data) => { cartCount = data.itemCount || 0; })
			.catch(() => {});
	}
</script>

<svelte:head>
	{#if data.brand?.googleFontsUrl}
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
		<link href={data.brand.googleFontsUrl} rel="stylesheet" />
	{/if}
</svelte:head>

<div style={themeStyle}>
	{#if isObserve}
		{@render children()}
	{:else}
		<div class="flex min-h-screen flex-col">
			{#if data.chromeMode === 'reference' && data.kibbleChrome}
				<KibbleHeader
					{brandName}
					navItems={data.kibbleChrome.navItems}
					statusLabel={data.kibbleChrome.statusLabel}
					statusItems={data.kibbleChrome.statusItems}
					copy={data.kibbleChrome.copy}
					{cartCount}
					{picksCount}
					searchAction={data.kibbleChrome.searchAction}
				/>
			{:else}
				<Nav {cartCount} {picksCount} onCartClick={openCart} onPicksClick={() => picksOpen = true} {brandName} categories={data.brand?.categories ?? {}} />
			{/if}
			<main id={data.chromeMode === 'reference' ? 'kibble-main' : undefined} class="flex-1" tabindex="-1">
				{@render children()}
			</main>
			{#if data.chromeMode === 'reference' && data.kibbleChrome}
				<KibbleFooter {...data.kibbleChrome.footer} />
			{:else}
				<Footer {brandName} footerNote={brandFooterNote} tagline={brandTagline} />
			{/if}
		</div>

		{#if data.chromeMode !== 'reference'}
			<CartDrawer open={cartOpen} onclose={closeCart} />
			<PicksTray open={picksOpen} onclose={() => picksOpen = false} />
		{/if}
	{/if}
</div>
