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
- policy evaluation, deterministic product ranking, and the Preserve renderer;
- the six-zone decision trace shown by the development inspector; and
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

The launcher blanks the app's production database, Redis, model, incentive, and Observe credentials before it starts Vite. It stamps the run with scenario ID `kibble-local-showcase`, so contracted provenance reports the catalog and scores as synthetic. The inspector and response header both display `Synthetic demo enrichment — not merchant data`.

The inspector requires `?dev=true` on the current request. A previously stored site-wide dev cookie cannot reopen it. Shopper page data never includes persona-fit scores, and production builds omit the inspector code.

Changing the intent link reloads the route and recomputes the product shelf. Client-side signals may update the probability display between reloads, but the rendered shelf remains the last server decision until the next route load. Preserve mode makes no model call.

Stop the process with `Ctrl-C`.
