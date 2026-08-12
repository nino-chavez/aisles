-- The UNIQUE (brand_id, bc_entity_id) constraint already owns an equivalent
-- B-tree index. Keeping a second one doubles index maintenance on every write.
DROP INDEX IF EXISTS public.enriched_products_brand_entity_idx;
