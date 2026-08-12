<script lang="ts">
	import './kibble-reference.css';

	let { status, message, eyebrow, headline, returnLabel }: { status: number; message: string; eyebrow: string; headline: string; returnLabel: string } = $props();
</script>

<section class="kibble-reference kc-reference-error" aria-labelledby="kibble-error-heading">
	<div class="kc-reference-container kc-reference-error__inner">
		<p class="kc-reference-eyebrow">{eyebrow} · {status}</p>
		<h1 id="kibble-error-heading">{headline}</h1>
		<p>{message}</p>
		<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">{returnLabel}</a>
	</div>
</section>
