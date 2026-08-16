<script lang="ts">
	import './kibble-reference.css';
	import { page } from '$app/state';

	type MerchantTierId = 'small' | 'medium' | 'enterprise';

	let {
		activeTier,
		tiers,
	}: {
		activeTier: MerchantTierId | null;
		tiers: Array<{ id: MerchantTierId; provisioned: boolean }>;
	} = $props();

	const TIER_LABELS: Record<MerchantTierId, string> = {
		small: 'Small',
		medium: 'Medium',
		enterprise: 'Enterprise',
	};

	const redirectTo = $derived(`${page.url.pathname}${page.url.search}`);
	const activeTierInfo = $derived(tiers.find((tier) => tier.id === activeTier) ?? null);
</script>

<div class="kibble-reference kc-tier-toggle">
	<div class="kc-reference-chrome-container kc-tier-toggle__inner">
		<span class="kc-tier-toggle__label">Exploring as:</span>

		<form method="POST" action="/api/merchant-tier" class="kc-tier-toggle__group" role="group" aria-label="Merchant tier">
			<input type="hidden" name="redirectTo" value={redirectTo} />
			{#each tiers as tier (tier.id)}
				<button
					type="submit"
					name="tier"
					value={tier.id}
					class="kc-tier-toggle__option kc-reference-focus"
					class:kc-tier-toggle__option--active={activeTier === tier.id}
					aria-pressed={activeTier === tier.id}
					title={tier.provisioned ? undefined : `${TIER_LABELS[tier.id]} merchant — not yet provisioned`}
				>
					{TIER_LABELS[tier.id]}
					{#if !tier.provisioned}<span class="kc-tier-toggle__pending" aria-hidden="true"></span>{/if}
				</button>
			{/each}
		</form>

		<span class="kc-tier-toggle__suffix">merchant</span>

		{#if activeTierInfo && !activeTierInfo.provisioned}
			<span class="kc-tier-toggle__hint kc-tier-toggle__hint--pending">
				{TIER_LABELS[activeTierInfo.id]} merchant is not yet provisioned — showing the default catalog.
			</span>
		{:else}
			<span class="kc-tier-toggle__hint">Demo control — switches the live catalog behind this store.</span>
		{/if}
	</div>
</div>

<style>
	.kc-tier-toggle {
		background: var(--kc-panel);
		border-bottom: 1px solid var(--kc-border);
	}

	.kc-tier-toggle__inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.6rem;
		padding-block: 0.55rem;
	}

	.kc-tier-toggle__label {
		color: var(--kc-muted-text);
		font-family: var(--kc-font-machinery);
		font-size: 0.64rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.kc-tier-toggle__group {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius-md);
		background: var(--kc-surface);
	}

	.kc-tier-toggle__option {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: none;
		border-radius: var(--kc-radius-sm);
		background: transparent;
		color: var(--kc-muted-text);
		font-family: var(--kc-font-body);
		font-size: 0.76rem;
		font-weight: 600;
		line-height: 1;
		padding: 0.4rem 0.65rem;
		cursor: pointer;
		transition: background var(--kc-duration-fast) var(--kc-ease-out), color var(--kc-duration-fast) var(--kc-ease-out);
	}

	.kc-tier-toggle__option:hover {
		color: var(--kc-identity);
	}

	.kc-tier-toggle__option--active {
		background: var(--kc-identity);
		color: #fff;
	}

	.kc-tier-toggle__option--active:hover {
		color: #fff;
	}

	.kc-tier-toggle__pending {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--kc-savings);
		flex: none;
	}

	.kc-tier-toggle__suffix {
		color: var(--kc-muted-text);
		font-size: 0.76rem;
	}

	.kc-tier-toggle__hint {
		color: var(--kc-muted-text);
		font-size: 0.68rem;
		opacity: 0.85;
	}

	.kc-tier-toggle__hint--pending {
		color: var(--kc-savings);
		font-weight: 600;
		opacity: 1;
	}

	@media (max-width: 639px) {
		.kc-tier-toggle__hint {
			flex-basis: 100%;
		}
	}

	@media (min-width: 640px) {
		.kc-tier-toggle__inner {
			flex-wrap: nowrap;
		}

		.kc-tier-toggle__hint {
			margin-left: auto;
			text-align: right;
			white-space: nowrap;
		}
	}
</style>
