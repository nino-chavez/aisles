import { describe, expect, it } from 'vitest';
import { scorePetCompatibility } from './pet-compatibility';

const adultChicken = {
	protein: 'chicken' as const,
	lifeStage: 'adult' as const,
	format: 'dry' as const,
	dietary: 'grain-free' as const,
	petSize: 'medium' as const,
	replenishmentDays: 30,
	subscriptionFit: 0.9,
};

describe('pet compatibility scoring', () => {
	it('prefers a product for the picked pet profile over an unrelated product', () => {
		const samePet = scorePetCompatibility({
			compatibleWith: ['chicken', 'adult', 'grain-free', 'daily feeding'],
			petProfile: { ...adultChicken, format: 'wet' },
		}, [adultChicken]);
		const unrelated = scorePetCompatibility({
			compatibleWith: ['puppy', 'salmon'],
			petProfile: { ...adultChicken, protein: 'salmon', lifeStage: 'puppy', dietary: 'none', petSize: 'toy' },
		}, [adultChicken]);

		expect(samePet).toBeGreaterThan(unrelated);
	});

	it('does not treat generic values as profile matches', () => {
		const generic = scorePetCompatibility({
			compatibleWith: [],
			petProfile: { ...adultChicken, protein: 'none', lifeStage: 'all', dietary: 'none', petSize: 'any' },
		}, [adultChicken]);
		expect(generic).toBe(0);
	});
});
