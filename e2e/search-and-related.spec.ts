import { test, expect } from '@playwright/test';

// Search and the curated-category "Load more" both run against the
// default (no-tier) channel — search is tier-blind by design (see
// tier-storefront.ts's own header comment), so these don't set a tier cookie.

test('search results link to a working PDP', async ({ page }) => {
	await page.goto('/search?q=dog');
	const result = page.locator('.kc-reference-product-card').first();
	await expect(result).toBeVisible();
	const name = (await result.locator('.kc-reference-product-card__name').innerText()).trim();
	await result.click();
	await expect(page.locator('h1')).toHaveText(name);
});

test('curated category "Load more" reveals additional products', async ({ page }) => {
	await page.goto('/category/dog-food');
	const countBefore = await page.locator('.kc-reference-product-card').count();
	const loadMore = page.getByRole('link', { name: /load more/i });
	test.skip((await loadMore.count()) === 0, 'dog-food category has no second page in this catalog snapshot');
	await loadMore.click();
	await page.waitForLoadState('networkidle');
	const countAfter = await page.locator('.kc-reference-product-card').count();
	expect(countAfter).toBeGreaterThan(countBefore);
});

test('PDP related-products rail links to another working PDP', async ({ page }) => {
	await page.goto('/product/openfarm-salmon-cod-topper-for-dogs');
	const related = page.locator('#kibble-pdp-related .kc-reference-product-card').first();
	test.skip((await related.count()) === 0, 'this product has no related-products zone in this catalog snapshot');
	const name = (await related.locator('.kc-reference-product-card__name').innerText()).trim();
	await related.click();
	await expect(page.locator('h1')).toHaveText(name);
});
