import type { Handle } from '@sveltejs/kit';
import { initDb } from '$lib/server/db';

/** Use Hyperdrive in Cloudflare; local development falls back to DATABASE_URL. */
export const handle: Handle = async ({ event, resolve }) => {
	initDb(event.platform?.env?.HYPERDRIVE?.connectionString);
	return resolve(event);
};
