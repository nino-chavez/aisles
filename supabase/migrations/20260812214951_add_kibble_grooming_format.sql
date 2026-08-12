-- The live Kibble catalog contains topical shampoos, coat sprays, and paw
-- balms. Without a grooming value, structured enrichment must misclassify
-- them as treats or supplements.

ALTER TABLE public.enriched_products
  DROP CONSTRAINT enriched_products_format_check,
  ADD CONSTRAINT enriched_products_format_check
    CHECK (format IN (
      'dry', 'wet', 'air-dried', 'freeze-dried', 'treat',
      'supplement', 'grooming', 'hardgood'
    )) NOT VALID;

ALTER TABLE public.enriched_products
  VALIDATE CONSTRAINT enriched_products_format_check;

-- Correct the three topical products observed in the 2026-08-12 catalog run.
UPDATE public.enriched_products
SET format = 'grooming', updated_at = NOW()
WHERE brand_id = 'kibble'
  AND bc_entity_id IN (3046, 3047, 3048);
