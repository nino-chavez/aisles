<script lang="ts">
	import './kibble-reference.css';
	import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';

	type AccountSubtype = 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout' | 'unknown';

	let {
		subtype,
		brandName,
		availabilityMessage,
		policyVersion,
		pageHeadingLevel = 'h1',
		services = { mode: 'off', cart: 'not_connected', checkout: 'not_connected', orderCreation: 'not_exposed', orderHistory: 'customer_session_required', account: 'merchant_decision_required', payment: 'provider_owned', subscription: 'provider_not_connected', subscriptionPortal: 'portal_session_required' },
	}: {
		subtype: AccountSubtype;
		brandName: string;
		availabilityMessage: string;
		policyVersion?: string;
		pageHeadingLevel?: 'h1' | 'h2';
		services?: CommerceServiceBoundary;
	} = $props();

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

			<div class="kc-reference-account-page__content" data-kibble-backend-state={services.account} data-kibble-order-history-state={services.orderHistory}>
				{#if pageHeadingLevel === 'h1'}<h2>{routeHeading}</h2>{:else}<h3>{routeHeading}</h3>{/if}
				<p class="kc-reference-route__supporting">{availabilityMessage}</p>

				<section class="kc-account-boundary" aria-label="Commerce connection status">
					<p class="kc-reference-eyebrow">Connection status</p>
					<dl>
						<div><dt>Guest cart</dt><dd>{services.cart === 'bigcommerce_sandbox' ? 'Live in the BigCommerce sandbox. It remains anonymous because customer identity is not connected.' : 'Not connected.'}</dd></div>
						<div><dt>Customer identity</dt><dd>Merchant decision required: choose BigCommerce-native or subscription-service identity, then add an opaque server-owned customer session.</dd></div>
						<div><dt>Order history</dt><dd>Blocked until a signed-in customer session can authorize the provider query. No mock orders are shown.</dd></div>
						<div><dt>Payments</dt><dd>Provider-owned. Aisles does not accept payment credentials on account routes.</dd></div>
					</dl>
				</section>

				{#if rendersIdentityEntry}
					<div class="kc-reference-account-page__modes" aria-label="Sign-in methods">
						<button type="button" disabled>Password</button>
						<button type="button" disabled>Magic link</button>
					</div>
					<form class="kc-reference-disabled-form" aria-label="Sign in unavailable">
						<label>Email address<input type="email" placeholder="you@example.com" disabled /></label>
						<label>Password<input type="password" disabled /></label>
						<button type="button" disabled>Sign in unavailable</button>
					</form>
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
					<button class="kc-reference-disabled-action" type="button" disabled>Sign out unavailable</button>
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
</style>
