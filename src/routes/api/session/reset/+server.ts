import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/session/reset
 * Clears the aisles_session cookie plus the persona/category/visit cross-session
 * cookies so the next request issues a completely fresh session. Used for demos
 * when you need to return to a baseline gatherer state without opening an
 * incognito window.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	for (const name of ['aisles_session', 'aisles_persona', 'aisles_last_category', 'aisles_visits']) {
		cookies.delete(name, { path: '/' });
	}
	return json({ ok: true });
};

export const GET = POST;
