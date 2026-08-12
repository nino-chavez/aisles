<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.brandName} — {data.brandTagline}</title>
	<meta name="description" content="{data.homepage.heroBody}" />
</svelte:head>

<!-- Returning visitor banner -->
{#if data.storedPersona && data.storedCategory}
	<div class="border-b border-surface-border bg-surface-muted">
		<div class="mx-auto max-w-7xl px-6 py-3 text-center text-sm text-surface-muted-fg">
			Welcome back — <a href="/category/{data.storedCategory}" class="font-medium text-primary hover:text-secondary">continue browsing {data.storedCategory.replace('-', ' ')}</a>
		</div>
	</div>
{/if}

<!-- Hero -->
<section class="border-b border-surface-border">
	<div class="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:py-36">
		<div class="max-w-xl">
			<h1 class="text-4xl leading-tight sm:text-5xl lg:text-6xl">
				{data.homepage.heroHeadline}
			</h1>
			<p class="mt-6 text-lg leading-relaxed text-surface-muted-fg">
				{data.homepage.heroBody}
			</p>
			<div class="mt-10 flex flex-wrap gap-3">
				{#each data.categories.map((c, i) => ({ label: c.name, href: `/category/${c.slug}`, primary: i === 0 })) as cta}
					<a
						href={cta.href}
						class="inline-flex items-center rounded-sm px-5 py-2.5 text-sm font-medium transition-colors
							{cta.primary
								? 'bg-surface-fg text-surface-bg hover:opacity-85'
								: 'border border-surface-border text-surface-fg hover:bg-surface-fg hover:text-surface-bg'}"
					>
						{cta.label}
					</a>
				{/each}
			</div>
		</div>
	</div>
</section>

<!-- Featured products -->
{#if data.featured.length > 0}
	<section class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
		<h2 class="text-3xl">Featured</h2>
		<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each data.featured as product}
				<a href="/product/{product.id}" class="group">
					<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
						{#if product.image}
							<img
								src={product.image}
								alt={product.imageAlt}
								width={400}
								height={300}
								decoding="async"
								class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
								loading="lazy"
							/>
						{/if}
					</div>
					<div class="mt-4">
						<h3 class="font-display text-lg group-hover:text-primary transition-colors">{product.name}</h3>
						<div class="mt-1">
							{#if product.salePrice}
								<span class="font-medium text-primary numeric">${product.salePrice.toLocaleString()}</span>
								<span class="ml-1 text-sm text-surface-muted-fg line-through numeric">${product.price.toLocaleString()}</span>
							{:else}
								<span class="font-medium numeric">${product.price.toLocaleString()}</span>
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	</section>
{/if}

<!-- Category grid -->
<section class="border-t border-surface-border">
	<div class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
		<h2 class="text-3xl">Shop by Category</h2>
		<div class="mt-10 grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2">
			{#each data.categories as cat}
				<a
					href="/category/{cat.slug}"
					class="group relative flex flex-col justify-end bg-surface-card p-8 transition-colors hover:bg-surface-muted"
					style="min-height: 180px;"
				>
					<h3 class="font-display text-xl">{cat.name}</h3>
					<span class="mt-2 text-sm text-primary group-hover:underline">Browse &rarr;</span>
				</a>
			{/each}
		</div>
	</div>
</section>

<!-- Editorial band -->
<section class="border-t border-surface-border bg-surface-muted">
	<div class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
		<div class="grid items-center gap-12 lg:grid-cols-2">
			<div>
				<h2 class="text-3xl">{data.homepage.editorialHeadline}</h2>
				<p class="mt-4 text-surface-muted-fg leading-relaxed">
					{data.homepage.editorialBody}
				</p>
				{#if data.categories[0]}
					<a
						href="/category/{data.categories[0].slug}"
						class="mt-6 inline-block text-sm font-medium text-primary hover:text-secondary"
					>
						Start browsing &rarr;
					</a>
				{/if}
			</div>
			{#if data.featured[0]?.image}
				<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-border">
					<img src={data.featured[0].image} alt={data.featured[0].imageAlt} class="h-full w-full object-cover" loading="lazy" decoding="async" />
				</div>
			{:else}
				<div class="aspect-[4/3] rounded-sm bg-surface-border"></div>
			{/if}
		</div>
	</div>
</section>

<!-- Value props -->
<section class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
	<div class="grid gap-12 sm:grid-cols-3">
		{#each data.homepage.valueProps as prop}
			<div>
				<h3 class="font-display text-lg">{prop.title}</h3>
				<p class="mt-2 text-sm leading-relaxed text-surface-muted-fg">
					{prop.body}
				</p>
			</div>
		{/each}
	</div>
</section>
