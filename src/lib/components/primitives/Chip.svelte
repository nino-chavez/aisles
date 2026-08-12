<script lang="ts">
	let {
		label,
		removable = false,
		onremove,
		variant = 'default',
		size = 'md',
		ariaLabel,
	}: {
		label: string;
		removable?: boolean;
		onremove?: () => void;
		variant?: 'default' | 'active';
		size?: 'sm' | 'md';
		ariaLabel?: string;
	} = $props();

	const sizeClass = $derived(size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-[0.8125rem]');
	const variantClass = $derived(
		variant === 'active'
			? 'border-primary bg-primary/10 text-primary'
			: 'border-surface-border bg-surface-card text-surface-fg hover:border-neutral-400'
	);
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-sm border font-medium transition-colors {sizeClass} {variantClass}"
	aria-label={ariaLabel ?? label}
>
	<span>{label}</span>
	{#if removable}
		<button
			type="button"
			onclick={onremove}
			aria-label="Remove {label}"
			class="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-current opacity-70 transition-opacity hover:bg-surface-muted hover:opacity-100"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
		</button>
	{/if}
</span>
