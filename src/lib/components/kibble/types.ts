import type { Product } from '$lib/types';

export type KibbleNavItem = {
	label: string;
	href: string;
};

export type KibbleChromeCopy = {
	skipLabel: string;
	catalogLabel: string;
	catalogEmptyLabel: string;
	searchLabel: string;
	searchPlaceholder: string;
	searchUnavailableLabel: string;
	accountLabel: string;
	savedPicksLabel: string;
	cartLabel: string;
	cartUnavailableLabel: string;
	browseAllLabel: string;
};

export type KibbleReferenceLinkTarget =
	| 'home'
	| 'catalog-category'
	| 'search-results'
	| 'account'
	| 'cart'
	| 'saved-picks'
	| 'product-detail'
	| 'featured-bundle'
	| 'browse-all'
	| 'visual-tile';

export type KibbleReferenceActionTarget =
	| 'open-mobile-navigation'
	| 'close-mobile-navigation'
	| 'open-search'
	| 'close-search'
	| 'open-cart-drawer'
	| 'open-picks-tray';

export type KibbleReferenceAdapter = {
	links: Partial<Record<KibbleReferenceLinkTarget, string>>;
	actions: Partial<Record<KibbleReferenceActionTarget, () => void>>;
};

export type KibbleStatusItem = {
	label: string;
};

export type KibbleAutoRefillState = 'active' | 'holdout' | 'maintenance';

export type KibbleCta = {
	label: string;
	href: string;
	primary?: boolean;
};

export type KibbleProofItem = {
	label: string;
	value: string;
};

export type KibbleFeaturedBundle = {
	name: string;
	href: string;
	image: string;
	imageAlt?: string;
	oneTimePrice: number;
	contents: Array<{ brand: string; role: string }>;
	eyebrow: string;
	ctaLabel: string;
};

export type KibbleAutoRefillOffer = {
	price: number;
	savingsPercent: number;
	label: string;
	savingsLabel: string;
	cadenceLabel?: string;
};

export type KibbleFeaturedCopy = {
	title: string;
	eyebrow: string;
	browseAllLabel: string;
};

export type KibbleVisualTile = {
	label: string;
	href: string;
	image: string;
	imageAlt?: string;
	description?: string;
};

export type KibbleServiceProofItem = {
	title: string;
	body: string;
};

export type KibbleProduct = Product;

export type KibbleProductOption = {
	entityId: number;
	displayName: string;
	isRequired: boolean;
	displayStyle: string | null;
	values: Array<{ entityId: number; label: string; isDefault: boolean }>;
};

export type KibblePdpProduct = KibbleProduct & {
	sku: string;
	categoryPath: string;
	currencyCode: string;
	isInStock: boolean | null;
	images: Array<{ url: string; alt: string }>;
	descriptionPlain: string;
};

export type KibblePdpBundle = {
	name: string;
	contents: Array<{ brand: string; title: string; role: string; image: string }>;
};

export type KibblePdpCopy = {
	breadcrumbLabel: string;
	galleryLabel: string;
	galleryImagesLabel: string;
	viewImageLabel: string;
	imageUnavailableLabel: string;
	priceLabel: string;
	skuLabel: string;
	inStockLabel: string;
	outOfStockLabel: string;
	availabilityUnavailableLabel: string;
	bundleEyebrow: string;
	bundleProductSingular: string;
	bundleProductPlural: string;
	bundleContentsHeading: string;
	optionsLegend: string;
	requiredSuffix: string;
	detailsHeading: string;
};

export type KibbleZoneAdapterBinding<TContent = unknown> = {
	instanceId: string;
	sharedStatus: 'live' | 'approval_candidate';
	sharedContentKind: 'content';
	adapterId: string;
	componentVariantId: string;
	inputSha256: string;
	content: TContent;
};
