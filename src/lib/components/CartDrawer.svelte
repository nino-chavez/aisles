<script lang="ts">
	let {
		open = false,
		onclose,
	}: {
		open: boolean;
		onclose: () => void;
	} = $props();

	interface CartItem {
		entityId: string;
		productEntityId: number;
		name: string;
		quantity: number;
		salePrice: { value: number };
		listPrice: { value: number };
		imageUrl: string;
	}

	interface UipDiscount {
		title: string;
		target: 'cart' | 'additional_cost' | 'item' | 'bundle';
		amount: number;
		code?: string;
	}
	interface UipCode {
		type: 'coupon' | 'referral' | 'giftcard';
		code: string;
	}

	let items = $state<CartItem[]>([]);
	let isLoading = $state(false);
	let appliedCodes = $state<string[]>([]);
	let discounts = $state<UipDiscount[]>([]);
	let codes = $state<UipCode[]>([]);
	let codeInput = $state('');
	let codeError = $state('');
	let applying = $state(false);

	const subtotal = $derived(items.reduce((sum, item) => sum + item.salePrice.value * item.quantity, 0));
	const itemCount = $derived(items.reduce((sum, item) => sum + item.quantity, 0));
	// Only cart/item/bundle discounts reduce the subtotal. additional_cost (shipping)
	// is informational until BC computes actual shipping.
	const discountTotalMinor = $derived(
		discounts
			.filter((d) => d.target === 'cart' || d.target === 'item' || d.target === 'bundle')
			.reduce((sum, d) => sum + d.amount, 0),
	);
	const total = $derived(Math.max(0, subtotal * 100 - discountTotalMinor) / 100);
	const hasFreeShipping = $derived(discounts.some((d) => d.target === 'additional_cost'));

	$effect(() => {
		if (open) {
			loadCart();
		}
	});

	async function loadCart() {
		isLoading = true;
		try {
			const res = await fetch('/api/cart');
			const data = await res.json();
			items = data.cart?.lineItems?.physicalItems || [];
			appliedCodes = data.appliedCodes || [];
			discounts = data.promotions?.discounts || [];
			codes = data.promotions?.codes || [];
		} catch {
			items = [];
			appliedCodes = [];
			discounts = [];
			codes = [];
		} finally {
			isLoading = false;
		}
	}

	async function applyCode(e?: Event) {
		e?.preventDefault();
		const code = codeInput.trim();
		if (!code || applying) return;
		applying = true;
		codeError = '';
		try {
			const res = await fetch('/api/cart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'apply', code }),
			});
			const data = await res.json();
			if (!res.ok) {
				codeError = data.message || data.error || 'Could not apply code';
				return;
			}
			items = data.cart?.lineItems?.physicalItems || items;
			appliedCodes = data.appliedCodes || [];
			discounts = data.promotions?.discounts || [];
			codes = data.promotions?.codes || [];
			const applied = discounts.some((d) => d.code === code);
			if (!applied) {
				codeError = `Code "${code}" was recorded but produced no discount`;
			}
			codeInput = '';
		} catch (err) {
			codeError = err instanceof Error ? err.message : 'Failed to apply code';
		} finally {
			applying = false;
		}
	}

	async function removeCode(code: string) {
		try {
			const res = await fetch('/api/cart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'remove', code }),
			});
			const data = await res.json();
			if (!res.ok) return;
			appliedCodes = data.appliedCodes || [];
			discounts = data.promotions?.discounts || [];
			codes = data.promotions?.codes || [];
		} catch {
			// no-op
		}
	}
</script>

<!-- Backdrop -->
{#if open}
	<div class="fixed inset-0 z-50 flex justify-end">
		<!-- Overlay -->
		<button
			class="absolute inset-0 bg-neutral-950/30 backdrop-blur-[2px]"
			onclick={onclose}
			aria-label="Close cart"
		></button>

		<!-- Drawer -->
		<div class="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-surface-border px-6 py-4">
				<h2 class="font-display text-lg">Cart ({itemCount})</h2>
				<button onclick={onclose} class="text-surface-muted-fg hover:text-surface-fg" aria-label="Close">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>

			<!-- Items -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if isLoading}
					<div class="animate-pulse space-y-4">
						{#each Array(2) as _}
							<div class="flex gap-4">
								<div class="h-20 w-20 rounded-sm bg-surface-muted"></div>
								<div class="flex-1 space-y-2">
									<div class="h-4 w-32 rounded bg-surface-muted"></div>
									<div class="h-3 w-16 rounded bg-surface-muted"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if items.length === 0}
					<div class="flex h-48 flex-col items-center justify-center text-center">
						<p class="text-surface-muted-fg">Your cart is empty</p>
						<button onclick={onclose} class="mt-4 text-sm font-medium text-primary hover:text-secondary">
							Continue shopping
						</button>
					</div>
				{:else}
					<ul class="divide-y divide-surface-border">
						{#each items as item}
							<li class="flex gap-4 py-4">
								{#if item.imageUrl}
									<img src={item.imageUrl} alt={item.name} class="h-20 w-20 rounded-sm object-cover" />
								{:else}
									<div class="h-20 w-20 rounded-sm bg-surface-muted"></div>
								{/if}
								<div class="flex flex-1 flex-col">
									<h3 class="text-sm font-medium">{item.name}</h3>
									<p class="mt-1 text-xs text-surface-muted-fg">Qty: {item.quantity}</p>
									<div class="mt-auto">
										{#if item.salePrice.value !== item.listPrice.value}
											<span class="text-sm font-medium text-primary">${item.salePrice.value.toLocaleString()}</span>
											<span class="ml-1 text-xs text-surface-muted-fg line-through">${item.listPrice.value.toLocaleString()}</span>
										{:else}
											<span class="text-sm font-medium">${item.salePrice.value.toLocaleString()}</span>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- Footer -->
			{#if items.length > 0}
				<div class="border-t border-surface-border px-6 py-4">
					<!-- Promo code entry -->
					<form class="mb-3" onsubmit={applyCode}>
						<label class="mb-1 block text-xs text-surface-muted-fg" for="cart-promo-code">Promo code</label>
						<div class="flex gap-2">
							<input
								id="cart-promo-code"
								type="text"
								bind:value={codeInput}
								placeholder="e.g. BLCKFRDY"
								autocomplete="off"
								class="flex-1 rounded-sm border border-surface-border bg-surface-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
							/>
							<button
								type="submit"
								disabled={applying || !codeInput.trim()}
								class="rounded-sm border border-surface-fg px-3 py-2 text-sm font-medium text-surface-fg transition-opacity hover:opacity-80 disabled:opacity-40"
							>
								{applying ? 'Applying…' : 'Apply'}
							</button>
						</div>
						{#if codeError}
							<p class="mt-1 text-xs text-error">{codeError}</p>
						{/if}
					</form>

					<!-- Applied codes -->
					{#if codes.length > 0}
						<div class="mb-2 flex flex-wrap gap-1.5">
							{#each codes as c}
								<span class="inline-flex items-center gap-1 rounded-sm bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
									{c.code}
									<button
										onclick={() => removeCode(c.code)}
										class="ml-1 text-accent/60 hover:text-accent"
										aria-label="Remove code {c.code}"
									>×</button>
								</span>
							{/each}
						</div>
					{/if}

					<!-- Subtotal / discount / total -->
					<div class="space-y-1 border-t border-surface-border pt-3">
						<div class="flex items-center justify-between text-sm">
							<span class="text-surface-muted-fg">Subtotal</span>
							<span class="tabular-nums">${subtotal.toLocaleString()}</span>
						</div>
						{#each discounts.filter((d) => d.target !== 'additional_cost') as d}
							<div class="flex items-center justify-between text-sm text-accent">
								<span class="truncate">{d.title}{#if d.code} · <span class="font-mono text-xs">{d.code}</span>{/if}</span>
								<span class="tabular-nums">−${(d.amount / 100).toFixed(2)}</span>
							</div>
						{/each}
						{#if hasFreeShipping}
							<div class="flex items-center justify-between text-sm text-accent">
								<span>Free shipping</span>
								<span class="tabular-nums">Free</span>
							</div>
						{/if}
						<div class="flex items-center justify-between pt-1 text-base font-medium">
							<span>Total</span>
							<span class="tabular-nums">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
						</div>
					</div>

					<p class="mt-2 text-xs text-surface-muted-fg">Shipping and taxes calculated at checkout</p>
					<a
						href="/checkout"
						class="mt-3 block w-full rounded-sm bg-surface-fg py-3 text-center text-sm font-semibold text-surface-bg transition-opacity hover:opacity-85"
					>
						Checkout
					</a>
					<button
						onclick={onclose}
						class="mt-2 block w-full py-2 text-center text-sm text-surface-muted-fg hover:text-surface-fg"
					>
						Continue shopping
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
