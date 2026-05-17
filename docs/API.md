# API Reference

This document describes the public and management APIs for `cloudflare-d1-visit-counter`.

## Public Badge

```url
GET /api/combined?path={counterKey}&label={badgeLabel}&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default
```

Returns an SVG badge and increments an existing counter.

| Parameter | Alias | Description |
| --- | --- | --- |
| `path` | `counter` | Counter key. Required. |
| `label` | `title` | Badge label text. |
| `labelColor` | `title_bg` | Label background color. Hex or Shields-style named color. |
| `countColor` | `count_bg` | Count background color. Hex or Shields-style named color. |
| `style` | - | `flat`, `flat-square`, `plastic`, `for-the-badge`, `social`. |
| `labelStyle` | - | `default` for `today / total`, `none` for `total only`. |

## Status Page

```url
GET /status?path={counterKey}&days=30
```

Shows today, total visits, available daily statistics, and a trend chart. `days` is optional and is capped by `HISTORY_DAYS`.

## Management API

All management endpoints require `AUTH_CODE` and `Content-Type: application/json`.

### Create or Update Counter

```bash
curl -X POST https://your.domain.com/api/create \
  -H "Content-Type: application/json" \
  -d '{
    "counter": "https://example.com/",
    "authCode": "your-auth-code",
    "label": "Visitors",
    "labelColor": "#A4D3EE",
    "countColor": "#555555",
    "style": "flat",
    "labelStyle": "default"
  }'
```

### List Counters

```bash
curl -X POST https://your.domain.com/api/list \
  -H "Content-Type: application/json" \
  -d '{"authCode":"your-auth-code"}'
```

### Delete Counter

```bash
curl -X POST https://your.domain.com/api/delete \
  -H "Content-Type: application/json" \
  -d '{"counter":"https://example.com/","authCode":"your-auth-code"}'
```

Deleting a counter removes its total count, daily chart data, and saved badge config.

## Compatibility Endpoints

```url
GET /api/monthly?counter={counterKey}
GET /{counterKey}.svg?action=hit
GET /{counterKey}?action=view
GET /history/{counterKey}.svg?days=30&chartType=bar
GET /chart/{counterKey}.svg?days=30&chartType=scatter
GET /history.svg?path={counterKey}&days=30&chartType=bar
GET /chart.svg?path={counterKey}&days=30&chartType=scatter
```

`/history` and `/chart` use `HISTORY_DAYS` as the default and maximum range. Use the query-style endpoints when the counter key is a full URL, repository path, or Chinese text. Total visits remain permanent; daily trend rows are retained only inside the configured history window.

Recommended new integrations should use `/api/combined` and `/status`, because they match the dashboard output.
