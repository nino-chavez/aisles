<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleAccountReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Account — Kibble &amp; Co.</title></svelte:head>

<div data-reference-recipe={data.kibbleAccount.recipeId}>
	<KibbleAccountReference {...data.kibbleAccount} />
</div>
