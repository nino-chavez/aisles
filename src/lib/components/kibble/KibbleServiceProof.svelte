<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleServiceProofItem, KibbleZoneAdapterBinding } from './types';

	type ServiceContent = { component: 'service-callouts-grid'; props: { columns: 3; callouts: Array<{ icon: string; label: string; body?: string }> } };
	let { items, zoneAdapter }: { items: KibbleServiceProofItem[]; zoneAdapter?: KibbleZoneAdapterBinding<ServiceContent> } = $props();
	const renderedItems = $derived(zoneAdapter?.content.props.callouts ?? items.map(({ title, body }) => ({ label: title, body })));
</script>

{#if items.length > 0}
	<section class="kibble-reference kc-reference-section" aria-label="Service commitments" data-kibble-zone-instance={zoneAdapter?.instanceId} data-kibble-zone-status={zoneAdapter?.sharedStatus} data-kibble-zone-content-kind={zoneAdapter?.sharedContentKind} data-kibble-zone-adapter={zoneAdapter?.adapterId} data-kibble-zone-variant={zoneAdapter?.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter?.inputSha256} data-aisles-zone-instance={zoneAdapter?.instanceId} data-aisles-zone-label={zoneAdapter?.instanceId} data-aisles-authority={zoneAdapter?.decisionMode ?? 'fixed'} data-aisles-model-calls={zoneAdapter?.modelCallCount ?? 0}>
		<div class="kc-reference-container kc-reference-service-grid">
			{#each renderedItems as item (item.label)}
				<div>
					<h3>{item.label}</h3>
					<p>{item.body}</p>
				</div>
			{/each}
		</div>
	</section>
{/if}
