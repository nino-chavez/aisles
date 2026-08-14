<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleVisualTile, KibbleZoneAdapterBinding } from './types';

	let {
		variant,
		title,
		eyebrow,
		tiles,
		columns = variant === 'routine' ? 3 : 4,
		zoneAdapter,
		modelEligible = false,
		modelCallCount = 0,
		componentVariantId = 'four-column',
	}: {
		variant: 'routine' | 'category';
		title: string;
		eyebrow: string;
		tiles: KibbleVisualTile[];
		columns?: 2 | 3 | 4;
		zoneAdapter?: KibbleZoneAdapterBinding<{ component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } }>;
		modelEligible?: boolean;
		modelCallCount?: number;
		componentVariantId?: string;
	} = $props();

	const headingId = $derived(`kibble-${variant}-heading`);
</script>

{#if tiles.length > 0}
	<section class="kibble-reference kc-reference-section kc-reference-section--muted" aria-labelledby={headingId} data-kibble-zone-instance={zoneAdapter?.instanceId} data-kibble-zone-status={zoneAdapter?.sharedStatus} data-kibble-zone-content-kind={zoneAdapter?.sharedContentKind} data-kibble-zone-adapter={zoneAdapter?.adapterId} data-kibble-zone-variant={modelCallCount > 0 ? componentVariantId : zoneAdapter?.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter?.inputSha256} data-aisles-zone-instance={zoneAdapter?.instanceId ?? 'home.editorial-strip'} data-aisles-zone-label="Catalog entry" data-aisles-authority={modelCallCount > 0 ? 'model' : (zoneAdapter?.decisionMode ?? 'fixed')} data-aisles-model-calls={modelCallCount} data-aisles-model-eligible={modelEligible ? 'true' : undefined}>
		<div class="kc-reference-container">
			<p class="kc-reference-eyebrow">{modelCallCount > 0 ? eyebrow : (zoneAdapter?.content.props.eyebrow ?? eyebrow)}</p>
			<h2 id={headingId} class="kc-reference-section__title">{modelCallCount > 0 ? title : (zoneAdapter?.content.props.headline ?? title)}</h2>

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
