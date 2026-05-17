# cloudflare-d1-visit-counter

<p align="center">
  <img src="docs/images/logo.svg" width="72" alt="cloudflare-d1-visit-counter logo" />
</p>

[中文说明](README.md) | English

**cloudflare-d1-visit-counter** is an open-source, self-hosted, low-cost visitor counter powered by **Cloudflare Workers + Cloudflare D1**. It generates SVG visitor badges for GitHub README files, personal websites, blogs, documentation sites, and project pages, with a dashboard, public status pages, and history charts.

## Quick Start

- [Deploy in minutes](#quick-start-deployment)
- [Create your first badge](#dashboard)
- [Copy Markdown / HTML / Image URL](#examples)
- [Read the API reference](docs/API.md)
- [Security and privacy](docs/SECURITY.md)

## Highlights

| Feature | Design |
| --- | --- |
| Self-hosted | Use your own Cloudflare Worker, D1 database, and domain. |
| Protected management | `AUTH_CODE` protects create, list, and delete operations. |
| Abuse control | Public badge URLs cannot create counters automatically. |
| Dashboard | Create, preview, load, reuse, and delete counters. |
| Status page | Every counter gets a public status page and trend chart. |
| Saved styles | Badge label, colors, style, and type are stored in D1. |
| Flexible keys | Counter keys can be URLs, repository paths, page names, or Chinese text. |
| Low cost | One Worker, one D1 table, no external runtime dependencies. |

## Quick Start Deployment

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

Bind D1:

| Binding name | Value |
| --- | --- |
| `HITS` | Your D1 database |

Then bind a custom domain matching `ALLOWED_DOMAIN` and open:

```url
https://your.domain.com/
```

## Dashboard

The dashboard creates counters, previews badges, generates embed links, and manages existing counters.

| Field | Description |
| --- | --- |
| Auth Code | Required for create, load, and delete. |
| URL | Real counter key for the badge data and status page. |
| Badge Label | Display text only. It does not change the counter key. |
| Label Background | Left-side badge color. Default `#A4D3EE`. |
| Count Background | Right-side count color. Default `#555555`. |
| Badge Style | `flat`, `flat-square`, `plastic`, `for-the-badge`, `social`. |
| Badge Type | `today / total` by default, or `total only`. |

## Examples

```md
![Visitors](https://your.domain.com/api/combined?path=https%3A%2F%2Fexample.com%2F&label=Visitors&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default)
```

```html
<a href="https://your.domain.com/status?path=https%3A%2F%2Fexample.com%2F" target="_blank" rel="noopener noreferrer">
  <img src="https://your.domain.com/api/combined?path=https%3A%2F%2Fexample.com%2F&label=Visitors&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default" alt="Visitor badge" />
</a>
```

## Documentation

| Document | Content |
| --- | --- |
| [API Reference](docs/API.md) | Badge, status, management, and compatibility endpoints. |
| [Architecture](docs/ARCHITECTURE.md) | D1 data model, hot path, and cost design. |
| [Security](docs/SECURITY.md) | Auth Code, public URL boundary, and privacy notes. |
| [Roadmap](docs/ROADMAP.md) | Planned improvements. |

## License

This project is licensed under the [MIT License](LICENSE).
