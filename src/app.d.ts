import type { Sql } from 'postgres';

declare global {
	namespace App {
		interface Locals {
			database?: Sql;
		}

		interface Platform {
			env?: {
				HYPERDRIVE?: Hyperdrive;
			};
		}
	}
}

export {};
