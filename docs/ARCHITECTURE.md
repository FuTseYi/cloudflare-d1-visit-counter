# Architecture

`cloudflare-d1-visit-counter` is intentionally small: one Cloudflare Worker and one D1 table.

## Data Model

```sql
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
);
```

| Key pattern | Meaning |
| --- | --- |
| `{counter}:total` | Total visits. |
| `{counter}:daily:{YYYY-MM-DD}` | Daily visits. |
| `{counter}:meta:config` | Saved badge label, colors, style, and type. |

## Hot Path

For `/api/combined`, the Worker:

1. Validates the counter key.
2. Updates `{counter}:total` only if the counter already exists.
3. Updates `{counter}:daily:{YYYY-MM-DD}`.
4. Generates the SVG badge directly in the Worker response.

The public badge URL does not create counters automatically. This keeps the D1 database cleaner and reduces accidental write growth.

## Cost Design

- No external runtime dependencies.
- No image storage.
- No static asset requests.
- Favicon uses an inline SVG data URL.
- One compact D1 table.
- Public badge hot path performs only the necessary D1 writes.

For high-traffic public badges, compare your expected traffic with current Cloudflare Workers and D1 limits before deployment.
