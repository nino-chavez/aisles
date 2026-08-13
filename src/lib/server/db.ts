/**
 * Postgres client for server-side use.
 *
 * Cloudflare requests get a fresh Hyperdrive client per request. Local
 * development uses one process-local client from DATABASE_URL.
 */

import postgres, { type Sql } from 'postgres';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { requireDatabaseUrl } from './db-policy';

let localSql: Sql | null = null;

export function createDb(connectionString: string): Sql {
	return postgres(connectionString, { max: 5, idle_timeout: 60 });
}

/** Keep one client inside a request, never across Cloudflare invocations. */
export function getRequestDb<T>(
	locals: { database?: T },
	connectionString: string,
	create: (url: string) => T,
): T {
	if (!locals.database) {
		locals.database = create(connectionString);
	}
	return locals.database;
}

function getLocalDb(): Sql {
	if (!localSql) localSql = createDb(requireDatabaseUrl(env.DATABASE_URL)!);
	return localSql;
}

export function getDb(): Sql {
	const event = getRequestEvent();
	const hyperdriveUrl = event.platform?.env?.HYPERDRIVE?.connectionString;
	return hyperdriveUrl
		? getRequestDb(event.locals, hyperdriveUrl, createDb)
		: getLocalDb();
}
