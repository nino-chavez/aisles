type Query = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
type NoopSql = Query & {
	end: () => Promise<void>;
	begin: <T>(callback: (sql: NoopSql) => Promise<T>) => Promise<T>;
	json: (value: unknown) => unknown;
};

function createNoopSql(): NoopSql {
	const query = (async () => []) as NoopSql;
	query.end = async () => {};
	query.begin = async <T>(callback: (sql: NoopSql) => Promise<T>) => callback(query);
	query.json = (value: unknown) => value;
	return query;
}

/** Runner-only replacement for postgres.js; no socket can be opened. */
export default function postgres(): ReturnType<typeof createNoopSql> {
	return createNoopSql();
}
