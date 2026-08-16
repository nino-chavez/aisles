import type { Sql } from 'postgres';

declare global {
	namespace App {
		interface Locals {
			database?: Sql;
		}

		interface Platform {
			env?: {
				HYPERDRIVE?: Hyperdrive;
				OBSERVE_ACCESS_TOKEN?: string;
				SUBS_API?: Fetcher;
			};
		}
	}
}

export {};
