/**
 * Consideration tray ("Picks") — persistent client-side store.
 *
 * Holds products the shopper is considering for comparison, bundling,
 * or context-aware browsing. Persisted to localStorage so it survives
 * page reloads. Accessible from any component via import.
 *
 * Svelte 5 runes module — reactive state via $state.
 */

export interface PickItem {
	id: string;
	entityId: number;
	name: string;
	price: number;
	salePrice?: number;
	image: string;
	category: string;
	specs: Record<string, string>;
	addedAt: number;
}

const STORAGE_KEY = 'aisles_picks';
const MAX_PICKS = 8;

// ─── State ────────────────────────────────────────────────────

let items = $state<PickItem[]>([]);
let initialized = false;

function loadFromStorage() {
	if (initialized || typeof window === 'undefined') return;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			items = JSON.parse(stored);
		}
	} catch { /* ignore corrupt data */ }
	initialized = true;
}

function saveToStorage() {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch { /* storage full or blocked */ }
}

// ─── Public API ───────────────────────────────────────────────

export function getPickItems(): PickItem[] {
	loadFromStorage();
	return items;
}

export function pickCount(): number {
	loadFromStorage();
	return items.length;
}

export function totalPrice(): number {
	loadFromStorage();
	return items.reduce((sum, item) => sum + (item.salePrice ?? item.price), 0);
}

export function isPicked(productId: string): boolean {
	loadFromStorage();
	return items.some((item) => item.id === productId);
}

export function addPick(product: {
	id: string;
	entityId: number;
	name: string;
	price: number;
	salePrice?: number;
	image: string;
	category: string;
	specs: Record<string, string>;
}) {
	loadFromStorage();
	if (items.some((item) => item.id === product.id)) return; // already picked
	if (items.length >= MAX_PICKS) return; // tray full

	items = [...items, {
		...product,
		addedAt: Date.now(),
	}];
	saveToStorage();

	// Dispatch event so other components can react
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('picks-updated', { detail: { count: items.length } }));
	}
}

export function removePick(productId: string) {
	loadFromStorage();
	items = items.filter((item) => item.id !== productId);
	saveToStorage();

	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('picks-updated', { detail: { count: items.length } }));
	}
}

export function clearPicks() {
	items = [];
	saveToStorage();

	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('picks-updated', { detail: { count: 0 } }));
	}
}

/** Get picks as context string for AI prompts */
export function picksContextForPrompt(): string {
	loadFromStorage();
	if (items.length === 0) return '';

	const lines = items.map((item) => {
		const price = item.salePrice ? `$${item.salePrice} (sale)` : `$${item.price}`;
		const topSpecs = Object.entries(item.specs).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ');
		return `- ${item.name} | ${price} | ${item.category} | ${topSpecs}`;
	});

	return `\nSHOPPER'S CONSIDERATION SET (${items.length} items, $${totalPrice().toLocaleString()} total):\n${lines.join('\n')}\nThe shopper is actively considering these items. Prioritize compatible products (matching style, material, price tier). If showing accessories, suggest ones that physically fit or complement these specific picks.\n`;
}
