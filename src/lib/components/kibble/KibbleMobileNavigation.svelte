<script lang="ts">
	import { tick } from 'svelte';
	import './kibble-reference.css';
	import type { KibbleNavItem } from './types';

	let {
		open = $bindable(false),
		brandName,
		navItems,
		cartCount = 0,
		picksCount = 0,
		accountHref,
		cartHref,
		picksHref,
		onCartClick,
		onPicksClick,
	}: {
		open?: boolean;
		brandName: string;
		navItems: KibbleNavItem[];
		cartCount?: number;
		picksCount?: number;
		accountHref?: string;
		cartHref?: string;
		picksHref?: string;
		onCartClick?: () => void;
		onPicksClick?: () => void;
	} = $props();

	let closeButton: HTMLButtonElement | undefined = $state();
	let drawer: HTMLDivElement | undefined = $state();
	let previousFocus: HTMLElement | null = null;

	function close() {
		open = false;
	}

	function closeAndRun(callback?: () => void) {
		close();
		callback?.();
	}

	$effect(() => {
		if (!open) return;
		previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		void tick().then(() => closeButton?.focus());

		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') close();
			if (event.key !== 'Tab' || !drawer) return;
			const focusable = [...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')];
			const first = focusable[0];
			const last = focusable.at(-1);
			if (!first || !last) return;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		window.addEventListener('keydown', onKeydown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKeydown);
			previousFocus?.focus();
		};
	});
</script>

{#if open}
	<button
		type="button"
		onclick={close}
		aria-label="Close navigation"
		tabindex="-1"
		class="kibble-reference kc-reference-drawer-backdrop"
	></button>

	<div
		bind:this={drawer}
		id="kibble-reference-mobile-navigation"
		role="dialog"
		aria-modal="true"
		aria-label="Site navigation"
		tabindex="-1"
		class="kibble-reference kc-reference-drawer"
	>
		<div class="kc-reference-drawer__header">
			<a href="/" class="kc-reference-wordmark kc-reference-focus" onclick={close} aria-label={brandName}>
				{brandName.split('&')[0]}{#if brandName.includes('&')}<span class="kc-reference-wordmark__ampersand">&amp;</span>{brandName.split('&').slice(1).join('&')}{/if}
			</a>
			<button
				bind:this={closeButton}
				type="button"
				onclick={close}
				aria-label="Close navigation"
				class="kc-reference-icon-control kc-reference-focus"
			>
				<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
			</button>
		</div>

		<div class="kc-reference-drawer__body">
			<p class="kc-reference-drawer__label">Shop</p>
			<nav class="kc-reference-drawer__nav" aria-label="Catalog">
				{#each navItems as item (item.href)}
					<a href={item.href} onclick={close} class="kc-reference-drawer__link kc-reference-focus">{item.label}</a>
				{:else}
					<span class="kc-reference-drawer__link">Catalog loading…</span>
				{/each}
			</nav>

			{#if accountHref || onPicksClick || picksHref}
			<p class="kc-reference-drawer__label" style="margin-top: 2rem;">Account and saved items</p>
			<nav class="kc-reference-drawer__nav" aria-label="Account and saved items">
				{#if accountHref}<a href={accountHref} onclick={close} class="kc-reference-drawer__link kc-reference-focus">Account</a>{/if}
				{#if onPicksClick}
					<button type="button" onclick={() => closeAndRun(onPicksClick)} class="kc-reference-drawer__link kc-reference-focus" style="border:0;background:transparent;font:inherit;text-align:left;cursor:pointer;">
						Saved picks ({picksCount})
					</button>
				{:else if picksHref}
					<a href={picksHref} onclick={close} class="kc-reference-drawer__link kc-reference-focus">Saved picks ({picksCount})</a>
				{/if}
			</nav>
			{/if}
		</div>

		<div class="kc-reference-drawer__footer">
			{#if onCartClick}
				<button type="button" onclick={() => closeAndRun(onCartClick)} class="kc-reference-drawer__cart kc-reference-focus">
					<span>View cart</span><span class="kc-reference-machinery">{cartCount || 'empty'}</span>
				</button>
			{:else if cartHref}
				<a href={cartHref} onclick={close} class="kc-reference-drawer__cart kc-reference-focus">
					<span>View cart</span><span class="kc-reference-machinery">{cartCount || 'empty'}</span>
				</a>
			{:else}
				<button type="button" disabled class="kc-reference-drawer__cart" aria-label="Cart unavailable">
					<span>Cart unavailable</span><span class="kc-reference-machinery">—</span>
				</button>
			{/if}
		</div>
	</div>
{/if}
