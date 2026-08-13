type Query = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

function createNoopSql(): Query & {
	end: () => Promise<void>;
	begin: <T>(callback: (sql: Query) => Promise<T>) => Promise<T>;
} {
	const query = (async () => []) as Query & {
		end: () => Promise<void>;
		begin: <T>(callback: (sql: Query) => Promise<T>) => Promise<T>;
	};
	query.end = async () => {};
	query.begin = async <T>(callback: (sql: Query) => Promise<T>) => callback(query);
	return query;
}

/** Runner-only replacement for postgres.js; no socket can be opened. */
export default function postgres(): ReturnType<typeof createNoopSql> {
	return createNoopSql();
}
