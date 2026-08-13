<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleCheckoutReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Checkout — Kibble &amp; Co.</title><meta name="robots" content="noindex" /></svelte:head>

<div data-reference-recipe={data.kibbleCheckout.recipeId}>
	<KibbleCheckoutReference {...data.kibbleCheckout} />
</div>
