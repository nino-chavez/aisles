<script lang="ts">
	import { getBrand } from '$lib/brand/config';

	let { brandName = 'Haven', tagline = '', footerNote = '' }: { brandName?: string; tagline?: string; footerNote?: string } = $props();

	const brand = getBrand();
	const categories = Object.entries(brand.categories).map(([slug, config]) => ({
		label: config.displayName,
		href: `/category/${slug}`,
	}));
</script>

<footer class="border-t border-surface-border">
	<div class="mx-auto max-w-7xl px-6 py-16">
		<div class="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Brand -->
			<div>
				<span class="font-display text-xl text-surface-fg">{brandName}</span>
				{#if tagline}
					<p class="mt-3 text-sm leading-relaxed text-surface-muted-fg">{tagline}</p>
				{/if}
			</div>

			<!-- Shop -->
			<div>
				<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Shop</h4>
				<ul class="mt-4 space-y-2.5">
					{#each categories as cat}
						<li><a href={cat.href} class="text-sm text-surface-fg hover:text-primary">{cat.label}</a></li>
					{/each}
				</ul>
			</div>

			<!-- About -->
			<div>
				<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">About</h4>
				<ul class="mt-4 space-y-2.5">
					<li><a href="/style-guide" class="text-sm text-surface-fg hover:text-primary">Style Guide</a></li>
				</ul>
			</div>

			<!-- Support -->
			<div>
				<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Support</h4>
				<ul class="mt-4 space-y-2.5">
					<li><a href="/checkout" class="text-sm text-surface-fg hover:text-primary">Checkout</a></li>
				</ul>
			</div>
		</div>

		<div class="mt-12 border-t border-surface-border pt-8 text-xs text-surface-muted-fg">
			<p>{footerNote || brandName + ' is a demo storefront'} &middot; BigCommerce &middot; Signal X Studio</p>
		</div>
	</div>
</footer>
