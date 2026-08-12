<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleProofItem } from './types';

	let { items }: { items: KibbleProofItem[] } = $props();
</script>

<dl class="kibble-reference kc-reference-proof-strip" aria-label="Store proof points">
	{#each items as item (item.label)}
		<div class="kc-reference-proof-strip__item">
			<dt>{item.label}</dt>
			<dd>{item.value}</dd>
		</div>
	{/each}
</dl>
