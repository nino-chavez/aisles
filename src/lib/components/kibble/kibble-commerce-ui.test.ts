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
						},
					],
				},
			},
		});
		expect(body).toContain('data-kibble-backend-state="bigcommerce-sandbox"');
		for (const label of ['Sandbox dog food', 'Decrease Sandbox dog food quantity', 'Increase Sandbox dog food quantity', 'Remove', 'Empty cart', 'Continue to secure checkout', '$24.00']) {
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
