import type { CommerceEvidence, CommerceServiceBoundary } from './cart-contract';

export type SubscriptionInterval = 'day' | 'week' | 'month' | 'year';

export interface SubscriptionPlan {
	id: string;
	productEntityId: number;
	name: string;
	interval: SubscriptionInterval;
	intervalCount: number;
	price: { value: number; currencyCode: string };
	salesMode: 'subscription_only' | 'subscribe_and_one_time';
	trialDays: number;
	commitmentCycles: number;
}

export interface SubscriptionPlansPayload {
	plans: SubscriptionPlan[];
	services: CommerceServiceBoundary;
	evidence: CommerceEvidence;
}

export interface SubscriptionIntentPayload {
	plan: SubscriptionPlan;
	itemCount: number;
	services: CommerceServiceBoundary;
	evidence: CommerceEvidence;
	replayed?: boolean;
}

export function cadenceLabel(plan: Pick<SubscriptionPlan, 'interval' | 'intervalCount'>): string {
	const unit = plan.intervalCount === 1 ? plan.interval : `${plan.interval}s`;
	return plan.intervalCount === 1 ? `Every ${unit}` : `Every ${plan.intervalCount} ${unit}`;
}
