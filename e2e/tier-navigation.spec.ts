import { test, expect } from '@playwright/test';
import { setTier, TIERS } from './helpers';

test.describe('tier toggle (no tier cookie)', () => {
	test('switching tier from the home page control lands on that tier\'s storefront', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Enterprise' }).click();
		await expect(page.getByText(/enterprise merchant storefront/i)).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
	});
});

for (const tier of TIERS) {
	test.describe(`${tier} tier`, () => {
		test.beforeEach(async ({ context, baseURL }) => {
			await setTier(context, baseURL!, tier);
		});

		test('persists across navigation without re-selecting it', async ({ page }) => {
			await page.goto('/');
			await expect(page.getByText(new RegExp(`${tier} merchant storefront`, 'i'))).toBeVisible();
			await page.locator('.kc-tier-storefront__card-title').first().click();
			await expect(page.getByText(/merchant tier demo/i)).toBeVisible();
		});

		test('category grid: every product card is a real, working link', async ({ page }) => {
			await page.goto('/');
			await page.locator('.kc-tier-storefront__card-title').first().click();
			// Without this, the home page's own rail cards (also .kc-reference-product-card)
			// can satisfy the assertions below before the category page has loaded.
			await page.waitForURL(/\/category\//);
			await expect(page.locator('.kc-reference-product-card--disabled')).toHaveCount(0);
			const firstCard = page.locator('.kc-reference-product-card').first();
			await expect(firstCard).toHaveAttribute('href', /^\/product\//);
		});

		test('category grid -> PDP: clicking a card reaches its own product page', async ({ page }) => {
			await page.goto('/');
			await page.locator('.kc-tier-storefront__card-title').first().click();
			const card = page.locator('.kc-reference-product-card').first();
			const name = (await card.locator('.kc-reference-product-card__name').innerText()).trim();
			await card.click();
			// Asserts arrival at the card's own PDP, not purchasability — commerce
			// service availability (add-to-cart) is environment-dependent (see
			// cart-and-checkout.spec.ts, which found preview deploys can lack the
			// commerce service binding production has) and orthogonal to whether
			// the link itself worked.
			await expect(page.locator('h1')).toHaveText(name);
			await expect(page).toHaveURL(/\/product\//);
		});

		test('subcategory chip navigates into a narrower shelf', async ({ page }) => {
			await page.goto('/');
			await page.locator('.kc-tier-storefront__card-title').first().click();
			// waitForURL, not toBeVisible('h1') — the home page already has its own
			// <h1>, so a visibility check resolves before navigation lands and the
			// .count() below silently reads the home page's DOM instead.
			await page.waitForURL(/\/category\//);
			const chip = page.locator('.kc-tier-category__children a').first();
			test.skip((await chip.count()) === 0, 'top category sampled has no children at this tier');
			const chipLabel = (await chip.innerText()).trim();
			await chip.click();
			await expect(page.locator('h1')).toHaveText(new RegExp(chipLabel.split(' (')[0], 'i'));
		});

		test('home rail -> PDP: clicking a featured card reaches its product page', async ({ page }) => {
			await page.goto('/');
			const rail = page.locator('.kc-tier-storefront__rail .kc-reference-product-card').first();
			test.skip((await rail.count()) === 0, 'this tier has no home rails provisioned');
			await rail.click();
			await expect(page).toHaveURL(/\/product\//);
			await expect(page.locator('h1')).toBeVisible();
		});
	});
}
