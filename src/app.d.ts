declare global {
	namespace App {
		interface Platform {
			env?: {
				HYPERDRIVE?: Hyperdrive;
			};
		}
	}
}

export {};
