import { test, expect } from '@playwright/test';

// Starts directly on a known-good PDP rather than chaining through a category
// click first — this suite is testing "does add-to-cart work", not
// "can you reach a PDP" (tier-navigation.spec.ts already covers that
// separately, so one compounding failure doesn't hide the other).

test('add to cart puts the product on the cart page', async ({ page }) => {
	await page.goto('/product/openfarm-salmon-cod-topper-for-dogs');
	const name = (await page.locator('h1').innerText()).trim();
	await page.getByRole('button', { name: /^add to cart/i }).click();
	await expect(page.getByRole('button', { name: /^add to cart/i })).not.toHaveText(/adding/i, { timeout: 10_000 });

	await page.goto('/cart');
	await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
	await expect(page.locator('.kc-reference-cart__lines')).toContainText(name);
});

test('cart -> checkout handoff leaves the storefront for BigCommerce hosted checkout', async ({ page, baseURL }) => {
	await page.goto('/product/openfarm-salmon-cod-topper-for-dogs');
	await page.getByRole('button', { name: /^add to cart/i }).click();
	await page.waitForTimeout(1000); // clears the "Adding…" disabled state before navigating away

	await page.goto('/cart');
	const checkoutButton = page.getByRole('button', { name: /continue to secure checkout/i });
	await expect(checkoutButton).toBeEnabled();
	await Promise.all([
		page.waitForURL((url) => url.hostname !== new URL(baseURL!).hostname, { timeout: 15_000 }),
		checkoutButton.click(),
	]);
	// A real order isn't placed — payment details are out of scope for this
	// suite. Reaching BigCommerce's own checkout host is the contract this
	// storefront owns; everything past that boundary is BigCommerce's.
	expect(page.url()).not.toContain(new URL(baseURL!).hostname);
});
