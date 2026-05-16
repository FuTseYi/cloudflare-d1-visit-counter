# Cloudflare D1 Visit Counter

Open-source Cloudflare Workers + D1 visitor badge and status chart service.

Project: `cloudflare-d1-visit-counter`

Author: [FuTseYi](https://github.com/FuTseYi)

All rights reserved.

## Core files

Only these two files are needed:

- `worker.js`
- `README.md`

## Deploy

1. Create a Cloudflare D1 database, for example `hits`.
2. Run this SQL in the D1 console:

```sql
CREATE TABLE counters ( name TEXT PRIMARY KEY, count INTEGER DEFAULT 0 );
```

3. Create a Cloudflare Worker and paste `worker.js`.
4. Edit the top config in `worker.js`:

```js
const ALLOWED_DOMAIN = 'your.domain.com'
const AUTH_CODE = 'change-this-auth-code'
```

Set `AUTH_CODE` to your own secret. Empty/default auth code is rejected.

5. Bind D1:

- Binding name: `HITS`
- D1 database: your `hits` database

6. Bind the custom domain matching `ALLOWED_DOMAIN`.

## Dashboard

The homepage creates counters and outputs visitorbadge-style embed formats:

- Markdown (badge only)
- Markdown (with status)
- HTML (with status)
- Image URL (badge only)
- Status page URL (status only)

Inputs:

- Auth Code
- URL (or custom public key)
- Badge Label
- Label Background, default `#A4D3EE`
- Count Background, default `#555555`
- Badge Style: `flat`, `flat-square`, `plastic`, `for-the-badge`, `social`
- Badge Type: `total only` or `today / total`

The `path` / URL key is public and directly identifies the badge data and status page, following the original hits counter model. You can use a full URL, page name, repository path, or Chinese key.

Created counters can be listed and deleted from the dashboard. The list shows the public counter key, saved badge label, and total visits. List/delete/create all require `AUTH_CODE`; public badge/status URLs do not.

## Visitorbadge-compatible image URL

```url
https://your.domain.com/api/combined?path=my-page&label=Visitors&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=none
```

`/api/combined` increments the counter and returns an SVG badge.

For safety, it does not create counters automatically. Create the counter first from the dashboard or `/api/create`.

## Status URL

```url
https://your.domain.com/status?path=my-page
```

## Create by API

```bash
curl -X POST https://your.domain.com/api/create \
  -H "Content-Type: application/json" \
  -d "{\"counter\":\"my-page\",\"label\":\"Visitors\",\"authCode\":\"your-auth-code\"}"
```

## Management API

List counters:

```bash
curl -X POST https://your.domain.com/api/list \
  -H "Content-Type: application/json" \
  -d "{\"authCode\":\"your-auth-code\"}"
```

Delete a counter:

```bash
curl -X POST https://your.domain.com/api/delete \
  -H "Content-Type: application/json" \
  -d "{\"counter\":\"my-page\",\"authCode\":\"your-auth-code\"}"
```

## Parameters

| Parameter    | Meaning                         |
| ------------ | ------------------------------- |
| `path`       | Counter key                     |
| `label`      | Badge label text                |
| `labelColor` | Label background hex color      |
| `countColor` | Count background hex color      |
| `style`      | Badge style                     |
| `labelStyle` | `none` or `default`             |

Compatible aliases are still accepted: `title`, `title_bg`, `count_bg`, and `counter`.






