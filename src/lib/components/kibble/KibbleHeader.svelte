<script lang="ts">
	import './kibble-reference.css';
	import KibbleMobileNavigation from './KibbleMobileNavigation.svelte';
	import type { KibbleAutoRefillState, KibbleChromeCopy, KibbleNavItem, KibbleStatusItem } from './types';

	let {
		brandName,
		navItems,
		autoRefillState,
		statusLabel,
		statusItems,
		copy,
		cartCount = 0,
		picksCount = 0,
		searchAction,
		accountHref,
		cartHref,
		picksHref,
		onCartClick,
		onPicksClick,
	}: {
		brandName: string;
		navItems: KibbleNavItem[];
		autoRefillState?: KibbleAutoRefillState;
		statusLabel: string;
		statusItems: KibbleStatusItem[];
		copy: KibbleChromeCopy;
		cartCount?: number;
		picksCount?: number;
		searchAction: string;
		accountHref?: string;
		cartHref?: string;
		picksHref?: string;
		onCartClick?: () => void;
		onPicksClick?: () => void;
	} = $props();

	let drawerOpen = $state(false);
	let searchOpen = $state(false);
	const autoRefillStatus = $derived(autoRefillState ? `${statusLabel} · ${autoRefillState}` : statusLabel);
</script>

<a href="#kibble-main" class="kibble-reference kc-reference-skip-link kc-reference-focus">{copy.skipLabel}</a>

<div class="kibble-reference kc-reference-status" aria-label={autoRefillStatus}>
		<div class="kc-reference-container kc-reference-status__inner">
			<span class="kc-reference-status__item kc-reference-status__item--emphasis">{autoRefillStatus}</span>
			{#each statusItems as item (item.label)}
				<span class="kc-reference-status__item">{item.label}</span>
			{/each}
		</div>
</div>

<header class:kc-reference-header--searching={searchOpen} class="kibble-reference kc-reference-header">
	<div class="kc-reference-container kc-reference-header__inner">
			<button
				type="button"
				onclick={() => (drawerOpen = true)}
				aria-label="Open navigation menu"
				aria-expanded={drawerOpen}
				aria-controls="kibble-reference-mobile-navigation"
				class="kc-reference-menu-control kc-reference-focus"
			>
				<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
			</button>

			<a href="/" class="kc-reference-wordmark kc-reference-focus" aria-label={brandName}>
				{brandName.split('&')[0]}{#if brandName.includes('&')}<span class="kc-reference-wordmark__ampersand">&amp;</span>{brandName.split('&').slice(1).join('&')}{/if}
			</a>

			<nav class="kc-reference-header__nav" aria-label={copy.catalogLabel}>
				{#each navItems as item (item.href)}
					<a href={item.href} class="kc-reference-header__nav-link kc-reference-focus">{item.label}</a>
				{:else}
					<span class="kc-reference-header__nav-link">{copy.catalogEmptyLabel}</span>
				{/each}
			</nav>

			<div class="kc-reference-header__controls">
				{#if searchOpen}
					<form method="GET" action={searchAction} class="kc-reference-search" role="search">
						<label class="sr-only" for="kibble-reference-search">{copy.searchLabel}</label>
						<input id="kibble-reference-search" name="q" type="search" placeholder={copy.searchPlaceholder} class="kc-reference-focus" />
						<button type="button" onclick={() => (searchOpen = false)} aria-label="Close search" class="kc-reference-icon-control kc-reference-focus">
							<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
						</button>
					</form>
				{:else}
					<button type="button" onclick={() => (searchOpen = true)} class="kc-reference-text-control kc-reference-focus" aria-label={copy.searchLabel}>
						<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
						<span class="kc-reference-header__search-label" style="margin-left:0.4rem;">{copy.searchLabel}</span>
					</button>
				{/if}

				{#if accountHref}<a href={accountHref} class="kc-reference-text-control kc-reference-focus kc-reference-header__account">{copy.accountLabel}</a>{/if}

				{#if onPicksClick}
					<div class="kc-reference-control-wrap kc-reference-header__picks">
						<button type="button" onclick={onPicksClick} class="kc-reference-icon-control kc-reference-focus" aria-label="{copy.savedPicksLabel} ({picksCount})">
							<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 21-1.45-1.32C5.4 15 2 11.92 2 8.14 2 5.06 4.42 3 7.5 3A6 6 0 0 1 12 5.09 6 6 0 0 1 16.5 3C19.58 3 22 5.06 22 8.14c0 3.78-3.4 6.86-8.55 11.54Z"/></svg>
						</button>
						{#if picksCount > 0}<span class="kc-reference-control-badge">{picksCount}</span>{/if}
					</div>
				{:else if picksHref}
					<div class="kc-reference-control-wrap kc-reference-header__picks">
						<a href={picksHref} class="kc-reference-icon-control kc-reference-focus" aria-label="{copy.savedPicksLabel} ({picksCount})">
							<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 21-1.45-1.32C5.4 15 2 11.92 2 8.14 2 5.06 4.42 3 7.5 3A6 6 0 0 1 12 5.09 6 6 0 0 1 16.5 3C19.58 3 22 5.06 22 8.14c0 3.78-3.4 6.86-8.55 11.54Z"/></svg>
						</a>
						{#if picksCount > 0}<span class="kc-reference-control-badge">{picksCount}</span>{/if}
					</div>
				{/if}

				<div class="kc-reference-control-wrap">
					{#if onCartClick}
						<button type="button" onclick={onCartClick} class="kc-reference-icon-control kc-reference-focus" aria-label="Cart ({cartCount} items)">
							<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
						</button>
					{:else if cartHref}
						<a href={cartHref} class="kc-reference-icon-control kc-reference-focus" aria-label="Cart ({cartCount} items)">
							<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
						</a>
					{:else}
						<button type="button" disabled class="kc-reference-icon-control" aria-label={copy.cartUnavailableLabel}>
							<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
						</button>
					{/if}
					{#if cartCount > 0}<span class="kc-reference-control-badge">{cartCount}</span>{/if}
				</div>
			</div>
	</div>
</header>

<KibbleMobileNavigation
	bind:open={drawerOpen}
	{brandName}
	{navItems}
	{copy}
	{cartCount}
	{picksCount}
	{accountHref}
	{cartHref}
	{picksHref}
	{onCartClick}
	{onPicksClick}
/>
