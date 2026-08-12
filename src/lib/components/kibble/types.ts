import type { Product } from '$lib/types';

export type KibbleNavItem = {
	label: string;
	href: string;
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
	subscribePrice: number;
	oneTimePrice: number;
	savingsPercent: number;
	contents: Array<{ brand: string; role: string }>;
};

export type KibbleAutoRefillOffer = {
	price: number;
	savingsPercent: number;
	cadenceLabel?: string;
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
