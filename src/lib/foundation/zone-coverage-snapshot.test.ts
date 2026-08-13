import { describe, expect, it } from 'vitest';
import { BEALLS_ZONE_SNAPSHOT } from './zone-coverage-snapshot';

describe('Bealls zone coverage snapshot authority', () => {
	it('cannot be mutated before or after exact identities are issued', async () => {
		const hero = BEALLS_ZONE_SNAPSHOT.zones.find(({ zoneId }) => zoneId === 'home.hero');
		const featured = BEALLS_ZONE_SNAPSHOT.zones.find(({ zoneId }) => zoneId === 'home.featured-row');
		const route = BEALLS_ZONE_SNAPSHOT.routeSurfaces.find(({ routePath }) => routePath === '/');
		const sourceFile = BEALLS_ZONE_SNAPSHOT.source.files[0];
		if (!hero || !featured || !route || !sourceFile) throw new Error('Bealls snapshot authority fixture is incomplete');

		expect(Object.isFrozen(BEALLS_ZONE_SNAPSHOT)).toBe(true);
		expect(Object.isFrozen(BEALLS_ZONE_SNAPSHOT.source)).toBe(true);
		expect(Object.isFrozen(BEALLS_ZONE_SNAPSHOT.source.files)).toBe(true);
		expect(BEALLS_ZONE_SNAPSHOT.source.files.every(Object.isFrozen)).toBe(true);
		expect(Object.isFrozen(BEALLS_ZONE_SNAPSHOT.zones)).toBe(true);
		expect(BEALLS_ZONE_SNAPSHOT.zones.every(Object.isFrozen)).toBe(true);
		expect(BEALLS_ZONE_SNAPSHOT.zones.every(({ implementation, fallbackByBrand }) =>
			Object.isFrozen(implementation) && Object.isFrozen(fallbackByBrand))).toBe(true);
		expect(Object.isFrozen(BEALLS_ZONE_SNAPSHOT.routeSurfaces)).toBe(true);
		expect(BEALLS_ZONE_SNAPSHOT.routeSurfaces.every(({ policySurfaceByBrand }, index) =>
			Object.isFrozen(BEALLS_ZONE_SNAPSHOT.routeSurfaces[index]) && Object.isFrozen(policySurfaceByBrand))).toBe(true);

		// These writes run before the identity module is loaded in this test.
		expect(Reflect.set(BEALLS_ZONE_SNAPSHOT, 'manifestVersion', 2)).toBe(false);
		expect(Reflect.set(BEALLS_ZONE_SNAPSHOT.source, 'ref', 'forged')).toBe(false);
		expect(Reflect.set(BEALLS_ZONE_SNAPSHOT.source.files, '0', { path: 'forged', sha256: 'forged' })).toBe(false);
		expect(Reflect.set(sourceFile, 'sha256', 'forged')).toBe(false);
		expect(Reflect.set(BEALLS_ZONE_SNAPSHOT.zones, '0', { ...hero, surface: 'locator' })).toBe(false);
		expect(Reflect.set(hero, 'surface', 'locator')).toBe(false);
		expect(Reflect.set(featured, 'maxIndex', 1)).toBe(false);
		expect(Reflect.set(hero.implementation, 'routeRendered', false)).toBe(false);
		expect(Reflect.set(hero.fallbackByBrand, 'bealls', 'hidden')).toBe(false);
		expect(Reflect.set(route, 'zoneSurfaceId', 'locator')).toBe(false);
		expect(Reflect.set(route.policySurfaceByBrand, 'bealls', 'locator')).toBe(false);

		const { findTrustedZoneIdentity, TRUSTED_ZONE_IDENTITIES } = await import('./trusted-zone-identity');
		const heroIdentity = findTrustedZoneIdentity('bealls-aisles', 'home.hero', 'home.hero');
		const lastFeaturedIdentity = findTrustedZoneIdentity('bealls-aisles', 'home.featured-row', 'home.featured-row.6');
		expect(hero).toMatchObject({ surface: 'home', implementation: { routeRendered: true }, fallbackByBrand: { bealls: 'content' } });
		expect(featured.maxIndex).toBe(6);
		expect(route).toMatchObject({ zoneSurfaceId: 'home', policySurfaceByBrand: { bealls: 'home' } });
		expect(TRUSTED_ZONE_IDENTITIES.filter(({ origin }) => origin === 'bealls-aisles')).toHaveLength(36);
		expect(heroIdentity).toMatchObject({ surface: 'home', rendererContract: 'trusted-hidden' });
		expect(lastFeaturedIdentity).toMatchObject({ familyId: 'home.featured-row', instanceId: 'home.featured-row.6', surface: 'home' });

		expect(Reflect.set(hero, 'surface', 'locator')).toBe(false);
		expect(Reflect.set(heroIdentity!, 'surface', 'locator')).toBe(false);
		expect(hero.surface).toBe('home');
		expect(heroIdentity?.surface).toBe('home');
	});
});
