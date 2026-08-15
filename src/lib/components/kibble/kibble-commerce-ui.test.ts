import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { chromium } from 'playwright';
import KibbleAccountReference from './KibbleAccountReference.svelte';
import KibbleCartReference from './KibbleCartReference.svelte';
import KibbleCheckoutReference from './KibbleCheckoutReference.svelte';
import KibbleProductDetailReference from './KibbleProductDetailReference.svelte';
import KibbleSubscriptionsReference from './KibbleSubscriptionsReference.svelte';

const services = {
	mode: 'sandbox' as const,
	cart: 'bigcommerce_sandbox' as const,
	checkout: 'bigcommerce_hosted_handoff' as const,
	orderCreation: 'not_exposed' as const,
	orderHistory: 'customer_session_required' as const,
	account: 'merchant_decision_required' as const,
	payment: 'provider_owned' as const,
	subscription: 'provider_not_connected' as const,
	subscriptionPortal: 'portal_session_required' as const,
};

describe('rendered Kibble commerce controls', () => {
	it('renders provider-priced lines, quantity controls, removal, emptying, and hosted checkout in a browser', async () => {
		const { body } = render(KibbleCartReference, {
			props: {
				availabilityMessage: 'Your cart is empty.',
				services,
				cart: {
					version: 2,
					currencyCode: 'USD',
					itemCount: 2,
					subtotal: { value: 24, currencyCode: 'USD' },
					total: { value: 24, currencyCode: 'USD' },
					lines: [
						{
							lineId: 'line-one',
							productEntityId: 3071,
							variantEntityId: null,
							name: 'Sandbox dog food',
								imageUrl: null,
								productPath: '/dog-food/',
								isMutable: false,
							quantity: 2,
							unitPrice: { value: 12, currencyCode: 'USD' },
							extendedPrice: { value: 24, currencyCode: 'USD' },
							subscription: { planId: 'plan-dog-food-1mo', name: 'Monthly Auto-Refill', cadence: 'Every month', recurringPrice: { value: 10.2, currencyCode: 'USD' } },
						},
					],
				},
			},
		});
		expect(body).toContain('data-kibble-backend-state="bigcommerce-sandbox"');
		for (const label of ['Sandbox dog food', 'Decrease Sandbox dog food quantity', 'Increase Sandbox dog food quantity', 'Remove', 'Empty cart', 'Continue to secure checkout', '$24.00', 'Auto-Refill', 'Every month · $10.20 recurring']) {
			expect(body).toContain(label);
		}
		expect(body).toContain('BigCommerce hosted checkout');
		expect(body).not.toContain('data-aisles-cart-model-eligible');
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
			await page.setContent(body);
				await expect(page.getByRole('button', { name: 'Increase Sandbox dog food quantity' }).isVisible()).resolves.toBe(true);
				await expect(page.getByRole('button', { name: 'Increase Sandbox dog food quantity' }).isDisabled()).resolves.toBe(true);
				await expect(page.getByRole('button', { name: 'Remove' }).isDisabled()).resolves.toBe(true);
			await expect(page.getByRole('button', { name: 'Continue to secure checkout' }).isVisible()).resolves.toBe(true);
				await expect(page.getByRole('status', { name: 'Sandbox dog food quantity' }).textContent()).resolves.toBe('2');
		} finally {
			await browser.close();
		}
	});

	it('enables one-time add only for an in-stock optionless product in sandbox mode', () => {
		const base = {
			product: {
				id: 'dog-food',
				entityId: 3071,
				name: 'Dog food',
				price: 12,
				currencyCode: 'USD',
				image: '',
				imageAlt: '',
				description: '',
				descriptionPlain: '',
				specs: {},
				tags: [],
				category: '',
				categoryPath: '',
				sku: '',
				isInStock: true,
				images: [],
			},
			bundle: null,
			breadcrumbs: [],
			options: [],
			relatedProducts: [],
			relatedProductHrefs: {},
			purchaseUnavailableLabel: 'Purchase unavailable',
			purchaseUnavailableBody: 'Not connected.',
			relatedHeading: 'Related',
			copy: {
				breadcrumbLabel: 'Breadcrumb',
				galleryLabel: 'gallery',
				galleryImagesLabel: 'images',
				viewImageLabel: 'View image',
				imageUnavailableLabel: 'No image',
				priceLabel: 'Price',
				skuLabel: 'SKU',
				inStockLabel: 'In stock',
				outOfStockLabel: 'Out',
				availabilityUnavailableLabel: 'Unknown',
				optionsLegend: 'Options',
				requiredSuffix: 'required',
				detailsHeading: 'Details',
				bundleEyebrow: 'Bundle',
				bundleProductSingular: 'product',
				bundleProductPlural: 'products',
				bundleContentsHeading: 'Includes',
			},
		};
		const { body } = render(KibbleProductDetailReference, {
			props: { ...base, commerceEnabled: true, onAddToCart: () => {} } as never,
		});
		expect(body).toContain('Add to cart — $12.00');
		expect(body).toContain('One-time purchase');
		expect(body).not.toContain('Auto-Refill checkout');
	});

	it('renders live provider plans while keeping Auto-Refill customer-gated', async () => {
		const base = {
			product: { id: 'dog-food', entityId: 3023, name: 'Dog food', price: 34.99, currencyCode: 'USD', image: '', imageAlt: '', description: '', descriptionPlain: '', specs: {}, tags: [], category: '', categoryPath: '', sku: '', isInStock: true, images: [] },
			bundle: null, breadcrumbs: [], options: [], relatedProducts: [], relatedProductHrefs: {}, purchaseUnavailableLabel: 'Unavailable', purchaseUnavailableBody: 'Unavailable', relatedHeading: 'Related',
			copy: { breadcrumbLabel: 'Breadcrumb', galleryLabel: 'gallery', galleryImagesLabel: 'images', viewImageLabel: 'View image', imageUnavailableLabel: 'No image', priceLabel: 'Price', skuLabel: 'SKU', inStockLabel: 'In stock', outOfStockLabel: 'Out', availabilityUnavailableLabel: 'Unknown', optionsLegend: 'Options', requiredSuffix: 'required', detailsHeading: 'Details', bundleEyebrow: 'Bundle', bundleProductSingular: 'product', bundleProductPlural: 'products', bundleContentsHeading: 'Includes' },
			subscriptionPlansStatus: 'ready' as const,
			subscriptionPlans: [{ id: 'plan-dog-food-1mo', productEntityId: 3023, name: 'Monthly Auto-Refill', interval: 'month' as const, intervalCount: 1, price: { value: 29.74, currencyCode: 'USD' }, salesMode: 'subscribe_and_one_time' as const, trialDays: 0, commitmentCycles: 0, introDiscountPercent: 50, introDiscountCycles: 1 }],
			commerceEnabled: true, onAddToCart: () => {}, onAddAutoRefill: () => {},
		};
		const anonymous = render(KibbleProductDetailReference, { props: { ...base, customerSessionState: 'anonymous' } as never }).body;
		const authenticated = render(KibbleProductDetailReference, { props: { ...base, customerSessionState: 'authenticated' } as never }).body;
		const subscribeOnly = render(KibbleProductDetailReference, {
			props: {
				...base,
				customerSessionState: 'authenticated',
				subscriptionPlans: base.subscriptionPlans.map((plan) => ({ ...plan, salesMode: 'subscribe_only' as const })),
			} as never,
		}).body;
		expect(anonymous).toContain('data-kibble-subscription-state="live-plans"');
		expect(anonymous).toContain('Every month — $29.74 recurring');
		expect(anonymous).toContain('Sign in');
		expect(anonymous).toContain('50% off your first delivery');
		expect(anonymous).toContain('The provider applies the introductory discount');
		expect(anonymous).toContain('Later deliveries are $29.74 every month');
		expect(anonymous).toContain('Renewal cadence:');
		expect(authenticated).not.toContain('before starting Auto-Refill');
		expect(subscribeOnly).not.toContain('<strong>One-time purchase</strong>');
		expect(subscribeOnly).toContain('Add Auto-Refill');

		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
			await page.setContent(authenticated);
			await expect(page.getByRole('radio', { name: /Auto-Refill/ }).isEnabled()).resolves.toBe(true);
			await expect(page.getByLabel('Delivery cadence').textContent()).resolves.toContain('Every month — $29.74 recurring');
			await expect(page.getByLabel('Delivery cadence').inputValue()).resolves.toBe('plan-dog-food-1mo');
		} finally {
			await browser.close();
		}
	});

	it('renders an explicit, server-owned Auto-Refill portal connection for an authenticated customer', () => {
		const body = render(KibbleSubscriptionsReference, {
			props: {
				subtype: 'account',
				brandName: 'Kibble & Co.',
				availabilityMessage: 'Manage Auto-Refill.',
				services: { ...services, account: 'bigcommerce_login_ready', subscription: 'authenticated_intent_ready' },
				customerSessionState: 'authenticated',
			},
		}).body;
		expect(body).toContain('data-kibble-portal-session-state="connection_required"');
		expect(body).toContain('Connect Auto-Refill management');
		expect(body).toContain('portal token stays in Aisles server storage');
		expect(body).not.toMatch(/Bearer |session-token|provider-token/);
	});

	it('does not report an empty cart when the provider read was unavailable', () => {
		const { body } = render(KibbleCartReference, {
			props: {
				availabilityMessage: 'The cart is temporarily unavailable.',
				services,
				cart: null,
				cartStatus: 'unavailable',
			},
		});
		expect(body).toContain('data-kibble-backend-state="unavailable"');
		expect(body).toContain('BigCommerce did not confirm the current cart.');
		expect(body).not.toContain('There is no active BigCommerce cart');
	});

	it('renders account, order, payment, and Auto-Refill gates as concrete provider states', async () => {
		const account = render(KibbleAccountReference, {
			props: {
				subtype: 'orders',
				brandName: 'Kibble & Co.',
				availabilityMessage: 'Order history requires a customer session.',
				services,
			},
		}).body;
		const subscriptions = render(KibbleSubscriptionsReference, {
			props: {
				subtype: 'portal',
				brandName: 'Kibble & Co.',
				availabilityMessage: 'Auto-Refill is unavailable.',
				services,
			},
		}).body;
		const checkout = render(KibbleCheckoutReference, {
			props: {
				subtype: 'gift',
				availabilityMessage: 'Gift checkout is unavailable.',
				services,
			},
		}).body;

		expect(account).toContain('data-kibble-backend-state="merchant_decision_required"');
		expect(account).toContain('data-kibble-order-history-state="customer_session_required"');
		expect(subscriptions).toContain('data-kibble-subscription-state="provider_not_connected"');
		expect(subscriptions).toContain('data-kibble-portal-state="portal_session_required"');
		expect(checkout).toContain('data-kibble-checkout-state="bigcommerce_hosted_handoff"');
		expect(checkout).toContain('data-kibble-payment-state="provider_owned"');

		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
			await page.setContent(`${account}${subscriptions}${checkout}`);
			await expect(page.getByRole('region', { name: 'Commerce connection status' }).first().isVisible()).resolves.toBe(true);
			await expect(page.getByRole('region', { name: 'Auto-Refill connection status' }).isVisible()).resolves.toBe(true);
			await expect(page.getByRole('region', { name: 'Checkout connection status' }).isVisible()).resolves.toBe(true);
			await expect(page.getByText('Merchant decision required:', { exact: false }).first().isVisible()).resolves.toBe(true);
			await expect(page.getByText('Subscription provider not connected.', { exact: false }).first().isVisible()).resolves.toBe(true);
			await expect(page.getByText('One-time hosted checkout:', { exact: false }).isVisible()).resolves.toBe(true);
		} finally {
			await browser.close();
		}
	});

	it('renders a working password seam only when BigCommerce identity is fully configured', async () => {
		const readyServices = { ...services, account: 'bigcommerce_login_ready' as const };
		const anonymous = render(KibbleAccountReference, {
			props: {
				subtype: 'login',
				brandName: 'Kibble & Co.',
				availabilityMessage: 'Sign in to continue.',
				services: readyServices,
				customerSessionState: 'anonymous',
			},
		}).body;
		const authenticated = render(KibbleAccountReference, {
			props: {
				subtype: 'orders',
				brandName: 'Kibble & Co.',
				availabilityMessage: 'Your order history.',
				services: readyServices,
				customerSessionState: 'authenticated',
			},
		}).body;
		expect(anonymous).toContain('data-kibble-backend-state="bigcommerce_login_ready"');
		expect(anonymous).toContain('data-kibble-customer-session-state="anonymous"');
		expect(authenticated).toContain('data-kibble-customer-session-state="authenticated"');
		expect(authenticated).toContain('Reads cannot create or change an order.');

		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
			await page.setContent(anonymous);
			await expect(page.getByRole('form', { name: 'Sign in' }).isVisible()).resolves.toBe(true);
			await expect(page.getByLabel('Email address').isEnabled()).resolves.toBe(true);
			await expect(page.getByLabel('Password').isEnabled()).resolves.toBe(true);
			await expect(page.getByRole('button', { name: 'Sign in', exact: true }).isEnabled()).resolves.toBe(true);
			await expect(page.getByRole('button', { name: 'Magic link' }).isDisabled()).resolves.toBe(true);
		} finally {
			await browser.close();
		}
	});
});
