import type { PetProfile } from './enrichment/types';

export interface PetCompatibilityCandidate {
	compatibleWith: string[];
	petProfile: PetProfile | null;
}

/** Score whether a catalog product fits the same pet or feeding routine. */
export function scorePetCompatibility(
	candidate: PetCompatibilityCandidate,
	pickedProfiles: Array<PetProfile | null>,
): number {
	let score = 0;
	const candidateKeywords = new Set(candidate.compatibleWith.map((value) => value.toLowerCase()));

	for (const picked of pickedProfiles) {
		if (!picked) continue;
		if (candidate.petProfile) {
			score += sameSpecificValue(candidate.petProfile.lifeStage, picked.lifeStage, 'all') ? 2 : 0;
			score += sameSpecificValue(candidate.petProfile.dietary, picked.dietary, 'none') ? 2 : 0;
			score += sameSpecificValue(candidate.petProfile.petSize, picked.petSize, 'any') ? 1 : 0;
			score += sameSpecificValue(candidate.petProfile.protein, picked.protein, 'none') ? 1 : 0;
		}

		for (const keyword of [picked.protein, picked.lifeStage, picked.dietary, picked.petSize]) {
			if (!['none', 'all', 'any'].includes(keyword) && candidateKeywords.has(keyword)) score++;
		}
	}

	return score;
}

function sameSpecificValue(left: string, right: string, neutral: string): boolean {
	return left === right && left !== neutral;
}
