<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'primary',
		size = 'md',
		shape = 'pill',
		disabled = false,
		loading = false,
		fullWidth = false,
		href,
		type = 'button',
		ariaLabel,
		onclick,
		children,
	}: {
		variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
		size?: 'lg' | 'md' | 'sm' | 'xs';
		shape?: 'pill' | 'rounded' | 'square';
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		/** When set, renders an <a> instead of a <button>. */
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		ariaLabel?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();

	// primary uses the brand accent; secondary inverts to surface-fg on white;
	// tertiary is outline-only; ghost is text-only (chrome buttons);
	// danger is a deeper red distinct from the brand action color.
	const variantClass = $derived(
		{
			primary:
				'bg-primary text-white hover:bg-primary/90 active:bg-primary/85 disabled:bg-primary/50',
			secondary:
				'bg-surface-fg text-surface-bg hover:bg-surface-fg/85 active:bg-surface-fg/75 disabled:bg-surface-fg/40',
			tertiary:
				'border border-surface-border bg-surface-card text-surface-fg hover:border-primary hover:text-primary active:bg-surface-muted disabled:opacity-50',
			ghost:
				'text-surface-muted-fg hover:bg-surface-muted hover:text-surface-fg active:bg-surface-muted/70 disabled:opacity-40',
			danger:
				'bg-error text-white hover:bg-error/90 active:bg-error/85 disabled:bg-error/50',
		}[variant]
	);

	const sizeClass = $derived(
		{
			lg: 'h-14 px-6 text-sm font-semibold',
			md: 'h-11 px-5 text-sm font-medium',
			sm: 'h-9 px-4 text-[0.8125rem] font-medium',
			xs: 'h-7 px-3 text-xs font-medium',
		}[size]
	);

	const shapeClass = $derived(
		{
			pill: 'rounded-full',
			rounded: 'rounded-md',
			square: 'rounded-sm',
		}[shape]
	);

	const widthClass = $derived(fullWidth ? 'w-full' : '');

	const composedClass = $derived(
		`inline-flex items-center justify-center gap-2 transition-colors uppercase tracking-wider disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${shapeClass} ${widthClass}`
	);
</script>

{#if href && !disabled}
	<a
		{href}
		class={composedClass}
		aria-label={ariaLabel}
		aria-busy={loading || undefined}
		role="button"
	>
		{#if loading}
			<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<path d="M21 12a9 9 0 1 1-6.219-8.56" />
			</svg>
		{/if}
		{@render children()}
	</a>
{:else}
	<button
		{type}
		class={composedClass}
		disabled={disabled || loading}
		aria-label={ariaLabel}
		aria-busy={loading || undefined}
		{onclick}
	>
		{#if loading}
			<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<path d="M21 12a9 9 0 1 1-6.219-8.56" />
			</svg>
		{/if}
		{@render children()}
	</button>
{/if}
