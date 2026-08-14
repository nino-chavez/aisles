<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleAccountSessionView, KibbleOrderView } from './types';

	type AccountSubtype = 'account' | 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout' | 'unknown';

	let {
		subtype,
		brandName,
		availabilityMessage,
		policyVersion,
		commerceEnabled = false,
		session = null,
		orders = [],
		accountError = null,
	}: {
		subtype: AccountSubtype;
		brandName: string;
		availabilityMessage: string;
		policyVersion?: string;
		commerceEnabled?: boolean;
		session?: KibbleAccountSessionView | null;
		orders?: KibbleOrderView[];
		accountError?: string | null;
	} = $props();

	const sections = [
		{ label: 'Subscriptions', href: '/account/subscriptions', subtype: 'subscriptions' },
		{ label: 'Orders', href: '/account/orders', subtype: 'orders' },
		{ label: 'Payment methods', href: '/account/payment-methods', subtype: 'payment-methods' },
	] as const;

	const routeHeading = $derived.by(() => {
		if (subtype === 'account') return 'Account overview';
		if (subtype === 'register') return 'Create your account';
		if (subtype === 'orders') return 'Your orders';
		if (subtype === 'addresses') return 'Shipping addresses';
		if (subtype === 'payment-methods') return 'Payment methods';
		if (subtype === 'logout') return 'Sign out';
		return 'Sign in';
	});
	const breadcrumbHeading = $derived(['account', 'login', 'register', 'subscriptions', 'logout', 'unknown'].includes(subtype) ? 'Account' : routeHeading);
	const backendState = $derived(!commerceEnabled ? 'unavailable' : session ? 'authenticated' : 'anonymous');
	let actionError = $state<string | undefined>(undefined);
	let isSubmitting = $state(false);
	const displayActionError = $derived(actionError === undefined ? accountError ?? '' : actionError);

	async function submit(endpoint: string, event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;
		isSubmitting = true;
		actionError = '';
		try {
			const form = event.currentTarget as HTMLFormElement;
			const body = Object.fromEntries(new FormData(form).entries());
			const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			const result = await response.json() as { error?: string; next?: string };
			if (!response.ok) throw new Error(result.error || 'Account services are temporarily unavailable.');
			window.location.assign(result.next || '/account');
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Account services are temporarily unavailable.';
			isSubmitting = false;
		}
	}

	async function logout(): Promise<void> {
		if (isSubmitting) return;
		isSubmitting = true;
		actionError = '';
		try {
			const response = await fetch('/api/account/logout', { method: 'POST' });
			const result = await response.json() as { error?: string };
			if (!response.ok) throw new Error(result.error || 'Account services are temporarily unavailable.');
			window.location.assign('/account/login');
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Account services are temporarily unavailable.';
			isSubmitting = false;
		}
	}
</script>

<div class="kibble-reference kc-reference-route kc-reference-account-page" data-kibble-route-shell="account" data-kibble-route-policy={policyVersion} data-kibble-account-subtype={subtype} data-kibble-tenant={brandName} data-kibble-backend-state={backendState} aria-labelledby="kibble-account-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			<span aria-hidden="true">/</span>
			<a class="kc-reference-focus" href="/account">Account</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{breadcrumbHeading}</span>
		</nav>

		<header class="kc-reference-route__header kc-reference-account-page__header">
			<h1 id="kibble-account-heading" class="kc-reference-display">My account</h1>
		</header>

		<div class="kc-reference-account-page__layout">
			<nav aria-label="Account sections" class="kc-reference-account-page__nav">
				<ul>
					{#each sections as section (section.href)}
						<li><a class:kc-reference-account-page__nav-link--active={subtype === section.subtype && subtype !== 'subscriptions'} class="kc-reference-account-page__nav-link kc-reference-focus" href={section.href} aria-current={subtype === section.subtype && subtype !== 'subscriptions' ? 'page' : undefined}>{section.label}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="kc-reference-account-page__content">
				<h2>{routeHeading}</h2>
				<p class="kc-reference-route__supporting">{availabilityMessage}</p>

				{#if !commerceEnabled}
					{#if ['login', 'subscriptions', 'unknown'].includes(subtype)}
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
				{:else if displayActionError}
					<p class="kc-reference-route__supporting" role="alert">{displayActionError}</p>
					<a class="kc-reference-button kc-reference-button--primary kc-reference-focus" href="/account/login">Sign in</a>
				{:else if subtype === 'login' && !session}
					<form class="kc-reference-disabled-form" aria-label="Sign in" onsubmit={(event) => void submit('/api/account/login', event)}>
						<label>Email address<input name="email" type="email" autocomplete="email" required /></label>
						<label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
						<button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
					</form>
					<p class="kc-reference-account-page__alternate">No account? <a class="kc-reference-focus" href="/account/register">Create one</a></p>
				{:else if subtype === 'register' && !session}
					<form class="kc-reference-disabled-form" aria-label="Create an account" onsubmit={(event) => void submit('/api/account/register', event)}>
						<label>First name<input name="firstName" type="text" autocomplete="given-name" required /></label>
						<label>Last name<input name="lastName" type="text" autocomplete="family-name" required /></label>
						<label>Email address<input name="email" type="email" autocomplete="email" required /></label>
						<label>Password<input name="password" type="password" autocomplete="new-password" required /></label>
						<button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button>
					</form>
				{:else if subtype === 'logout'}
					<p>Signed in as <strong>{session?.email}</strong>.</p>
					<button class="kc-reference-button kc-reference-button--primary kc-reference-focus" type="button" disabled={isSubmitting} onclick={() => void logout()}>{isSubmitting ? 'Signing out…' : 'Sign out'}</button>
				{:else if subtype === 'orders' && session}
					{#if orders.length === 0}
						<div class="kc-reference-account-page__empty-section"><p>No orders are associated with this account yet.</p><a class="kc-reference-focus" href="/">Browse the catalog</a></div>
					{:else}
						<ul class="kc-reference-account-page__orders" aria-label="Your orders">
							{#each orders as order (order.entityId)}<li><strong>Order #{order.entityId}</strong><span>{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span>{#if order.totalIncTax}<span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.totalIncTax.currencyCode }).format(order.totalIncTax.value)}</span>{/if}</li>{/each}
						</ul>
					{/if}
				{:else if subtype === 'orders' && !session}
					<div class="kc-reference-account-page__empty-section"><p>Sign in to view your orders.</p><a class="kc-reference-focus" href="/account/login">Sign in</a></div>
				{:else if session}
					<p>Signed in as <strong>{session.firstName || session.email}</strong>.</p>
					<div class="kc-reference-account-page__empty-section"><p>{subtype === 'account' ? 'Your account is ready for orders and checkout.' : `${routeHeading} is not connected in this slice.`}</p><a class="kc-reference-focus" href="/account/orders">View your orders</a></div>
				{:else}
					<div class="kc-reference-account-page__empty-section"><p>Sign in to view this account section.</p><a class="kc-reference-focus" href="/account/login">Sign in</a></div>
				{/if}
			</div>
		</div>
	</div>
</div>
