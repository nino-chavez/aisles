<script lang="ts">
	import { onMount } from 'svelte';
	import './kibble-reference.css';
	import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';
	import type { CustomerOrderSummary, CustomerSessionStateView } from '$lib/commerce/customer-contract';

	type AccountSubtype = 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout' | 'unknown';

	let {
		subtype,
		brandName,
		availabilityMessage,
		policyVersion,
		pageHeadingLevel = 'h1',
		customerSessionState = 'disabled',
		services = { mode: 'off', cart: 'not_connected', checkout: 'not_connected', orderCreation: 'not_exposed', orderHistory: 'customer_session_required', account: 'merchant_decision_required', payment: 'provider_owned', subscription: 'provider_not_connected', subscriptionPortal: 'portal_session_required' },
	}: {
		subtype: AccountSubtype;
		brandName: string;
		availabilityMessage: string;
		policyVersion?: string;
		pageHeadingLevel?: 'h1' | 'h2';
		services?: CommerceServiceBoundary;
		customerSessionState?: CustomerSessionStateView;
	} = $props();
	let accountMessage = $state('');
	let accountBusy = $state(false);
	let orders = $state<CustomerOrderSummary[]>([]);
	let ordersState = $state<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');

	const sections = [
		{ label: 'Subscriptions', href: '/account/subscriptions', subtype: 'subscriptions' },
		{ label: 'Orders', href: '/account/orders', subtype: 'orders' },
		{ label: 'Payment methods', href: '/account/payment-methods', subtype: 'payment-methods' },
	] as const;

	const routeHeading = $derived.by(() => {
		if (subtype === 'register') return 'Create your account';
		if (subtype === 'orders') return 'Your orders';
		if (subtype === 'addresses') return 'Shipping addresses';
		if (subtype === 'payment-methods') return 'Payment methods';
		if (subtype === 'logout') return 'Sign out';
		return 'Sign in';
	});
	const breadcrumbHeading = $derived(['login', 'register', 'subscriptions', 'logout', 'unknown'].includes(subtype) ? 'Account' : routeHeading);
	const rendersIdentityEntry = $derived(['login', 'subscriptions', 'unknown'].includes(subtype));
	const loginReady = $derived(services.account === 'bigcommerce_login_ready');
	const signedIn = $derived(customerSessionState === 'authenticated');

	onMount(() => {
		if (subtype === 'orders' && signedIn) void loadOrders();
	});

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		if (!loginReady || accountBusy) return;
		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);
		accountBusy = true;
		accountMessage = '';
		try {
			const response = await fetch('/api/account/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
				body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') }),
			});
			const payload = await response.json() as { error?: { message?: string } };
			if (!response.ok) {
				accountMessage = payload.error?.message ?? 'Sign-in was not confirmed.';
				return;
			}
			window.location.assign('/account/orders');
		} catch {
			accountMessage = 'Sign-in was not confirmed. Try again when the customer service is available.';
		} finally {
			accountBusy = false;
		}
	}

	async function signOut() {
		if (!loginReady || accountBusy) return;
		accountBusy = true;
		accountMessage = '';
		try {
			const response = await fetch('/api/account/session', {
				method: 'DELETE',
				headers: { 'Idempotency-Key': crypto.randomUUID() },
			});
			const payload = await response.json() as { error?: { message?: string } };
			if (!response.ok) {
				accountMessage = payload.error?.message ?? 'Sign-out was not confirmed.';
				return;
			}
			window.location.assign('/account');
		} catch {
			accountMessage = 'Sign-out was not confirmed. Your server session was kept.';
		} finally {
			accountBusy = false;
		}
	}

	async function loadOrders() {
		ordersState = 'loading';
		try {
			const response = await fetch('/api/account/orders', { headers: { Accept: 'application/json' } });
			const payload = await response.json() as { orders?: CustomerOrderSummary[] };
			if (!response.ok || !Array.isArray(payload.orders)) {
				ordersState = 'unavailable';
				return;
			}
			orders = payload.orders;
			ordersState = 'loaded';
		} catch {
			ordersState = 'unavailable';
		}
	}

	function money(value: number, currencyCode: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value);
	}
</script>

<div class="kibble-reference kc-reference-route kc-reference-account-page" data-kibble-route-shell="account" data-kibble-route-policy={policyVersion} data-kibble-account-subtype={subtype} data-kibble-tenant={brandName} aria-labelledby="kibble-account-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			<span aria-hidden="true">/</span>
			<a class="kc-reference-focus" href="/account">Account</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{breadcrumbHeading}</span>
		</nav>

		<header class="kc-reference-route__header kc-reference-account-page__header">
			{#if pageHeadingLevel === 'h1'}<h1 id="kibble-account-heading" class="kc-reference-display">My account</h1>{:else}<h2 id="kibble-account-heading" class="kc-reference-display">My account</h2>{/if}
		</header>

		<div class="kc-reference-account-page__layout">
			<nav aria-label="Account sections" class="kc-reference-account-page__nav">
				<ul>
					{#each sections as section (section.href)}
						<li><a class:kc-reference-account-page__nav-link--active={subtype === section.subtype && subtype !== 'subscriptions'} class="kc-reference-account-page__nav-link kc-reference-focus" href={section.href} aria-current={subtype === section.subtype && subtype !== 'subscriptions' ? 'page' : undefined}>{section.label}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="kc-reference-account-page__content" data-kibble-backend-state={services.account} data-kibble-customer-session-state={customerSessionState} data-kibble-order-history-state={services.orderHistory}>
				{#if pageHeadingLevel === 'h1'}<h2>{routeHeading}</h2>{:else}<h3>{routeHeading}</h3>{/if}
				<p class="kc-reference-route__supporting">{availabilityMessage}</p>

				<section class="kc-account-boundary" aria-label="Commerce connection status">
					<p class="kc-reference-eyebrow">Connection status</p>
					<dl>
						<div><dt>Guest cart</dt><dd>{services.cart === 'bigcommerce_sandbox' ? 'Live in the BigCommerce sandbox. It remains anonymous because customer identity is not connected.' : 'Not connected.'}</dd></div>
						<div><dt>Customer identity</dt><dd>{services.account === 'merchant_decision_required' ? 'Merchant decision required: choose BigCommerce-native or subscription-service identity.' : services.account === 'private_token_required' ? 'BigCommerce-native identity is selected, but a Customer-scoped private token is still required.' : signedIn ? 'A BigCommerce customer session is active in durable server storage. The browser holds only its opaque Aisles session ID.' : 'BigCommerce password login is ready. Customer credentials and the customer access token stay server-side.'}</dd></div>
						<div><dt>Order history</dt><dd>{signedIn ? 'Ready through the signed-in customer token. Reads cannot create or change an order.' : 'Blocked until a signed-in customer session can authorize the provider query. No mock orders are shown.'}</dd></div>
						<div><dt>Payments</dt><dd>Provider-owned. Aisles does not accept payment credentials on account routes.</dd></div>
					</dl>
				</section>

				{#if rendersIdentityEntry}
					<div class="kc-reference-account-page__modes" aria-label="Sign-in methods">
						<button type="button" disabled={!loginReady}>Password</button>
						<button type="button" disabled>Magic link</button>
					</div>
					<form class="kc-reference-disabled-form" aria-label={loginReady ? 'Sign in' : 'Sign in unavailable'} onsubmit={signIn}>
						<label>Email address<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required disabled={!loginReady || accountBusy} /></label>
						<label>Password<input name="password" type="password" autocomplete="current-password" required disabled={!loginReady || accountBusy} /></label>
						<button type="submit" disabled={!loginReady || accountBusy}>{loginReady ? accountBusy ? 'Signing in…' : 'Sign in' : 'Sign in unavailable'}</button>
					</form>
					{#if accountMessage}<p role="status" class="kc-reference-account-page__message">{accountMessage}</p>{/if}
					<p class="kc-reference-account-page__alternate">No account? <a class="kc-reference-focus" href="/account/register">Create one</a></p>
					<p class="kc-reference-account-page__catalog-link">Don't have a subscription yet? <a class="kc-reference-focus" href="/">Browse the catalog</a>.</p>
				{:else if subtype === 'register'}
					<form class="kc-reference-disabled-form" aria-label="Account registration unavailable">
						<label>First name<input type="text" disabled /></label>
						<label>Last name<input type="text" disabled /></label>
						<label>Email address<input type="email" placeholder="you@example.com" disabled /></label>
						<label>Password<input type="password" disabled /></label>
						<button type="button" disabled>Create account unavailable</button>
					</form>
				{:else if subtype === 'logout'}
					<button class="kc-reference-disabled-action" type="button" disabled={!signedIn || accountBusy} onclick={signOut}>{signedIn ? accountBusy ? 'Signing out…' : 'Sign out' : 'Sign out unavailable'}</button>
					{#if accountMessage}<p role="status" class="kc-reference-account-page__message">{accountMessage}</p>{/if}
				{:else if subtype === 'orders' && signedIn}
					{#if ordersState === 'loading'}
						<p role="status">Loading order history…</p>
					{:else if ordersState === 'unavailable'}
						<p role="alert">BigCommerce did not confirm the current order history.</p>
					{:else if ordersState === 'loaded' && orders.length === 0}
						<p>No BigCommerce orders were returned for this customer.</p>
					{:else if ordersState === 'loaded'}
						<ul class="kc-reference-account-page__orders">
							{#each orders as order (order.orderId)}
								<li><strong>Order {order.orderId}</strong><span>{order.status}</span><span>{order.itemCount} items</span><span>{money(order.total.value, order.total.currencyCode)}</span></li>
							{/each}
						</ul>
					{/if}
				{:else}
					<div class="kc-reference-account-page__empty-section">
						<p>{routeHeading} cannot be loaded because {brandName} account services are not connected.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.kc-account-boundary { margin:1.1rem 0; border:1px solid var(--kc-border); background:var(--kc-panel); padding:1rem; }
	.kc-account-boundary > p { margin:0 0 .7rem; }
	.kc-account-boundary dl { display:grid; gap:.65rem; margin:0; }
	.kc-account-boundary dl > div { border-top:1px solid var(--kc-border); padding-top:.65rem; }
	.kc-account-boundary dt { color:var(--kc-identity); font-size:.75rem; font-weight:900; letter-spacing:.06em; text-transform:uppercase; }
	.kc-account-boundary dd { margin:.2rem 0 0; color:var(--kc-muted-text); line-height:1.5; }
	.kc-reference-account-page__message { margin:.75rem 0; color:var(--kc-identity); font-weight:700; }
	.kc-reference-account-page__orders { display:grid; gap:.75rem; margin:1rem 0; padding:0; list-style:none; }
	.kc-reference-account-page__orders li { display:grid; grid-template-columns:1.5fr 1fr .75fr .75fr; gap:.75rem; border:1px solid var(--kc-border); padding:.85rem; }
</style>
