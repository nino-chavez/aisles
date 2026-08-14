import { env } from '$env/dynamic/private';
import type { KibbleCart } from './kibble-commerce';

const CART_TTL_SECONDS = 60 * 60 * 24;

type CartEntry = {
	cart: KibbleCart;
	sessionCookie: string | null;
};

const memoryFallback = new Map<string, CartEntry>();
let redis: import('@upstash/redis').Redis | null = null;
let redisInitialized = false;

function cartKey(cartEntityId: string): string {
	return `aisles:kibble-cart:${cartEntityId}`;
}

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
	if (redisInitialized) return redis;
	redisInitialized = true;
	if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) return null;
	try {
		const { Redis } = await import('@upstash/redis');
		redis = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
		return redis;
	} catch (error) {
		console.warn('[kibble-cart-store] Redis initialization failed:', error instanceof Error ? error.message : error);
		return null;
	}
}

export async function cacheKibbleCart(cart: KibbleCart, sessionCookie: string | null): Promise<void> {
	const entry: CartEntry = { cart, sessionCookie };
	const store = await getRedis();
	if (store) {
		try {
			await store.set(cartKey(cart.entityId), JSON.stringify(entry), { ex: CART_TTL_SECONDS });
			return;
		} catch (error) {
			console.warn('[kibble-cart-store] Redis write failed; using memory fallback:', error instanceof Error ? error.message : error);
		}
	}
	memoryFallback.set(cart.entityId, entry);
}

export async function getCachedKibbleCart(cartEntityId: string): Promise<CartEntry | null> {
	const store = await getRedis();
	if (store) {
		try {
			const raw = await store.get<string | CartEntry>(cartKey(cartEntityId));
			if (raw) return typeof raw === 'string' ? JSON.parse(raw) as CartEntry : raw;
			return null;
		} catch (error) {
			console.warn('[kibble-cart-store] Redis read failed; using memory fallback:', error instanceof Error ? error.message : error);
		}
	}
	return memoryFallback.get(cartEntityId) ?? null;
}

export async function getKibbleCartSessionCookie(cartEntityId: string): Promise<string | null> {
	return (await getCachedKibbleCart(cartEntityId))?.sessionCookie ?? null;
}

export async function evictKibbleCart(cartEntityId: string): Promise<void> {
	const store = await getRedis();
	if (store) {
		try { await store.del(cartKey(cartEntityId)); } catch (error) {
			console.warn('[kibble-cart-store] Redis delete failed:', error instanceof Error ? error.message : error);
		}
	}
	memoryFallback.delete(cartEntityId);
}

/** Test-only cleanup for the local fallback. No production caller should use this. */
export function resetKibbleCartStoreForTest(): void {
	memoryFallback.clear();
	redis = null;
	redisInitialized = false;
}

