<script lang="ts">
	import type { Product } from '$lib/types';

	let { category, products }: { category: { name: string; slug: string }; products: Product[] } = $props();

	const hero = $derived(products[0]);
	const rest = $derived(products.slice(1));
</script>

<!-- Gatherer: Editorial, magazine-style, story-first -->
<div>
	<!-- Editorial header -->
	<div class="mb-12">
		<p class="text-xs font-medium uppercase tracking-widest text-surface-muted-fg">The {category.name} Edit</p>
		<h1 class="mt-3 text-3xl sm:text-4xl">Pieces that earn their place</h1>
		<p class="mt-4 max-w-lg text-surface-muted-fg leading-relaxed">
			{#if category.slug === 'living-room'}
				Sofas built to hold up to real life. Tables you don't have to baby. The living room you'll actually use.
			{:else if category.slug === 'office'}
				A workspace that works as hard as you do. Desks, chairs, and storage that make the hours better.
			{:else}
				Browse at your pace. Every piece here was chosen for a reason.
			{/if}
		</p>
	</div>

	<!-- Featured hero product -->
	{#if hero}
		<a
			href="/product/{hero.id}"
			class="group mb-12 block border-b border-surface-border pb-12"
		>
			<div class="grid gap-8 lg:grid-cols-5">
				<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted lg:col-span-3">
					{#if hero.image}
						<img
							src={hero.image}
							alt={hero.imageAlt}
							class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
							loading="eager"
						/>
					{/if}
				</div>

				<div class="flex flex-col justify-center lg:col-span-2">
					<p class="text-xs font-medium uppercase tracking-widest text-primary">Featured</p>
					<h2 class="mt-3 font-display text-2xl sm:text-3xl">{hero.name}</h2>
					<p class="mt-4 leading-relaxed text-surface-muted-fg">{hero.description}</p>

					{#if Object.keys(hero.specs).length > 0}
						<dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-2">
							{#each Object.entries(hero.specs).slice(0, 4) as [key, value]}
								<div>
									<dt class="text-xs text-surface-muted-fg">{key}</dt>
									<dd class="text-sm font-medium">{value}</dd>
								</div>
							{/each}
						</dl>
					{/if}

					<div class="mt-6">
						{#if hero.salePrice}
							<span class="text-xl font-medium text-primary">${hero.salePrice.toLocaleString()}</span>
							<span class="ml-2 text-surface-muted-fg line-through">${hero.price.toLocaleString()}</span>
						{:else}
							<span class="text-xl font-medium">${hero.price.toLocaleString()}</span>
						{/if}
					</div>

					<span class="mt-6 text-sm font-medium text-primary group-hover:underline">View details &rarr;</span>
				</div>
			</div>
		</a>
	{/if}

	<!-- Editorial 2-column grid -->
	<div class="grid gap-x-6 gap-y-10 sm:grid-cols-2">
		{#each rest as product}
			<a href="/product/{product.id}" class="group">
				<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
					{#if product.image}
						<img
							src={product.image}
							alt={product.imageAlt}
							class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
							loading="lazy"
						/>
					{/if}
				</div>

				<div class="mt-4">
					<h3 class="font-display text-lg group-hover:text-primary transition-colors">{product.name}</h3>
					<p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-surface-muted-fg">{product.description}</p>
					<div class="mt-3">
						{#if product.salePrice}
							<span class="font-medium text-primary">${product.salePrice.toLocaleString()}</span>
							<span class="ml-1.5 text-sm text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
						{:else}
							<span class="font-medium">${product.price.toLocaleString()}</span>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>
