<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleNavItem } from './types';

	let {
		brandName,
		tagline,
		footerNote,
		groups,
	}: {
		brandName: string;
		tagline: string;
		footerNote: string;
		groups: Array<{ label: string; links: KibbleNavItem[] }>;
	} = $props();
</script>

<footer class="kibble-reference kc-reference-footer">
	<div class="kc-reference-container">
		<div class="kc-reference-footer__grid">
			<div>
				<a href="/" class="kc-reference-wordmark kc-reference-focus" aria-label={brandName}>
					{brandName.split('&')[0]}{#if brandName.includes('&')}<span class="kc-reference-wordmark__ampersand">&amp;</span>{brandName.split('&').slice(1).join('&')}{/if}
				</a>
				<p class="kc-reference-footer__tagline">{tagline}</p>
			</div>
			{#each groups as group (group.label)}
				<div>
					<h2>{group.label}</h2>
					<ul>
						{#each group.links as link (link.href)}
							<li><a href={link.href} class="kc-reference-focus">{link.label}</a></li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
		<p class="kc-reference-footer__note">{footerNote}</p>
	</div>
</footer>
