# Kibble local showcase

Start the local showcase:

```bash
npm run dev:kibble-showcase
```

Synthetic demo enrichment — not merchant data. The launcher prints the same links and uses port `5174` by default:

```text
http://127.0.0.1:5174/?dev=true&intent=gatherer
http://127.0.0.1:5174/?dev=true&intent=hunter
http://127.0.0.1:5174/?dev=true&intent=researcher
http://127.0.0.1:5174/?dev=true&intent=gifter
```

Set `KIBBLE_SHOWCASE_PORT` to another non-privileged port if `5174` is occupied. The launcher accepts only `localhost`, `127.0.0.1`, or `::1` for `KIBBLE_SHOWCASE_HOST`.
Every local response also carries a URL-encoded `x-kibble-showcase-enrichment-source` header. Its decoded value is `Synthetic demo enrichment — not merchant data`.

## Evidence boundary

Real in this local process:

- signal extraction and the explicit `intent` inference rule;
- policy evaluation and the existing decision renderer; and
- the production enrichment query interface, supplied by a runner-only provider.

Synthetic demo enrichment — not merchant data:

- the pinned catalog fixture; and
- persona-fit scores, which are fixed demo values for every fixture product.

Absent from this launcher:

- model calls;
- database writes or database connections;
- paid enrichment APIs; and
- commerce actions.

The fixture interceptor, no-op Postgres replacement, and enrichment alias are selected only by `scripts/kibble-showcase-vite.config.ts`. Normal `npm run dev`, `npm run build`, `npm run preview`, and Wrangler do not use them.

The current fixed Kibble Home does not render an enrichment data-source label because its Preserve renderer does not request ranking data. The local runner and response header label the source now. The parallel backend/UI integration can read `KIBBLE_SHOWCASE_DATA_SOURCE` only in this local process and surface the same label beside its ranked result.

Stop the process with `Ctrl-C`.
