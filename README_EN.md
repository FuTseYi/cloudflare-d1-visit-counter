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

Paste `worker.js` into a Cloudflare Worker.

Bind D1 before editing config:

| Binding name | Value |
| --- | --- |
| `HITS` | Your D1 database |

Configure the top of `worker.js`:

```js
const ALLOWED_DOMAIN = 'your.domain.com'
const AUTH_CODE = 'change-this-auth-code'
const ALLOWED_PATHS = []
const HISTORY_DAYS = 30
```

`ALLOWED_PATHS = []` allows all created counters. Once you add values, only those counter keys are accepted.

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

## History Retention

Use one setting:

```js
const HISTORY_DAYS = 30
```

It controls the default status page range, default history SVG range, maximum accepted `?days=` value, and daily row retention in D1.

Total visits are permanent until the counter is deleted. Increasing `HISTORY_DAYS` keeps existing daily rows and lets the chart grow into the new window; daily rows already deleted cannot be restored. Decreasing it removes older daily rows on the next cleanup.

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
