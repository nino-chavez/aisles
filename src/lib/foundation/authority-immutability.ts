/** Deeply freezes a server-owned authority graph while preserving its exact type. */
export function freezeAuthorityGraph<T extends object>(value: T): T {
	const seen = new WeakSet<object>();
	const visit = (candidate: object): void => {
		if (seen.has(candidate)) return;
		seen.add(candidate);
		for (const key of Reflect.ownKeys(candidate)) {
			const nested = Reflect.get(candidate, key);
			if (nested !== null && typeof nested === 'object') visit(nested);
		}
		Object.freeze(candidate);
	};
	visit(value);
	return value;
}
