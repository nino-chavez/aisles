<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleModelZoneAdapterBinding } from './types';
	type MarketingContent = { component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } };
	type VisibleMarketingArtifact = KibbleModelZoneAdapterBinding<MarketingContent> & { sharedContentKind: 'content'; content: MarketingContent };

	let {
		zoneArtifact,
	}: {
		zoneArtifact: VisibleMarketingArtifact;
	} = $props();
</script>

<aside
	id={`kibble-${zoneArtifact.instanceId.replace('.', '-')}`}
	tabindex="-1"
	class="kibble-reference kc-reference-marketing-block"
	data-aisles-zone-instance={zoneArtifact.instanceId}
	data-aisles-zone-label="Marketing block"
	data-aisles-authority={zoneArtifact.decisionMode}
	data-aisles-model-calls={zoneArtifact.modelCallCount}
	data-kibble-zone-status={zoneArtifact.sharedStatus}
	data-kibble-zone-content-kind={zoneArtifact.sharedContentKind}
	data-kibble-zone-adapter={zoneArtifact.adapterId}
	data-kibble-zone-variant={zoneArtifact.selection.copyVariantId}
	data-kibble-zone-input-sha256={zoneArtifact.inputSha256}
>
	<div class="kc-reference-container kc-reference-marketing-block__inner">
		<p class="kc-reference-eyebrow">{zoneArtifact.content.props.eyebrow}</p>
		<h2>{zoneArtifact.content.props.headline}</h2>
		<p>{zoneArtifact.content.props.body}</p>
	</div>
</aside>

<style>
	.kc-reference-marketing-block { border-block:1px solid var(--kc-border); background:var(--kc-muted-surface); }
	.kc-reference-marketing-block__inner { padding-block:clamp(2rem, 5vw, 3.5rem); }
	.kc-reference-marketing-block h2 { max-width:18ch; margin:.35rem 0 0; font-family:var(--kc-font-display); font-size:clamp(1.7rem, 4vw, 2.7rem); line-height:1.03; }
	.kc-reference-marketing-block p:last-child { max-width:58ch; margin:.8rem 0 0; color:var(--kc-muted-text); line-height:1.65; }
</style>
