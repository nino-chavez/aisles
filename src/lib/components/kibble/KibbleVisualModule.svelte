<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleVisualTile } from './types';

	let {
		variant,
		title,
		eyebrow,
		tiles,
		columns = variant === 'routine' ? 3 : 4,
	}: {
		variant: 'routine' | 'category';
		title: string;
		eyebrow?: string;
		tiles: KibbleVisualTile[];
		columns?: 2 | 3 | 4;
	} = $props();

	const headingId = $derived(`kibble-${variant}-heading`);
</script>

{#if tiles.length > 0}
	<section class="kibble-reference kc-reference-section kc-reference-section--muted" aria-labelledby={headingId}>
		<div class="kc-reference-container">
			{#if eyebrow}<p class="kc-reference-eyebrow">{eyebrow}</p>{/if}
			<h2 id={headingId} class="kc-reference-section__title">{title}</h2>

			<div class="kc-reference-visual-grid kc-reference-visual-grid--{columns}">
				{#each tiles as tile (tile.href)}
					<a href={tile.href} class="kc-reference-visual-card kc-reference-focus">
						<div class="kc-reference-visual-card__media">
							{#if tile.image}<img src={tile.image} alt={tile.imageAlt ?? tile.label} loading="lazy" decoding="async" />{/if}
						</div>
						<div class="kc-reference-visual-card__body">
							<div>
								<h3 class="kc-reference-visual-card__label">{tile.label}</h3>
								{#if tile.description}<p class="kc-reference-visual-card__description">{tile.description}</p>{/if}
							</div>
							<span aria-hidden="true" class="kc-reference-visual-card__arrow">→</span>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}
