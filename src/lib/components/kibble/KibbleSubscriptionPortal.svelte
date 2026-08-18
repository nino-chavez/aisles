<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		SubscriptionPortalAction,
		SubscriptionPortalDetail,
		SubscriptionPortalState,
		SubscriptionPortalSummary,
	} from '$lib/commerce/subscription-portal-contract';
	import type { CustomerSessionStateView } from '$lib/commerce/customer-contract';

	let {
		customerSessionState,
		subscriptionId = null,
	}: {
		customerSessionState: CustomerSessionStateView;
		subscriptionId?: string | null;
	} = $props();

	let portalState = $state<SubscriptionPortalState>(initialPortalState());
	let subscriptions = $state<SubscriptionPortalSummary[]>([]);
	let detail = $state<SubscriptionPortalDetail | null>(null);
	let loading = $state(false);
	let busyAction = $state<SubscriptionPortalAction | 'connect' | 'disconnect' | null>(null);
	let message = $state('');
	let isError = $state(false);
	let outcomeUnknown = $state(false);
	let pauseWeeks = $state(8);
	let nextChargeDate = $state('');
	let cancelConfirmation = $state('');

	const minDate = dateFromNow(2);
	const maxDate = dateFromNow(90);

	function initialPortalState(): SubscriptionPortalState {
		return customerSessionState === 'authenticated' ? 'connection_required' : 'customer_session_required';
	}

	onMount(() => {
		if (customerSessionState === 'authenticated') void refreshStatus();
	});

	async function refreshStatus() {
		loading = true;
		message = '';
		isError = false;
		try {
			const response = await fetch('/api/subscriptions/portal/session', { headers: { Accept: 'application/json' } });
			const payload = await response.json() as { state?: SubscriptionPortalState; error?: { message?: string } };
			portalState = payload.state ?? (response.status === 401 ? 'connection_required' : 'unavailable');
			if (portalState === 'connected') await loadSubscriptionData();
		} catch {
			portalState = 'unavailable';
			message = 'Auto-Refill management could not be reached.';
			isError = true;
		} finally {
			loading = false;
		}
	}

	async function connectPortal() {
		busyAction = 'connect';
		message = '';
		isError = false;
		try {
			const response = await fetch('/api/subscriptions/portal/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
				body: '{}',
			});
			const payload = await response.json() as { state?: SubscriptionPortalState; error?: { message?: string }; evidence?: unknown };
			emitEvidence(payload.evidence);
			if (!response.ok || payload.state !== 'connected') throw new Error(payload.error?.message ?? 'Auto-Refill management was not connected.');
			portalState = 'connected';
			message = 'Auto-Refill management is connected for this signed-in customer.';
			await loadSubscriptionData();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Auto-Refill management was not connected.';
			isError = true;
		} finally {
			busyAction = null;
		}
	}

	async function disconnectPortal() {
		busyAction = 'disconnect';
		try {
			const response = await fetch('/api/subscriptions/portal/session', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
				body: '{}',
			});
			const payload = await response.json() as { state?: SubscriptionPortalState; error?: { message?: string }; evidence?: unknown };
			emitEvidence(payload.evidence);
			if (!response.ok) throw new Error(payload.error?.message ?? 'The portal session was not disconnected.');
			portalState = payload.state ?? 'connection_required';
			subscriptions = [];
			detail = null;
			message = 'The server-held Auto-Refill portal session was removed.';
			isError = false;
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'The portal session was not disconnected.';
			isError = true;
		} finally {
			busyAction = null;
		}
	}

	async function loadSubscriptionData() {
		const path = subscriptionId
			? `/api/subscriptions/portal/${encodeURIComponent(subscriptionId)}`
			: '/api/subscriptions/portal';
		const response = await fetch(path, { headers: { Accept: 'application/json' } });
		const payload = await response.json() as {
			state?: SubscriptionPortalState;
			subscriptions?: SubscriptionPortalSummary[];
			subscription?: SubscriptionPortalDetail;
			error?: { code?: string; message?: string };
			evidence?: unknown;
		};
		emitEvidence(payload.evidence);
		if (!response.ok) {
			if (payload.error?.code === 'portal_session_expired' || payload.error?.code === 'portal_connection_required') portalState = 'connection_required';
			throw new Error(payload.error?.message ?? 'The provider did not confirm subscription data.');
		}
		portalState = 'connected';
		if (subscriptionId) detail = payload.subscription ?? null;
		else subscriptions = payload.subscriptions ?? [];
	}

	async function runAction(action: SubscriptionPortalAction) {
		if (!detail || outcomeUnknown || busyAction) return;
		busyAction = action;
		message = '';
		isError = false;
		const body = action === 'pause'
			? { weeks: pauseWeeks }
			: action === 'reschedule'
				? { nextChargeDate }
				: {};
		try {
			const response = await fetch(`/api/subscriptions/portal/${encodeURIComponent(detail.id)}/${action}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
				body: JSON.stringify(body),
			});
			const payload = await response.json() as { error?: { code?: string; message?: string }; evidence?: unknown };
			emitEvidence(payload.evidence);
			if (!response.ok) {
				outcomeUnknown = payload.error?.code === 'provider_outcome_unknown';
				throw new Error(payload.error?.message ?? 'The provider did not confirm the subscription change.');
			}
			message = successMessage(action);
			cancelConfirmation = '';
			await loadSubscriptionData();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'The provider did not confirm the subscription change.';
			isError = true;
		} finally {
			busyAction = null;
		}
	}

	function emitEvidence(evidence: unknown) {
		if (evidence) window.dispatchEvent(new CustomEvent('commerce-service-outcome', { detail: evidence }));
	}

	function money(value: number, currencyCode: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value);
	}

	function date(value: string | null): string {
		return value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : 'Not scheduled';
	}

	function dateFromNow(days: number): string {
		const value = new Date(Date.now() + days * 86_400_000);
		return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
	}

	function successMessage(action: SubscriptionPortalAction): string {
		if (action === 'skip') return 'The provider confirmed the next delivery was skipped.';
		if (action === 'pause') return `The provider confirmed a ${pauseWeeks}-week pause.`;
		if (action === 'resume') return 'The provider confirmed the subscription resumed.';
		if (action === 'reschedule') return `The provider confirmed the next charge moved to ${date(nextChargeDate)}.`;
		if (action === 'cancel') return 'The provider confirmed the subscription was cancelled.';
		return 'The provider confirmed the subscription was reactivated.';
	}
</script>

<section class="kc-subscriber-portal" aria-labelledby="kc-subscriber-portal-heading" data-kibble-portal-session-state={portalState}>
	<header>
		<p class="kc-reference-eyebrow">Auto-Refill management</p>
		<h2 id="kc-subscriber-portal-heading">{subscriptionId ? 'Subscription details' : 'Your Auto-Refill subscriptions'}</h2>
	</header>

	{#if customerSessionState !== 'authenticated'}
		<div class="kc-subscriber-portal__gate">
			<p>Sign in with your BigCommerce customer account before reading subscription data.</p>
			<a class="kc-reference-button kc-reference-button--primary kc-reference-focus" href="/account/login">Sign in</a>
		</div>
	{:else if portalState === 'provider_configuration_required'}
		<div class="kc-subscriber-portal__gate" role="status">
			<strong>Provider setup remains.</strong>
			<p>The shared server-to-server handoff secret must be configured on Aisles and the subscription provider. No subscriber request was started.</p>
		</div>
	{:else if portalState === 'connection_required'}
		<div class="kc-subscriber-portal__gate">
			<p>Connect this verified BigCommerce customer to the Auto-Refill provider. The provider may create its customer reference. Its portal token stays in Aisles server storage.</p>
			<button class="kc-reference-button kc-reference-button--primary kc-reference-focus" type="button" onclick={connectPortal} disabled={busyAction !== null}>{busyAction === 'connect' ? 'Connecting…' : 'Connect Auto-Refill management'}</button>
		</div>
	{:else if portalState === 'unavailable'}
		<div class="kc-subscriber-portal__gate" role="alert">
			<p>Auto-Refill management is temporarily unavailable.</p>
			<button type="button" onclick={refreshStatus} disabled={loading}>Try again</button>
		</div>
	{:else if loading}
		<p role="status">Loading provider-confirmed subscriptions…</p>
	{:else if subscriptionId && detail}
		<article class="kc-subscriber-portal__detail">
			<a class="kc-reference-route__text-link kc-reference-focus" href="/account/subscriptions">← All subscriptions</a>
			<div class="kc-subscriber-portal__title"><div><span class={`kc-subscriber-portal__status kc-subscriber-portal__status--${detail.status}`}>{detail.status.replace('_', ' ')}</span><h3>{detail.planName}</h3></div><strong>{money(detail.recurringPrice.value, detail.recurringPrice.currencyCode)}</strong></div>
			<dl>
				<div><dt>Cadence</dt><dd>{detail.cadence}</dd></div>
				<div><dt>Next charge</dt><dd>{date(detail.nextChargeAt)}</dd></div>
				<div><dt>Current period ends</dt><dd>{date(detail.currentPeriodEnd)}</dd></div>
				<div><dt>Completed cycles</dt><dd>{detail.cyclesCompleted}</dd></div>
			</dl>

			{#if detail.status === 'active'}
				<section class="kc-subscriber-portal__actions" aria-labelledby="kc-subscription-actions-heading">
					<h3 id="kc-subscription-actions-heading">Manage the next delivery</h3>
					<div class="kc-subscriber-portal__action-grid">
						<button type="button" onclick={() => runAction('skip')} disabled={busyAction !== null || outcomeUnknown}>{busyAction === 'skip' ? 'Skipping…' : 'Skip next delivery'}</button>
						<label>Pause length<input type="number" bind:value={pauseWeeks} min="1" max="52" step="1" inputmode="numeric" disabled={busyAction !== null || outcomeUnknown} /></label>
						<button type="button" onclick={() => runAction('pause')} disabled={busyAction !== null || outcomeUnknown || !Number.isInteger(pauseWeeks) || pauseWeeks < 1 || pauseWeeks > 52}>{busyAction === 'pause' ? 'Pausing…' : 'Pause subscription'}</button>
						<label>New charge date<input type="date" bind:value={nextChargeDate} min={minDate} max={maxDate} disabled={busyAction !== null || outcomeUnknown} /></label>
						<button type="button" onclick={() => runAction('reschedule')} disabled={busyAction !== null || outcomeUnknown || !nextChargeDate}>{busyAction === 'reschedule' ? 'Rescheduling…' : 'Reschedule charge'}</button>
					</div>
					<details class="kc-subscriber-portal__cancel">
						<summary>Cancel Auto-Refill</summary>
						<p>Cancellation stops future subscription charges. Type CANCEL to enable the provider request.</p>
						<label>Confirmation<input type="text" bind:value={cancelConfirmation} autocomplete="off" /></label>
						<button type="button" onclick={() => runAction('cancel')} disabled={busyAction !== null || outcomeUnknown || cancelConfirmation !== 'CANCEL'}>{busyAction === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}</button>
					</details>
				</section>
			{:else if detail.status === 'paused'}
				<button class="kc-reference-button kc-reference-button--primary" type="button" onclick={() => runAction('resume')} disabled={busyAction !== null || outcomeUnknown}>{busyAction === 'resume' ? 'Resuming…' : 'Resume subscription'}</button>
			{:else if detail.status === 'cancelled'}
				<button class="kc-reference-button kc-reference-button--primary" type="button" onclick={() => runAction('reactivate')} disabled={busyAction !== null || outcomeUnknown}>{busyAction === 'reactivate' ? 'Reactivating…' : 'Reactivate subscription'}</button>
			{/if}

			<section class="kc-subscriber-portal__charges" aria-labelledby="kc-subscription-charges-heading">
				<h3 id="kc-subscription-charges-heading">Charge history</h3>
				{#if detail.charges.length === 0}<p>No charges were returned for this subscription.</p>{:else}<ul>{#each detail.charges as charge (charge.id)}<li><span>{date(charge.scheduledAt)}</span><strong>{money(charge.amount.value, charge.amount.currencyCode)}</strong><span>{charge.status}</span></li>{/each}</ul>{/if}
			</section>
		</article>
	{:else if subscriptionId}
		<p role="alert">The provider did not return this subscription.</p>
	{:else}
		<div class="kc-subscriber-portal__connected">
			<div class="kc-subscriber-portal__connected-header"><p>Provider session connected. The browser still holds only the opaque Aisles session cookie.</p><button type="button" onclick={disconnectPortal} disabled={busyAction !== null}>{busyAction === 'disconnect' ? 'Disconnecting…' : 'Disconnect portal'}</button></div>
			{#if subscriptions.length === 0}
				<p>No subscriptions were returned for this customer.</p>
			{:else}
				<ul class="kc-subscriber-portal__list">
					{#each subscriptions as subscription (subscription.id)}
						<li><div><span class={`kc-subscriber-portal__status kc-subscriber-portal__status--${subscription.status}`}>{subscription.status.replace('_', ' ')}</span><h3>{subscription.planName}</h3><p>{subscription.cadence} · Next charge {date(subscription.nextChargeAt)}</p></div><div><strong>{money(subscription.recurringPrice.value, subscription.recurringPrice.currencyCode)}</strong><a class="kc-reference-focus" href={`/portal/subscriptions/${encodeURIComponent(subscription.id)}`}>Manage</a></div></li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if message}<p class:kc-subscriber-portal__message--error={isError} class="kc-subscriber-portal__message" role={isError ? 'alert' : 'status'}>{message}</p>{/if}
	{#if outcomeUnknown}<p role="alert" class="kc-subscriber-portal__recovery"><strong>Stop before another change.</strong> The provider outcome is unknown. Reload this subscription and verify its current state first.</p>{/if}

	<footer><small>BigCommerce owns checkout and order truth. The subscription provider owns recurring schedules and payment methods. Aisles only holds opaque session references and relays your explicit action. AI cannot perform these changes.</small></footer>
</section>

<style>
	.kc-subscriber-portal { display:grid; gap:1rem; border:1px solid var(--kc-border-strong); background:var(--kc-surface); padding:clamp(1rem, 3vw, 1.5rem); }
	.kc-subscriber-portal header h2, .kc-subscriber-portal h3 { margin:.2rem 0 0; }
	.kc-subscriber-portal__gate { display:grid; justify-items:start; gap:.75rem; border:1px solid var(--kc-border); background:var(--kc-panel); padding:1rem; }
	.kc-subscriber-portal__gate p { max-width:68ch; margin:0; line-height:1.55; }
	.kc-subscriber-portal__connected-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
	.kc-subscriber-portal__connected-header p { margin:0; }
	.kc-subscriber-portal__list { display:grid; gap:.75rem; margin:1rem 0 0; padding:0; list-style:none; }
	.kc-subscriber-portal__list li { display:flex; justify-content:space-between; gap:1rem; border:1px solid var(--kc-border); padding:1rem; }
	.kc-subscriber-portal__list li > div:last-child { display:grid; justify-items:end; align-content:space-between; gap:.5rem; }
	.kc-subscriber-portal__list p { margin:.4rem 0 0; color:var(--kc-muted-text); }
	.kc-subscriber-portal__list a { color:var(--kc-action); font-weight:800; }
	.kc-subscriber-portal__status { display:inline-block; border:1px solid var(--kc-border-strong); padding:.2rem .45rem; font-size:.72rem; font-weight:900; letter-spacing:.05em; text-transform:uppercase; }
	.kc-subscriber-portal__status--active { border-color:#2d6a4f; color:#2d6a4f; }
	.kc-subscriber-portal__status--past_due { border-color:#a63d2f; color:#a63d2f; }
	.kc-subscriber-portal__title { display:flex; justify-content:space-between; gap:1rem; align-items:start; }
	.kc-subscriber-portal__detail > dl { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:.75rem; }
	.kc-subscriber-portal__detail > dl > div { border:1px solid var(--kc-border); background:var(--kc-panel); padding:.75rem; }
	.kc-subscriber-portal dt { color:var(--kc-identity); font-size:.72rem; font-weight:900; letter-spacing:.06em; text-transform:uppercase; }
	.kc-subscriber-portal dd { margin:.25rem 0 0; }
	.kc-subscriber-portal__actions, .kc-subscriber-portal__charges { margin-top:1rem; border-top:1px solid var(--kc-border); padding-top:1rem; }
	.kc-subscriber-portal__action-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:.75rem; margin-top:.75rem; }
	.kc-subscriber-portal button, .kc-subscriber-portal input { min-height:44px; border:1px solid var(--kc-border-strong); background:var(--kc-surface); padding:.65rem .8rem; font:inherit; }
	.kc-subscriber-portal button:not(:disabled) { cursor:pointer; font-weight:800; }
	.kc-subscriber-portal label { display:grid; gap:.35rem; font-weight:700; }
	.kc-subscriber-portal__cancel { margin-top:1rem; border:1px solid var(--kc-border); padding:.8rem; }
	.kc-subscriber-portal__cancel summary { cursor:pointer; color:#8d2e25; font-weight:800; }
	.kc-subscriber-portal__cancel label { max-width:20rem; margin:.75rem 0; }
	.kc-subscriber-portal__charges ul { display:grid; gap:.35rem; padding:0; list-style:none; }
	.kc-subscriber-portal__charges li { display:grid; grid-template-columns:1fr auto auto; gap:1rem; border-bottom:1px solid var(--kc-border); padding:.55rem 0; }
	.kc-subscriber-portal__message { margin:0; color:var(--kc-identity); font-weight:700; }
	.kc-subscriber-portal__message--error, .kc-subscriber-portal__recovery { color:#8d2e25; }
	.kc-subscriber-portal footer { border-top:1px solid var(--kc-border); padding-top:.8rem; color:var(--kc-muted-text); line-height:1.5; }
	@media (max-width:700px) { .kc-subscriber-portal__connected-header, .kc-subscriber-portal__list li, .kc-subscriber-portal__title { align-items:stretch; flex-direction:column; } .kc-subscriber-portal__list li > div:last-child { justify-items:start; } .kc-subscriber-portal__detail > dl, .kc-subscriber-portal__action-grid { grid-template-columns:1fr; } }
</style>
