# cloudflare-d1-visit-counter

[中文说明](README.md) | English

**cloudflare-d1-visit-counter** is an open-source, self-hosted, low-cost **Cloudflare Workers + Cloudflare D1 visitor counter** with SVG badges, GitHub README badges, a badge generator dashboard, public status pages, and history charts.

Keywords: `Cloudflare Workers visitor counter`, `Cloudflare D1 visit counter`, `GitHub README visitor badge`, `self-hosted visitor badge`, `SVG hit counter`, `website visit counter`, `open source badge generator`.

Repository: [FuTseYi/cloudflare-d1-visit-counter](https://github.com/FuTseYi/cloudflare-d1-visit-counter)  
Author: [FuTseYi](https://github.com/FuTseYi)

## Quick Links

- [Quick Start](#quick-start)
- [API](#api)
- [Security and Privacy](#security-and-privacy)
- [License](#license)

## Highlights

- Single-file Cloudflare Worker.
- D1-backed total and daily visit counters.
- Built-in generator for Markdown, linked Markdown, HTML, image URL, and status URL.
- Auth-protected create, list, and delete APIs.
- Public SVG badge endpoint for existing counters only.
- Public status page with today, total, and 30-day trend.
- Hex colors, Shields-style named colors, and multiple badge styles.
- Counter keys can be URLs, repository paths, page names, or Chinese text.
- No public auto-create behavior, which helps reduce abuse and D1 waste.

## Why This Project

Most visitor badge projects solve only one part of the problem: showing a number. This project is designed as a complete self-hosted product: badge generation, protected management, saved styles, public status pages, and a low-cost D1 data model are built in from the start.

| Feature | This project | Common badge counters |
| --- | --- | --- |
| Self-hosted | Your Worker, D1, and domain | Often hosted by a public service |
| Management | Create, list, reuse, and delete counters | Usually URL-only |
| Abuse control | Public badge URLs cannot create counters | Random paths may create or pollute data |
| Status page | Built in for every counter | Often badge only |
| Saved badge config | Stored in D1 | Often only URL parameters |
| Output formats | Markdown, linked Markdown, HTML, image URL, status URL | Usually one or two formats |

## Keyword Matrix

| Search keyword | Built-in capability |
| --- | --- |
| Cloudflare Workers visitor counter | Serverless Worker runtime. |
| Cloudflare D1 visit counter | D1 stores totals, daily visits, and badge config. |
| GitHub README visitor badge | Markdown badge output for README files. |
| self-hosted visitor badge | Your domain, Worker, and D1 database. |
| SVG hit counter | Lightweight SVG badge response. |
| visitor badge status page | Public status page and trend chart per counter. |
| open source badge generator | Built-in dashboard for Markdown, HTML, image URL, and status URL. |
| Shields style badge | Supports flat, flat-square, plastic, for-the-badge, and social styles. |

## Quick Start

Create a D1 table:

```sql
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
);
```

Paste `worker.js` into a Cloudflare Worker and configure:

```js
const ALLOWED_DOMAIN = 'your.domain.com'
const AUTH_CODE = 'change-this-auth-code'
const ENABLE_ALLOWLIST = false
const ALLOWED_PATHS = []
```

Add a D1 binding:

| Binding name | Value |
| --- | --- |
| `HITS` | Your D1 database |

Bind the Worker to the same custom domain as `ALLOWED_DOMAIN`, then open:

```url
https://your.domain.com/
```

## API

### Badge

```url
GET /api/combined?path={counterKey}&label={badgeLabel}&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default
```

Returns an SVG badge and increments an existing counter.

### Status page

```url
GET /status?path={counterKey}
```

Shows today, total visits, and a 30-day trend.

### Management

```bash
curl -X POST https://your.domain.com/api/create \
  -H "Content-Type: application/json" \
  -d '{"counter":"https://example.com/","authCode":"your-auth-code","label":"Visitors"}'

curl -X POST https://your.domain.com/api/list \
  -H "Content-Type: application/json" \
  -d '{"authCode":"your-auth-code"}'

curl -X POST https://your.domain.com/api/delete \
  -H "Content-Type: application/json" \
  -d '{"counter":"https://example.com/","authCode":"your-auth-code"}'
```

## Security and Privacy

- `AUTH_CODE` protects create, list, and delete operations.
- Public badge and status URLs are visible to anyone with the counter key.
- The Worker does not store IP addresses, user agents, referrers, cookies, or visitor identity.
- Enable `ENABLE_ALLOWLIST` if you only want fixed counter keys.
- Public badge URLs do not create new counters automatically.

## License

This project is licensed under the [MIT License](LICENSE).



