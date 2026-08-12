import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getRequestDb } from './db';
import { requireDatabaseUrl } from './db-policy';

const migration = readFileSync(
	resolve(import.meta.dirname, '../../../supabase/migrations/20260812200405_create_brand_scoped_aisles_schema.sql'),
	'utf8',
);
const indexCleanupMigration = readFileSync(
	resolve(import.meta.dirname, '../../../supabase/migrations/20260812203119_drop_redundant_brand_entity_index.sql'),
	'utf8',
);
const runtimeRoleMigration = readFileSync(
	resolve(import.meta.dirname, '../../../supabase/migrations/20260812203231_create_aisles_app_role.sql'),
	'utf8',
);
const publicPrivilegeMigration = readFileSync(
	resolve(import.meta.dirname, '../../../supabase/migrations/20260812203830_revoke_public_aisles_privileges.sql'),
	'utf8',
);
const schemaCreateMigration = readFileSync(
	resolve(import.meta.dirname, '../../../supabase/migrations/20260812203938_revoke_public_schema_create.sql'),
	'utf8',
);
const wrangler = readFileSync(resolve(import.meta.dirname, '../../../wrangler.toml'), 'utf8');
const syntheticMigration = readFileSync(resolve(import.meta.dirname, '../../../supabase/migrations/20260812210415_add_synthetic_scenario_provenance.sql'), 'utf8');

describe('database foundation', () => {
	it('fails required paths when DATABASE_URL is absent', () => {
		expect(() => requireDatabaseUrl(undefined)).toThrow('DATABASE_URL not configured');
	});

	it('allows the explicit optional storefront fallback', () => {
		expect(requireDatabaseUrl(undefined, 'optional')).toBeNull();
		expect(requireDatabaseUrl('postgresql://example')).toBe('postgresql://example');
	});

	it('does not reuse a client across request contexts', () => {
		let created = 0;
		const create = (connectionString: string) => ({ connectionString, id: ++created });
		const firstRequest = {};
		const secondRequest = {};

		expect(getRequestDb(firstRequest, 'postgresql://hyperdrive', create)).toBe(
			getRequestDb(firstRequest, 'postgresql://hyperdrive', create),
		);
		expect(getRequestDb(secondRequest, 'postgresql://hyperdrive', create)).not.toBe(
			getRequestDb(firstRequest, 'postgresql://hyperdrive', create),
		);
		expect(created).toBe(2);
	});

	it('enables Node compatibility and binds Hyperdrive in Pages', () => {
		expect(wrangler).toContain('compatibility_flags = ["nodejs_compat"]');
		expect(wrangler).toContain('binding = "HYPERDRIVE"');
		expect(wrangler).toContain('id = "7ad29b1caf5845d48f93b59fa15fc83b"');
	});

	it('scopes product and session identities by brand', () => {
		expect(migration).toContain('UNIQUE (brand_id, bc_entity_id)');
		expect(migration).toContain('UNIQUE (brand_id, session_id)');
		expect(indexCleanupMigration).toContain('DROP INDEX IF EXISTS public.enriched_products_brand_entity_idx');
	});

	it('enables RLS without public grants or policies', () => {
		for (const table of ['enriched_products', 'generation_logs', 'session_outcomes', 'merchandising_rules']) {
			expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
		}
		expect(migration).not.toContain('CREATE POLICY');
		expect(migration).not.toContain('GRANT ');
		expect(runtimeRoleMigration).toContain('NOBYPASSRLS');
		expect(runtimeRoleMigration).toContain('TO aisles_app');
		expect(runtimeRoleMigration).not.toMatch(/TO (anon|authenticated)\b/);
		expect(runtimeRoleMigration).not.toMatch(/GRANT ALL\b/);
		expect(publicPrivilegeMigration).toContain('FROM PUBLIC, anon, authenticated');
		expect(publicPrivilegeMigration).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE postgres');
		expect(schemaCreateMigration).toContain('REVOKE CREATE ON SCHEMA public FROM PUBLIC, aisles_app');
	});

	it('adds synthetic scenario provenance without speculative indexes', () => {
		expect(syntheticMigration).toContain('ADD COLUMN synthetic BOOLEAN NOT NULL DEFAULT FALSE');
		expect(syntheticMigration).toContain('ADD COLUMN scenario_id TEXT');
		expect(syntheticMigration).toContain('CHECK ((synthetic AND scenario_id IS NOT NULL) OR (NOT synthetic AND scenario_id IS NULL))');
		expect(syntheticMigration).toContain('generation_logs_synthetic_scenario_provenance');
		expect(syntheticMigration).toContain('session_outcomes_synthetic_scenario_provenance');
		expect(syntheticMigration).not.toContain('CREATE INDEX');
	});
});
