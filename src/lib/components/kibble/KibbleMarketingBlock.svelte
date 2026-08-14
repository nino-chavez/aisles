<script lang="ts">
	import './kibble-reference.css';

	let {
		block,
		zoneId,
		modelCallCount,
		modelEligible = true,
	}: {
		block: { eyebrow: string; headline: string; body: string };
		zoneId: 'plp.marketing-block' | 'pdp.marketing-block';
		modelCallCount: number;
		modelEligible?: boolean;
	} = $props();
</script>

<aside
	id={`kibble-${zoneId.replace('.', '-')}`}
	tabindex="-1"
	class="kibble-reference kc-reference-marketing-block"
	data-aisles-zone-instance={zoneId}
	data-aisles-zone-label="Marketing block"
	data-aisles-authority={modelCallCount > 0 ? 'model' : 'fixed'}
	data-aisles-model-calls={modelCallCount}
	data-aisles-model-eligible={modelEligible ? 'true' : undefined}
	data-kibble-zone-status="live"
	data-kibble-zone-variant="kibble.marketing-block.copy-led"
>
	<div class="kc-reference-container kc-reference-marketing-block__inner">
		<p class="kc-reference-eyebrow">{block.eyebrow}</p>
		<h2>{block.headline}</h2>
		<p>{block.body}</p>
	</div>
</aside>

<style>
	.kc-reference-marketing-block { border-block:1px solid var(--kc-border); background:var(--kc-muted-surface); }
	.kc-reference-marketing-block__inner { padding-block:clamp(2rem, 5vw, 3.5rem); }
	.kc-reference-marketing-block h2 { max-width:18ch; margin:.35rem 0 0; font-family:var(--kc-font-display); font-size:clamp(1.7rem, 4vw, 2.7rem); line-height:1.03; }
	.kc-reference-marketing-block p:last-child { max-width:58ch; margin:.8rem 0 0; color:var(--kc-muted-text); line-height:1.65; }
</style>
