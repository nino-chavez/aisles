<script lang="ts">
	let { href }: { href: string } = $props();
</script>

<aside class="kc-dev-launcher" aria-label="Development decision inspector">
	<span>Local development</span>
	<a {href}>Show decision inspector</a>
</aside>

<style>
	.kc-dev-launcher { position:fixed; right:1rem; bottom:1rem; z-index:40; display:flex; align-items:center; gap:.65rem; border:1px solid #aebee1; background:#e8eefb; color:#17213b; padding:.55rem .65rem; box-shadow:0 8px 24px rgb(23 33 59 / .18); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.72rem; }
	.kc-dev-launcher span { color:#56617a; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
	.kc-dev-launcher a { display:inline-flex; min-height:44px; align-items:center; border:1px solid #315cc9; background:#fff; color:#1c4cab; padding:.45rem .65rem; font-weight:800; text-decoration:none; }
	.kc-dev-launcher a:hover { background:#f4f7fc; }
	.kc-dev-launcher a:focus-visible { outline:3px solid #315cc9; outline-offset:3px; }
	@media (max-width: 560px) { .kc-dev-launcher { left:.75rem; right:.75rem; justify-content:space-between; } }
</style>
