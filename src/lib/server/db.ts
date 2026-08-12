/**
 * Postgres client for server-side use.
 *
 * Cloudflare requests initialize this from the Hyperdrive binding in the
 * server hook. Local development and Node scripts use DATABASE_URL directly.
 */

import postgres, { type Sql } from 'postgres';
import { env } from '$env/dynamic/private';
import { requireDatabaseUrl } from './db-policy';

let _sql: Sql | null = null;
let configuredUrl: string | null = null;

export function initDb(connectionString: string | undefined): void {
	if (!connectionString || configuredUrl === connectionString) return;
	_sql = postgres(connectionString, { max: 5, idle_timeout: 60 });
	configuredUrl = connectionString;
}

export function getDb() {
	if (!_sql) {
		initDb(requireDatabaseUrl(env.DATABASE_URL)!);
	}
	return _sql!;
}
