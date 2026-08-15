<script lang="ts">
	import './kibble-reference.css';
	import {
		KIBBLE_MERCHANT_SCALE_COVERAGE,
		KIBBLE_MERCHANT_SCALE_OWNERSHIP,
		KIBBLE_MERCHANT_SCALE_SCENARIOS,
		KIBBLE_CURRENT_CATALOG_LEDGER,
		KIBBLE_RESEARCH_CANDIDATE_LEDGER,
		type KibbleMerchantDemoEvidenceClass,
		type KibbleMerchantOperatingModelId,
	} from '$lib/brand/reference/kibble-merchant-scale-demo';

	let activeId = $state<KibbleMerchantOperatingModelId>('owner-led');
	let activeScenario = $derived(
		KIBBLE_MERCHANT_SCALE_SCENARIOS.find(({ id }) => id === activeId) ?? KIBBLE_MERCHANT_SCALE_SCENARIOS[0],
	);

	function evidenceLabel(value: KibbleMerchantDemoEvidenceClass): string {
		return {
			'source-backed-current': 'Current source',
			'source-backed-research': 'Research only',
			'shopper-provided-scenario': 'Shopper-provided',
			'synthetic-operating-data': 'Mock input',
		}[value];
	}
</script>

<svelte:head>
	<title>Merchant scale demonstration — Kibble × Aisles</title>
	<meta
		name="description"
		content="A rendered proof of how Aisles changes for owner-led, regional, and enterprise pet merchants without crossing merchant or provider authority."
	/>
</svelte:head>

<a class="merchant-scale__skip" href="#merchant-scale-main">Skip to merchant comparison</a>

<div class="kibble-reference merchant-scale">
	<header class="merchant-scale__header">
		<div class="merchant-scale__masthead">
			<a class="merchant-scale__brand" href="/" aria-label="Kibble and Company home">
				Kibble <span>&amp; Co.</span>
			</a>
			<div class="merchant-scale__status" aria-label="Demonstration status">
				<span class="merchant-scale__status-dot"></span>
				Read-only proof · no commerce writes
			</div>
		</div>

		<div class="merchant-scale__hero">
			<p class="merchant-scale__eyebrow">Kibble × Aisles · Merchant operating models</p>
			<h1>Personalization changes when the merchant changes.</h1>
			<p class="merchant-scale__lede">
				A small merchant needs help making a catalog decision. A medium merchant needs one catalog to respect location. An enterprise merchant needs every decision to preserve channel and provider authority.
			</p>
			<div class="merchant-scale__hero-proof" aria-label="Current catalog evidence">
				<div><strong>{KIBBLE_MERCHANT_SCALE_COVERAGE.currentCatalogRows}</strong><span>current dog catalog rows</span></div>
				<div><strong>{KIBBLE_MERCHANT_SCALE_COVERAGE.researchCandidateRows}</strong><span>multi-pet rows held for review</span></div>
				<div><strong>{KIBBLE_MERCHANT_SCALE_COVERAGE.operatingModels}</strong><span>different merchant outcomes</span></div>
			</div>
		</div>
	</header>

	<main id="merchant-scale-main" class="merchant-scale__main">
		<nav class="merchant-scale__tiers" aria-label="Choose a merchant operating model">
			{#each KIBBLE_MERCHANT_SCALE_SCENARIOS as scenario, index}
				<button
					type="button"
					class:merchant-scale__tier--active={activeId === scenario.id}
					class="merchant-scale__tier"
					aria-pressed={activeId === scenario.id}
					onclick={() => activeId = scenario.id}
				>
					<span class="merchant-scale__tier-index">0{index + 1}</span>
					<span><strong>{scenario.sizeLabel}</strong><small>{scenario.operatingModel}</small></span>
					<span class="merchant-scale__tier-maturity">{scenario.maturity}</span>
				</button>
			{/each}
		</nav>

		<section class="merchant-scale__outcome" aria-live="polite" aria-atomic="true">
			<div>
				<p class="merchant-scale__eyebrow">What Aisles means here</p>
				<h2>{activeScenario.headline}</h2>
				<p>{activeScenario.merchantJob}</p>
			</div>
			<div class="merchant-scale__result">
				<span>Visible outcome</span>
				<p>{activeScenario.result}</p>
			</div>
		</section>

		<section class="merchant-scale__story" aria-labelledby="shopper-story-heading">
			<div>
				<p class="merchant-scale__eyebrow">One shopper story</p>
				<h2 id="shopper-story-heading">{activeScenario.shopperStory}</h2>
			</div>
			<p class="merchant-scale__evidence-note">{activeScenario.evidenceNote}</p>
		</section>

		<section class="merchant-scale__inputs" aria-labelledby="inputs-heading">
			<div class="merchant-scale__section-heading">
				<p class="merchant-scale__eyebrow">Before Aisles acts</p>
				<h2 id="inputs-heading">The inputs already have owners.</h2>
			</div>
			<div class="merchant-scale__input-grid">
				{#each activeScenario.inputs as input}
					<article>
						<div class="merchant-scale__input-meta">
							<span>{input.owner.replace('-', ' ')}</span>
							<small class:merchant-scale__evidence--mock={input.evidenceClass === 'synthetic-operating-data'}>
								{evidenceLabel(input.evidenceClass)}
							</small>
						</div>
						<h3>{input.label}</h3>
						<p>{input.value}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="merchant-scale__decision" aria-labelledby="decision-heading">
			<div class="merchant-scale__section-heading merchant-scale__section-heading--split">
				<div>
					<p class="merchant-scale__eyebrow">Changed, kept, withheld</p>
					<h2 id="decision-heading">Every result carries its reason.</h2>
				</div>
				<p>Aisles may rank or withhold supplied candidates. It cannot create approval, inventory, price, plan, or transaction authority.</p>
			</div>

			<div class="merchant-scale__decision-list">
				{#each activeScenario.decisions as decision}
					<article class="merchant-scale__decision-row" data-disposition={decision.disposition}>
						<div class="merchant-scale__decision-product">
							<span class="merchant-scale__disposition">{decision.disposition}</span>
							<h3>{decision.label}</h3>
							<small>{decision.scope}</small>
						</div>
						<div class="merchant-scale__state">
							<span>Before</span>
							<p>{decision.before}</p>
						</div>
						<div class="merchant-scale__state merchant-scale__state--after">
							<span>After</span>
							<p>{decision.after}</p>
						</div>
						<p class="merchant-scale__reason">{decision.reason}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="merchant-scale__proof-grid" aria-label="Proof and integration boundary">
			<article class="merchant-scale__proof-card merchant-scale__proof-card--now">
				<p class="merchant-scale__eyebrow">Proven in this build</p>
				<h2>What a prospect can inspect now</h2>
				<ul>
					{#each activeScenario.proofNow as item}<li>{item}</li>{/each}
				</ul>
			</article>
			<article class="merchant-scale__proof-card merchant-scale__proof-card--missing">
				<p class="merchant-scale__eyebrow">Not represented as live</p>
				<h2>What this merchant would still need</h2>
				<ul>
					{#each activeScenario.missingIntegration as item}<li>{item}</li>{/each}
				</ul>
			</article>
		</section>

		<section class="merchant-scale__ownership" aria-labelledby="ownership-heading">
			<div class="merchant-scale__section-heading">
				<p class="merchant-scale__eyebrow">Decision boundary</p>
				<h2 id="ownership-heading">Personalization does not transfer ownership.</h2>
			</div>
			<div class="merchant-scale__ownership-grid">
				{#each KIBBLE_MERCHANT_SCALE_OWNERSHIP as boundary}
					<article>
						<h3>{boundary.label}</h3>
						<p><strong>Owns</strong> {boundary.owns}</p>
						<p><strong>Does not own</strong> {boundary.doesNotOwn}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="merchant-scale__ledger" aria-labelledby="ledger-heading">
			<div class="merchant-scale__section-heading merchant-scale__section-heading--split">
				<div>
					<p class="merchant-scale__eyebrow">Exact catalog boundary</p>
					<h2 id="ledger-heading">Current catalog and research rows never blur.</h2>
				</div>
				<p>These ledgers are the evidence behind the small-merchant result. Research rows are not products a shopper can buy.</p>
			</div>

			<details>
				<summary><span>Current catalog evidence</span><strong>{KIBBLE_CURRENT_CATALOG_LEDGER.length} exact dog-product rows</strong></summary>
				<div class="merchant-scale__table-wrap">
					<table>
						<thead><tr><th>ID</th><th>SKU</th><th>Product</th><th>Role</th><th>Status</th></tr></thead>
						<tbody>
							{#each KIBBLE_CURRENT_CATALOG_LEDGER as product}
								<tr><td>{product.key}</td><td>{product.sku}</td><td>{product.name}</td><td>{product.role}</td><td>Current catalog evidence</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>

			<details>
				<summary><span>Multi-pet research</span><strong>{KIBBLE_RESEARCH_CANDIDATE_LEDGER.length} exact rows · not approved</strong></summary>
				<p class="merchant-scale__mock-label">Research evidence only. Prices and availability may drift. Merchant review and commerce data are still required.</p>
				<div class="merchant-scale__table-wrap">
					<table>
						<thead><tr><th>SKU</th><th>Product</th><th>Species</th><th>Role</th><th>Status</th><th>Source</th></tr></thead>
						<tbody>
							{#each KIBBLE_RESEARCH_CANDIDATE_LEDGER as product}
								<tr>
									<td>{product.sku}</td><td>{product.name}</td><td>{product.species.join(' + ')}</td><td>{product.role}</td><td>Not approved</td>
									<td>{#if product.sourceUrl}<a href={product.sourceUrl} target="_blank" rel="noreferrer">{product.sourceLabel}</a>{:else}{product.sourceLabel}{/if}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	</main>

	<footer class="merchant-scale__footer">
		<p>Read-only demonstration. No product, price, inventory, plan, account, cart, order, or subscription was created.</p>
		<a href="/">Return to Kibble &amp; Co.</a>
	</footer>
</div>

<style>
	:global(body) { margin: 0; background: #eef2f8; }
	.merchant-scale { --ms-ink: #15183d; --ms-blue: #3b5bd0; --ms-teal: #12846f; --ms-orange: #d85f39; --ms-amber: #9b6819; min-height: 100vh; background: #eef2f8; color: var(--ms-ink); }
	.merchant-scale :is(h1, h2, h3) { font-family: var(--kc-font-display); }
	.merchant-scale__skip { position: fixed; z-index: 100; top: 0.75rem; left: 0.75rem; transform: translateY(-180%); border-radius: 0.4rem; background: #15183d; color: white; padding: 0.75rem 1rem; font-weight: 700; }
	.merchant-scale__skip:focus { transform: translateY(0); }
	.merchant-scale__header { color: white; background: radial-gradient(circle at 88% 12%, rgba(55,191,162,.28), transparent 28rem), linear-gradient(145deg, #171a42 0%, #232b68 100%); }
	.merchant-scale__masthead, .merchant-scale__hero, .merchant-scale__main, .merchant-scale__footer { width: min(1180px, calc(100% - 2rem)); margin-inline: auto; }
	.merchant-scale__masthead { min-height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid rgba(255,255,255,.15); }
	.merchant-scale__brand { color: white; font: 800 1.2rem/1 var(--kc-font-display); letter-spacing: -.045em; text-decoration: none; }
	.merchant-scale__brand span { color: #55d3ba; }
	.merchant-scale__status { display: flex; align-items: center; gap: .55rem; font: 600 .68rem/1.4 var(--kc-font-machinery); letter-spacing: .04em; text-transform: uppercase; }
	.merchant-scale__status-dot { width: .5rem; height: .5rem; border-radius: 50%; background: #55d3ba; box-shadow: 0 0 0 4px rgba(85,211,186,.13); }
	.merchant-scale__hero { padding-block: clamp(3.5rem, 8vw, 7rem) 4rem; }
	.merchant-scale__eyebrow { margin: 0 0 .75rem; color: inherit; opacity: .68; font: 700 .68rem/1.4 var(--kc-font-machinery); letter-spacing: .08em; text-transform: uppercase; }
	.merchant-scale__hero h1 { max-width: 820px; margin: 0; font: 800 clamp(2.6rem, 6.7vw, 5.8rem)/.94 var(--kc-font-display); letter-spacing: -.06em; text-wrap: balance; }
	.merchant-scale__lede { max-width: 760px; margin: 1.75rem 0 0; color: #dfe6ff; font-size: clamp(1rem, 2vw, 1.3rem); line-height: 1.6; }
	.merchant-scale__hero-proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 760px; margin-top: 3rem; border: 1px solid rgba(255,255,255,.18); border-radius: 1rem; background: rgba(10,14,49,.28); box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 18px 44px rgba(0,0,0,.13); backdrop-filter: blur(12px); }
	.merchant-scale__hero-proof div { padding: 1.2rem 1.3rem; }
	.merchant-scale__hero-proof div + div { border-left: 1px solid rgba(255,255,255,.16); }
	.merchant-scale__hero-proof strong, .merchant-scale__hero-proof span { display: block; }
	.merchant-scale__hero-proof strong { font: 800 2rem/1 var(--kc-font-machinery); }
	.merchant-scale__hero-proof span { margin-top: .45rem; color: #cbd5ff; font-size: .76rem; line-height: 1.35; }
	.merchant-scale__main { padding-block: 2rem 6rem; }
	.merchant-scale__tiers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin: -4rem 0 2rem; position: relative; }
	.merchant-scale__tier { min-height: 92px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .9rem; padding: 1rem; border: 1px solid #cbd5ea; border-radius: .85rem; background: #fff; color: var(--ms-ink); text-align: left; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 5px 12px rgba(23,26,66,.06); transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
	.merchant-scale__tier:hover { transform: translateY(-2px); border-color: #97a9d7; }
	.merchant-scale__tier:focus-visible { outline: 3px solid var(--ms-blue); outline-offset: 3px; }
	.merchant-scale__tier--active { border-color: var(--ms-blue); box-shadow: inset 0 3px 0 var(--ms-blue), 0 12px 30px rgba(59,91,208,.14); }
	.merchant-scale__tier-index { color: #8590ad; font: 700 .68rem/1 var(--kc-font-machinery); }
	.merchant-scale__tier strong, .merchant-scale__tier small { display: block; }
	.merchant-scale__tier strong { font-size: .98rem; }
	.merchant-scale__tier small { margin-top: .3rem; color: #65708f; font-size: .72rem; }
	.merchant-scale__tier-maturity { border-radius: 999px; background: #edf1fb; color: #465273; padding: .35rem .55rem; font: 700 .6rem/1 var(--kc-font-machinery); text-transform: uppercase; }
	.merchant-scale__outcome { display: grid; grid-template-columns: 1.1fr .9fr; gap: 2rem; padding: clamp(1.5rem, 4vw, 3rem); border: 1px solid #d4dced; border-radius: 1.1rem; background: #fff; box-shadow: inset 0 1px 0 white, 0 8px 24px rgba(23,26,66,.06); }
	.merchant-scale__outcome h2, .merchant-scale__story h2, .merchant-scale__section-heading h2, .merchant-scale__proof-card h2 { margin: 0; font: 800 clamp(1.5rem, 3vw, 2.35rem)/1.08 var(--kc-font-display); letter-spacing: -.04em; }
	.merchant-scale__outcome > div > p:last-child { max-width: 56ch; color: #596581; line-height: 1.6; }
	.merchant-scale__result { align-self: stretch; border-left: 4px solid var(--ms-teal); border-radius: .2rem .75rem .75rem .2rem; background: #e5f5f0; padding: 1.25rem 1.4rem; }
	.merchant-scale__result span { color: #35665c; font: 700 .65rem/1 var(--kc-font-machinery); letter-spacing: .06em; text-transform: uppercase; }
	.merchant-scale__result p { margin: .75rem 0 0; color: #173d35; font-weight: 650; line-height: 1.55; }
	.merchant-scale__story { display: grid; grid-template-columns: 1.2fr .8fr; gap: 2rem; align-items: end; padding: 3.5rem 0 2rem; }
	.merchant-scale__story h2 { max-width: 780px; font-size: clamp(1.5rem, 3.3vw, 2.8rem); }
	.merchant-scale__evidence-note { margin: 0; border-left: 3px solid var(--ms-amber); padding-left: 1rem; color: #63543b; font-size: .82rem; line-height: 1.55; }
	.merchant-scale__inputs, .merchant-scale__decision, .merchant-scale__ownership, .merchant-scale__ledger { padding-block: 2.5rem; }
	.merchant-scale__section-heading { margin-bottom: 1.5rem; }
	.merchant-scale__section-heading--split { display: grid; grid-template-columns: 1fr minmax(260px, .72fr); gap: 2rem; align-items: end; }
	.merchant-scale__section-heading--split > p { margin: 0; color: #596581; line-height: 1.55; }
	.merchant-scale__input-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
	.merchant-scale__input-grid article { min-height: 180px; border: 1px solid #d4dced; border-radius: .75rem; background: #fff; padding: 1.1rem; }
	.merchant-scale__input-meta { display: flex; justify-content: space-between; gap: .5rem; color: #52607e; font: 700 .6rem/1.3 var(--kc-font-machinery); text-transform: uppercase; }
	.merchant-scale__input-meta small { border-radius: 999px; background: #e7f5f1; color: #286b5e; padding: .3rem .45rem; }
	.merchant-scale__input-meta .merchant-scale__evidence--mock { background: #fff1d8; color: #805515; }
	.merchant-scale__input-grid h3 { margin: 1.4rem 0 .5rem; font-size: .95rem; }
	.merchant-scale__input-grid p { margin: 0; color: #5d6780; font-size: .8rem; line-height: 1.55; }
	.merchant-scale__decision-list { overflow: hidden; border: 1px solid #ccd6e9; border-radius: 1rem; background: #fff; }
	.merchant-scale__decision-row { display: grid; grid-template-columns: 1.1fr .65fr .8fr 1.25fr; gap: 1rem; align-items: center; padding: 1rem 1.15rem; border-left: 5px solid #7683a3; }
	.merchant-scale__decision-row + .merchant-scale__decision-row { border-top: 1px solid #e3e8f2; }
	.merchant-scale__decision-row[data-disposition='kept'] { border-left-color: var(--ms-teal); }
	.merchant-scale__decision-row[data-disposition='changed'] { border-left-color: var(--ms-blue); }
	.merchant-scale__decision-row[data-disposition='withheld'] { border-left-color: var(--ms-orange); }
	.merchant-scale__decision-product h3 { margin: .4rem 0 .25rem; font-size: .86rem; line-height: 1.35; }
	.merchant-scale__decision-product small { color: #69748f; font: 600 .62rem/1.3 var(--kc-font-machinery); }
	.merchant-scale__disposition { display: inline-block; border-radius: 999px; background: #edf1f8; color: #4c5877; padding: .28rem .42rem; font: 800 .58rem/1 var(--kc-font-machinery); letter-spacing: .05em; text-transform: uppercase; }
	.merchant-scale__state span { color: #7b859f; font: 700 .58rem/1 var(--kc-font-machinery); letter-spacing: .05em; text-transform: uppercase; }
	.merchant-scale__state p { margin: .35rem 0 0; font-size: .76rem; font-weight: 650; line-height: 1.4; }
	.merchant-scale__state--after p { color: #273887; }
	.merchant-scale__reason { margin: 0; color: #5b6680; font-size: .75rem; line-height: 1.5; }
	.merchant-scale__proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding-block: 2.5rem; }
	.merchant-scale__proof-card { border-radius: 1rem; padding: clamp(1.5rem, 3vw, 2.5rem); }
	.merchant-scale__proof-card--now { border: 1px solid #b8dfd4; background: #e3f3ee; color: #173d35; }
	.merchant-scale__proof-card--missing { border: 1px solid #e8d4ab; background: #fff4de; color: #553c16; }
	.merchant-scale__proof-card h2 { font-size: 1.45rem; }
	.merchant-scale__proof-card ul { display: grid; gap: .7rem; margin: 1.35rem 0 0; padding-left: 1.1rem; }
	.merchant-scale__proof-card li { padding-left: .3rem; font-size: .86rem; line-height: 1.5; }
	.merchant-scale__ownership-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .6rem; }
	.merchant-scale__ownership-grid article { border-top: 4px solid var(--ms-ink); background: #fff; padding: 1rem; }
	.merchant-scale__ownership-grid h3 { margin: 0 0 1.2rem; font-size: .87rem; }
	.merchant-scale__ownership-grid p { margin: .65rem 0 0; color: #626c85; font-size: .72rem; line-height: 1.48; }
	.merchant-scale__ownership-grid strong { color: var(--ms-ink); }
	.merchant-scale__ledger details { border: 1px solid #ccd6e9; border-radius: .75rem; background: #fff; }
	.merchant-scale__ledger details + details { margin-top: .75rem; }
	.merchant-scale__ledger summary { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .8rem 1rem; cursor: pointer; }
	.merchant-scale__ledger summary:focus-visible { outline: 3px solid var(--ms-blue); outline-offset: 2px; }
	.merchant-scale__ledger summary span { font-weight: 750; }
	.merchant-scale__ledger summary strong { color: #5f6982; font: 650 .68rem/1.4 var(--kc-font-machinery); }
	.merchant-scale__table-wrap { overflow-x: auto; border-top: 1px solid #e0e6f0; }
	.merchant-scale__ledger table { width: 100%; border-collapse: collapse; min-width: 760px; font-size: .72rem; }
	.merchant-scale__ledger th, .merchant-scale__ledger td { padding: .7rem .8rem; border-bottom: 1px solid #edf0f5; text-align: left; vertical-align: top; }
	.merchant-scale__ledger th { background: #f4f6fa; color: #66718a; font: 700 .6rem/1.3 var(--kc-font-machinery); letter-spacing: .04em; text-transform: uppercase; }
	.merchant-scale__ledger td:first-child, .merchant-scale__ledger td:nth-child(2) { font-family: var(--kc-font-machinery); }
	.merchant-scale__ledger a { color: var(--ms-blue); font-weight: 700; }
	.merchant-scale__mock-label { margin: 0; border-top: 1px solid #ecd8ae; background: #fff4de; color: #67491c; padding: .8rem 1rem; font-size: .75rem; }
	.merchant-scale__footer { display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid #cbd5e7; padding-block: 1.5rem 2.5rem; color: #5d6780; font-size: .75rem; }
	.merchant-scale__footer p { margin: 0; }
	.merchant-scale__footer a { color: var(--ms-blue); font-weight: 700; }
	@media (max-width: 920px) {
		.merchant-scale__input-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.merchant-scale__decision-row { grid-template-columns: 1fr 1fr; }
		.merchant-scale__reason { grid-column: 1 / -1; }
		.merchant-scale__ownership-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 700px) {
		.merchant-scale__masthead { align-items: flex-start; padding-block: 1rem; }
		.merchant-scale__status { max-width: 170px; text-align: right; }
		.merchant-scale__hero { padding-top: 3.5rem; }
		.merchant-scale__hero-proof, .merchant-scale__tiers, .merchant-scale__outcome, .merchant-scale__story, .merchant-scale__section-heading--split, .merchant-scale__proof-grid { grid-template-columns: 1fr; }
		.merchant-scale__hero-proof div + div { border-left: 0; border-top: 1px solid rgba(255,255,255,.16); }
		.merchant-scale__tiers { margin-top: -2.5rem; }
		.merchant-scale__tier { min-height: 76px; }
		.merchant-scale__outcome, .merchant-scale__story { gap: 1.2rem; }
		.merchant-scale__input-grid, .merchant-scale__ownership-grid { grid-template-columns: 1fr; }
		.merchant-scale__decision-row { grid-template-columns: 1fr; }
		.merchant-scale__reason { grid-column: auto; }
		.merchant-scale__footer { flex-direction: column; }
	}
	@media (prefers-reduced-motion: reduce) {
		.merchant-scale__tier { transition: none; }
	}
</style>
