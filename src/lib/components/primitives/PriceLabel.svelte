<script lang="ts">
	let {
		price,
		listPrice,
		size = 'md',
		showSavings = true,
		comparableLabel = 'Was',
	}: {
		price: number;
		listPrice?: number | null;
		size?: 'sm' | 'md' | 'lg';
		showSavings?: boolean;
		/** Copy preceding the struck-through comparison price, e.g. "Was" or "Comparable value". */
		comparableLabel?: string;
	} = $props();

	const isOnSale = $derived(typeof listPrice === 'number' && listPrice > price);
	const savingsPct = $derived(
		isOnSale && listPrice ? Math.round(((listPrice - price) / listPrice) * 100) : 0
	);

	const fmt = (n: number) =>
		`$${n.toLocaleString(undefined, {
			minimumFractionDigits: n % 1 ? 2 : 0,
			maximumFractionDigits: 2,
		})}`;

	const priceClass = $derived(
		size === 'lg' ? 'text-2xl font-semibold' : size === 'sm' ? 'text-sm font-medium' : 'text-base font-medium'
	);
	const subClass = $derived(size === 'sm' ? 'text-[0.6875rem]' : 'text-xs');
</script>

<div class="inline-flex flex-col gap-0.5">
	{#if isOnSale && listPrice}
		<div class="flex items-baseline gap-2">
			<span class="{priceClass} numeric text-primary">{fmt(price)}</span>
			<span class="{subClass} numeric text-surface-muted-fg line-through">{fmt(listPrice)}</span>
		</div>
		<div class="{subClass} flex items-center gap-2 text-surface-muted-fg">
			<span>{comparableLabel} <span class="numeric">{fmt(listPrice)}</span></span>
			{#if showSavings && savingsPct > 0}
				<span class="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary">
					Save <span class="numeric">{savingsPct}%</span>
				</span>
			{/if}
		</div>
	{:else}
		<span class="{priceClass} numeric text-surface-fg">{fmt(price)}</span>
	{/if}
</div>
