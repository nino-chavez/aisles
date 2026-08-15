import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { chromium } from 'playwright';
import KibbleCartReference from './KibbleCartReference.svelte';
import KibbleProductDetailReference from './KibbleProductDetailReference.svelte';

const services = {
	mode: 'sandbox' as const,
	cart: 'bigcommerce_sandbox' as const,
	checkout: 'bigcommerce_hosted_handoff' as const,
	orderCreation: 'not_exposed' as const,
	account: 'not_configured' as const,
	payment: 'provider_owned' as const,
	subscription: 'not_configured' as const,
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
});
