<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleServiceProofItem } from './types';

	let { items }: { items: KibbleServiceProofItem[] } = $props();
</script>

{#if items.length > 0}
	<section class="kibble-reference kc-reference-section" aria-label="Service commitments">
		<div class="kc-reference-container kc-reference-service-grid">
			{#each items as item (item.title)}
				<div>
					<h3>{item.title}</h3>
					<p>{item.body}</p>
				</div>
			{/each}
		</div>
	</section>
{/if}
