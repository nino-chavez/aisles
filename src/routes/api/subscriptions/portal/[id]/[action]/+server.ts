import type { RequestHandler } from './$types';
import type { SubscriptionPortalActionInput, SubscriptionPortalOperation } from '$lib/commerce/subscription-portal-contract';
import { createSubscriberService } from '$lib/server/commerce/subscriber-service';
import { subscriberGuardFailure, subscriberLocalFailure, subscriberResponse } from '$lib/server/commerce/subscriber-http';
import {
	requireCommerceMutationCapacity,
	requireCommerceSessionId,
	requireIdempotencyKey,
	requireSameOrigin,
} from '$lib/server/commerce/session';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ACTIONS = new Set(['skip', 'pause', 'resume', 'reschedule', 'cancel', 'reactivate']);

export const POST: RequestHandler = async ({ params, request, cookies, platform, getClientAddress }) => {
	const operation = ACTIONS.has(params.action)
		? `subscription.portal.${params.action}` as SubscriptionPortalOperation
		: 'subscription.portal.detail';
	try {
		requireSameOrigin(request);
		await requireCommerceMutationCapacity(getClientAddress());
		if (!ID_PATTERN.test(params.id) || !ACTIONS.has(params.action)) {
			return subscriberLocalFailure(operation, 'invalid_request', 'A valid subscription action is required.', 400, false);
		}
		const body = await readBody(request);
		const input = actionInput(params.action, body);
		return subscriberResponse(await createSubscriberService(platform).mutate(
			requireCommerceSessionId(cookies),
			requireIdempotencyKey(request),
			params.id,
			input,
		));
	} catch (cause) {
		return subscriberGuardFailure(operation, cause);
	}
};

async function readBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new TypeError('A JSON request body is required.');
	}
}

function actionInput(action: string, body: unknown): SubscriptionPortalActionInput {
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('A JSON object is required.');
	const value = body as Record<string, unknown>;
	if (action === 'pause') {
		const weeks = value.weeks;
		if (typeof weeks !== 'number' || !Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new TypeError('Pause length must be 1 to 52 weeks.');
		return { action, weeks };
	}
	if (action === 'reschedule') {
		if (typeof value.nextChargeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.nextChargeDate)) {
			throw new TypeError('The next charge date must use YYYY-MM-DD.');
		}
		const target = Date.parse(`${value.nextChargeDate}T00:00:00.000Z`);
		const daysAhead = Math.floor((target - Date.now()) / 86_400_000);
		if (!Number.isFinite(target) || daysAhead < 1 || daysAhead > 90) throw new TypeError('The next charge date must be 1 to 90 days ahead.');
		return { action, nextChargeDate: value.nextChargeDate };
	}
	if (Object.keys(value).length > 0) throw new TypeError('This action does not accept input fields.');
	if (action === 'skip' || action === 'resume' || action === 'cancel' || action === 'reactivate') return { action };
	throw new TypeError('A valid subscription action is required.');
}
