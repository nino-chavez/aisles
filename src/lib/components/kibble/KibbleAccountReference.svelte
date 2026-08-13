<script lang="ts">
	import './kibble-reference.css';

	type AccountSubtype = 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout' | 'unknown';

	let {
		subtype,
		brandName,
		availabilityMessage,
	}: {
		subtype: AccountSubtype;
		brandName: string;
		availabilityMessage: string;
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
		if (subtype === 'subscriptions') return 'Your subscriptions';
		if (subtype === 'logout') return 'Sign out';
		return 'Sign in';
	});
</script>

<section class="kibble-reference kc-reference-route kc-reference-account-page" data-kibble-route-shell="account" data-kibble-account-subtype={subtype} data-kibble-tenant={brandName} aria-labelledby="kibble-account-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			<span aria-hidden="true">/</span>
			<a class="kc-reference-focus" href="/account">Account</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{routeHeading}</span>
		</nav>

		<header class="kc-reference-route__header kc-reference-account-page__header">
			<h1 id="kibble-account-heading" class="kc-reference-display">My account</h1>
		</header>

		<div class="kc-reference-account-page__layout">
			<nav aria-label="Account sections" class="kc-reference-account-page__nav">
				<ul>
					{#each sections as section (section.href)}
						<li><a class:kc-reference-account-page__nav-link--active={subtype === section.subtype} class="kc-reference-account-page__nav-link kc-reference-focus" href={section.href} aria-current={subtype === section.subtype ? 'page' : undefined}>{section.label}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="kc-reference-account-page__content" data-kibble-backend-state="unavailable">
				<h2>{routeHeading}</h2>
				<p class="kc-reference-route__supporting">{availabilityMessage}</p>

				{#if subtype === 'login' || subtype === 'unknown'}
					<div class="kc-reference-account-page__modes" aria-label="Sign-in methods">
						<button type="button" disabled>Password</button>
						<button type="button" disabled>Magic link</button>
					</div>
					<form class="kc-reference-disabled-form" aria-label="Sign in unavailable">
						<label>Email address<input type="email" placeholder="you@example.com" disabled /></label>
						<label>Password<input type="password" disabled /></label>
						<button type="button" disabled>Sign in unavailable</button>
					</form>
				{:else if subtype === 'register'}
					<form class="kc-reference-disabled-form" aria-label="Account registration unavailable">
						<label>First name<input type="text" disabled /></label>
						<label>Last name<input type="text" disabled /></label>
						<label>Email address<input type="email" placeholder="you@example.com" disabled /></label>
						<label>Password<input type="password" disabled /></label>
						<button type="button" disabled>Create account unavailable</button>
					</form>
				{:else if subtype === 'subscriptions'}
					<p>Sign in to manage your subscriptions.</p>
					<form class="kc-reference-disabled-form" aria-label="Subscription sign in unavailable">
						<label>Email address<input type="email" placeholder="you@example.com" disabled /></label>
						<button type="button" disabled>Email sign-in unavailable</button>
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
</section>
