/**
 * Neon Postgres client for server-side use.
 *
 * Uses the Neon serverless driver which works over HTTP —
 * no persistent TCP connections needed on Vercel Functions.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb() {
	if (!_sql) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL not configured');
		_sql = neon(env.DATABASE_URL);
	}
	return _sql;
}
