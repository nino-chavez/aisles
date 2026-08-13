import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import {
	KIBBLE_PARITY_METADATA,
	STRUCTURAL_METRIC_KEYS,
	assessPixelDifference,
	compareParityMetadata,
	compareStructuralMetrics,
	readKibbleParityConfig,
	type ParityMask,
	type ParityMetadata,
	type StructuralMetrics,
} from '../src/lib/brand/reference/kibble-parity';

type PageCapture = {
	metadata: Partial<ParityMetadata>;
	metrics: StructuralMetrics;
	screenshot: Buffer;
};

type PixelComparison = {
	differenceRatio: number | null;
	changedPixels: number;
	comparablePixels: number;
	dimensions: { reference: { width: number; height: number }; candidate: { width: number; height: number } };
	diffPngBase64: string | null;
};

const viewports = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'desktop', width: 1280, height: 900 },
] as const;

function dataUrl(buffer: Buffer): string {
	return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function preparePage(page: Page): Promise<void> {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addStyleTag({
		content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;}',
	});
}

async function capture(page: Page, url: string): Promise<PageCapture> {
	await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
	await preparePage(page);
	const [metadata, metrics, screenshot] = await Promise.all([
		page.evaluate(`(() => {
			const attributes = ${JSON.stringify(KIBBLE_PARITY_METADATA)};
			const marker = document.querySelector('[' + attributes.contractId + ']');
			return {
				contractId: marker?.getAttribute(attributes.contractId) ?? undefined,
				contractVersion: marker?.getAttribute(attributes.contractVersion) ?? undefined,
				fixedDataIdentity: marker?.getAttribute(attributes.fixedDataIdentity) ?? undefined,
			};
		})()`),
		page.evaluate(`(() => {
			return {
				header: document.querySelectorAll('header').length,
				nav: document.querySelectorAll('nav').length,
				main: document.querySelectorAll('main').length,
				footer: document.querySelectorAll('footer').length,
				h1: document.querySelectorAll('h1').length,
				h2: document.querySelectorAll('h2').length,
				h3: document.querySelectorAll('h3').length,
				section: document.querySelectorAll('section').length,
				image: document.querySelectorAll('img').length,
				link: document.querySelectorAll('a[href]').length,
				button: document.querySelectorAll('button').length,
				pageHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
			};
		})()`),
		page.screenshot({ fullPage: true, animations: 'disabled' }),
	]);
	return { metadata, metrics, screenshot };
}

async function comparePixels(page: Page, reference: Buffer, candidate: Buffer, masks: ParityMask[]): Promise<PixelComparison> {
	const payload = JSON.stringify({ referenceUrl: dataUrl(reference), candidateUrl: dataUrl(candidate), masks });
	return page.evaluate(`(async () => {
		const { referenceUrl, candidateUrl, masks } = ${payload};
		const decode = function (url) {
			return new Promise(function (resolveImage, rejectImage) {
			const image = new Image();
			image.onload = function () { resolveImage(image); };
			image.onerror = function () { rejectImage(new Error('Unable to decode screenshot')); };
			image.src = url;
			});
		};
		const [referenceImage, candidateImage] = await Promise.all([decode(referenceUrl), decode(candidateUrl)]);
		const dimensions = {
			reference: { width: referenceImage.width, height: referenceImage.height },
			candidate: { width: candidateImage.width, height: candidateImage.height },
		};
		if (referenceImage.width !== candidateImage.width || referenceImage.height !== candidateImage.height) {
			return { differenceRatio: null, changedPixels: 0, comparablePixels: 0, dimensions, diffPngBase64: null };
		}

		const canvas = document.createElement('canvas');
		canvas.width = referenceImage.width;
		canvas.height = referenceImage.height;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) throw new Error('Canvas context unavailable for screenshot comparison');
		context.drawImage(referenceImage, 0, 0);
		const referencePixels = context.getImageData(0, 0, canvas.width, canvas.height);
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(candidateImage, 0, 0);
		const candidatePixels = context.getImageData(0, 0, canvas.width, canvas.height);
		const diffPixels = context.createImageData(canvas.width, canvas.height);
		let changedPixels = 0;
		let comparablePixels = 0;

		for (let y = 0; y < canvas.height; y += 1) {
			for (let x = 0; x < canvas.width; x += 1) {
				const offset = (y * canvas.width + x) * 4;
				const masked = masks.some(function (mask) { return x >= mask.x && y >= mask.y && x < mask.x + mask.width && y < mask.y + mask.height; });
				if (masked) {
					diffPixels.data[offset + 3] = 0;
					continue;
				}
				comparablePixels += 1;
				const difference =
					Math.abs(referencePixels.data[offset] - candidatePixels.data[offset]) +
					Math.abs(referencePixels.data[offset + 1] - candidatePixels.data[offset + 1]) +
					Math.abs(referencePixels.data[offset + 2] - candidatePixels.data[offset + 2]) +
					Math.abs(referencePixels.data[offset + 3] - candidatePixels.data[offset + 3]);
				if (difference > 32) {
					changedPixels += 1;
					diffPixels.data[offset] = 239;
					diffPixels.data[offset + 1] = 122;
					diffPixels.data[offset + 2] = 82;
					diffPixels.data[offset + 3] = 220;
				}
			}
		}

		context.putImageData(diffPixels, 0, 0);
		return {
			differenceRatio: comparablePixels === 0 ? null : changedPixels / comparablePixels,
			changedPixels,
			comparablePixels,
			dimensions,
			diffPngBase64: canvas.toDataURL('image/png').split(',')[1] ?? null,
		};
	})()`);
}

async function main(): Promise<void> {
	const config = readKibbleParityConfig(process.env);
	const outputDirectory = resolve(config.outputDirectory, new Date().toISOString().replaceAll(':', '-'));
	await mkdir(outputDirectory, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const results: Array<Record<string, unknown>> = [];
	let hasFailures = false;

	try {
		for (const viewport of viewports) {
			const referencePage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
			const candidatePage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
			const comparisonPage = await browser.newPage();
			try {
				const [reference, candidate] = await Promise.all([
					capture(referencePage, config.referenceUrl),
					capture(candidatePage, config.candidateUrl),
				]);
				await Promise.all([
					writeFile(join(outputDirectory, `${viewport.name}.reference.png`), reference.screenshot),
					writeFile(join(outputDirectory, `${viewport.name}.candidate.png`), candidate.screenshot),
				]);

				const pixels = await comparePixels(comparisonPage, reference.screenshot, candidate.screenshot, config.masks);
				if (pixels.diffPngBase64) await writeFile(join(outputDirectory, `${viewport.name}.diff.png`), Buffer.from(pixels.diffPngBase64, 'base64'));

				const problems = [
					...compareParityMetadata(config.expected, reference.metadata, 'reference'),
					...compareParityMetadata(config.expected, candidate.metadata, 'candidate'),
					...compareStructuralMetrics(reference.metrics, candidate.metrics, config.structuralTolerances),
					...assessPixelDifference(pixels.differenceRatio, config.maxPixelDifferenceRatio),
				];
				hasFailures ||= problems.length > 0;
				results.push({ viewport, reference: { metadata: reference.metadata, metrics: reference.metrics }, candidate: { metadata: candidate.metadata, metrics: candidate.metrics }, pixels, problems });
			} finally {
				await Promise.all([referencePage.close(), candidatePage.close(), comparisonPage.close()]);
			}
		}
	} finally {
		await browser.close();
	}

	const report = {
		status: hasFailures ? 'failed' : 'passed',
		generatedAt: new Date().toISOString(),
		referenceUrl: config.referenceUrl,
		candidateUrl: config.candidateUrl,
		expected: config.expected,
		masks: config.masks,
		maxPixelDifferenceRatio: config.maxPixelDifferenceRatio,
		structuralTolerances: config.structuralTolerances,
		viewports: results,
	};
	await writeFile(join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Kibble visual parity ${report.status}. Evidence: ${outputDirectory}`);
	if (hasFailures) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
