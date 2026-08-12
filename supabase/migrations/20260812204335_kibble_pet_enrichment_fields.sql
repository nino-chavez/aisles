-- Kibble catalog evidence (2026-08-12): products span $9-$240 and include
-- chicken recipes plus air-dried food. The vocabulary therefore follows the
-- actual catalog rather than the initial furniture-derived plan.
-- Price tiers are assigned by application code using these Kibble bands:
-- budget < $20; mid $20-$49.99; premium $50-$99.99; luxury >= $100.

ALTER TABLE public.enriched_products
  ADD COLUMN protein TEXT NOT NULL DEFAULT 'none'
    CHECK (protein IN ('beef', 'chicken', 'salmon', 'turkey', 'plant', 'mixed', 'none')),
  ADD COLUMN life_stage TEXT NOT NULL DEFAULT 'all'
    CHECK (life_stage IN ('puppy', 'adult', 'senior', 'all')),
  ADD COLUMN format TEXT NOT NULL DEFAULT 'hardgood'
    CHECK (format IN ('dry', 'wet', 'air-dried', 'freeze-dried', 'treat', 'supplement', 'hardgood')),
  ADD COLUMN dietary TEXT NOT NULL DEFAULT 'none'
    CHECK (dietary IN ('grain-free', 'limited-ingredient', 'prescription', 'none')),
  ADD COLUMN pet_size TEXT NOT NULL DEFAULT 'any'
    CHECK (pet_size IN ('toy', 'small', 'medium', 'large', 'any')),
  ADD COLUMN replenishment_days INTEGER
    CHECK (replenishment_days IS NULL OR replenishment_days BETWEEN 1 AND 365),
  ADD COLUMN subscription_fit REAL NOT NULL DEFAULT 0.5
    CHECK (subscription_fit >= 0 AND subscription_fit <= 1);

ALTER TABLE public.enriched_products
  DROP COLUMN material,
  DROP COLUMN style,
  DROP COLUMN use_case,
  DROP COLUMN dimensions;
