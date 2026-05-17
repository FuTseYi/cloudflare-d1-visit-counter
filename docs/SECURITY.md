# Security and Privacy

## Auth Code Boundary

`AUTH_CODE` protects management actions only:

- create counter
- list counters
- delete counter

Public badge and status URLs do not require `AUTH_CODE`, because they are designed to be embedded in README files, websites, and docs.

## Public Counter Boundary

A public badge URL can increment an existing counter. It cannot create a new counter automatically.

If a counter key should not be public, do not publish its badge URL or status URL. Anyone who knows the counter key can open the status page.

## Privacy

The Worker does not store:

- IP address
- User-Agent
- Referer
- Cookie
- visitor identity

It only stores counter totals, daily totals, and badge configuration. Total counters are retained permanently until deletion. Daily trend rows are retained for the latest 30 days only.

## Hardening Options

- Use a long, non-default `AUTH_CODE`.
- Do not publish `AUTH_CODE` in README, frontend code, issues, or examples.
- Enable `ENABLE_ALLOWLIST` for fixed counter keys.
- Add Cloudflare WAF / rate limiting if you expose badges to very high traffic.
- Consider Turnstile for dashboard access if you later add a login layer.

