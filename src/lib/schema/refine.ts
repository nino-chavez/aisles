import { z } from 'zod';
import { LayoutSchema } from './layout';

/**
 * Refine Response Schema — layout + conversational response for negotiation.
 */
export const RefineResponseSchema = z.object({
	layout: LayoutSchema,
	chatResponse: z.string().describe('1-2 sentence response to the shopper. Acknowledge changes. Explain conflicts.'),
	constraintApplied: z.string().describe('Short filter label, e.g. "under $500", "wireless only"'),
	constraintConflict: z.boolean().describe('True if constraints conflict or eliminate all products'),
});

export type RefineResponse = z.infer<typeof RefineResponseSchema>;
