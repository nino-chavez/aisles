<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleZoneAdapterBinding } from './types';

	let { status, message, eyebrow, headline, returnLabel, zoneAdapter }: { status: number; message: string; eyebrow: string; headline: string; returnLabel: string; zoneAdapter?: KibbleZoneAdapterBinding<{ component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } }> } = $props();
</script>

<section class="kibble-reference kc-reference-error" aria-labelledby="kibble-error-heading" data-kibble-zone-instance={zoneAdapter?.instanceId} data-kibble-zone-status={zoneAdapter?.sharedStatus} data-kibble-zone-content-kind={zoneAdapter?.sharedContentKind} data-kibble-zone-adapter={zoneAdapter?.adapterId} data-kibble-zone-variant={zoneAdapter?.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter?.inputSha256}>
	<div class="kc-reference-container kc-reference-error__inner">
		<p class="kc-reference-eyebrow">{zoneAdapter?.content.props.eyebrow ?? `${eyebrow} · ${status}`}</p>
		<h1 id="kibble-error-heading">{zoneAdapter?.content.props.headline ?? headline}</h1>
		<p>{zoneAdapter?.content.props.body ?? message}</p>
		<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">{returnLabel}</a>
	</div>
</section>
