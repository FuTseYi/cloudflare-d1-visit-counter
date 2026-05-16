export default {
  async fetch(request, env) {
    return handleRequest(request, env.HITS)
  }
}

const ALLOWED_DOMAIN = 'your.domain.com'
const AUTH_CODE = 'change-this-auth-code'
const ENABLE_ALLOWLIST = false
const ALLOWED_PATHS = []
const DEFAULT_HISTORY_DAYS = 30
const MAX_HISTORY_DAYS = 365
const FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0969DA"/><rect x="12" y="18" width="40" height="28" rx="7" fill="#FFFFFF" opacity=".96"/><circle cx="25" cy="33" r="4" fill="#2ECC71"/><circle cx="36" cy="27" r="4" fill="#58A6FF"/><circle cx="46" cy="23" r="4" fill="#FFB6C1"/><path d="M25 33l11-6 10-4" fill="none" stroke="#24292F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`
const namedColors = {
  brightgreen: '#4c1',
  green: '#97ca00',
  yellow: '#dfb317',
  yellowgreen: '#a4a61d',
  orange: '#fe7d37',
  red: '#e05d44',
  blue: '#007ec6',
  grey: '#555',
  lightgrey: '#9f9f9f',
  gray: '#555',
  lightgray: '#9f9f9f',
  critical: '#e05d44',
  important: '#fe7d37',
  success: '#4c1',
  informational: '#007ec6',
  inactive: '#9f9f9f',
}

async function handleRequest(request, db) {
  const url = new URL(request.url)

  if (url.hostname !== ALLOWED_DOMAIN) {
    return textResponse('Not Found', 404)
  }

  if (url.pathname === '/' || url.pathname === '') {
    return htmlResponse(renderGeneratorPage())
  }

  if (url.pathname === '/api/create') {
    return handleCreateCounter(request, db)
  }

  if (url.pathname === '/api/list') {
    return handleListCounters(request, db)
  }

  if (url.pathname === '/api/delete') {
    return handleDeleteCounter(request, db)
  }

  if (url.pathname === '/api/combined') {
    return handleVisitorBadge(url, db)
  }

  if (url.pathname === '/status') {
    return handleStatusPage(url, db)
  }

  if (url.pathname === '/api/monthly') {
    return handleMonthlyApi(url, db)
  }

  if (url.pathname === '/example.svg') {
    return svgResponse(generateBadgeSvg({
      title: getParam(url, 'label', 'title') || 'Hits',
      titleBg: getParam(url, 'labelColor', 'title_bg') || 'grey',
      countBg: getParam(url, 'countColor', 'count_bg') || 'green',
      edgeFlat: url.searchParams.get('edge_flat') === 'true',
      style: url.searchParams.get('style') || 'flat',
      labelStyle: url.searchParams.get('labelStyle') || 'default',
      dailyCount: 123,
      totalCount: 456,
    }))
  }

  const historyMatch = url.pathname.match(/^\/(?:history|chart)\/([a-zA-Z0-9_-]+)\.svg$/)
  if (historyMatch) {
    return handleHistoryChart(url, db, historyMatch[1])
  }

  const badgeMatch = url.pathname.match(/^\/(.+?)(?:\.svg)?$/)
  if (badgeMatch) {
    return handleCounterRequest(url, db, decodeURIComponent(badgeMatch[1]), url.pathname.endsWith('.svg'))
  }

  return textResponse('Not Found', 404)
}

async function handleCreateCounter(request, db) {
  if (request.method !== 'POST') {
    return textResponse('Method not allowed', 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const counter = normalizeCounterName(body.counter)
  const badgeConfig = normalizeBadgeConfig(body)
  if (!counter) {
    return jsonResponse({ error: 'Counter key must be 1-512 characters and cannot include control characters' }, 400)
  }

  const authError = validateAuthCode(body.authCode)
  if (authError) return authError
  if (!isCounterAllowed(counter)) {
    return jsonResponse({ error: 'Counter is not in ALLOWED_PATHS' }, 403)
  }

  const exists = await counterExists(db, counter)
  if (exists) {
    await setCounterConfig(db, counter, badgeConfig)
    return jsonResponse({
      warning: 'Counter already exists',
      exists: true,
      counter,
      badge: `https://${ALLOWED_DOMAIN}/${counter}.svg?action=hit`,
      history: `https://${ALLOWED_DOMAIN}/history/${counter}.svg`,
    })
  }

  await createCounter(db, counter)
  await setCounterConfig(db, counter, badgeConfig)
  return jsonResponse({
    success: true,
    counter,
    badge: `https://${ALLOWED_DOMAIN}/${counter}.svg?action=hit`,
    history: `https://${ALLOWED_DOMAIN}/history/${counter}.svg`,
  }, 201)
}

async function handleListCounters(request, db) {
  if (request.method !== 'POST') {
    return textResponse('Method not allowed', 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const authError = validateAuthCode(body.authCode)
  if (authError) return authError

  const { results } = await db.prepare(`
    SELECT name, count
    FROM counters
    WHERE name LIKE '%:total'
    ORDER BY name ASC
  `).all()

  const counters = []
  for (const row of results) {
    const counter = String(row.name).slice(0, -6)
    counters.push({
      counter,
      config: await getCounterConfig(db, counter),
      daily: await getCounter(db, `${counter}:daily:${todayString()}`),
      total: Number(row.count) || 0,
    })
  }

  return jsonResponse({ counters })
}

async function handleDeleteCounter(request, db) {
  if (request.method !== 'POST') {
    return textResponse('Method not allowed', 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const authError = validateAuthCode(body.authCode)
  if (authError) return authError

  const counter = normalizeCounterName(body.counter)
  if (!counter) {
    return jsonResponse({ error: 'Counter key must be 1-512 characters and cannot include control characters' }, 400)
  }

  const dailyPrefix = `${counter}:daily:`
  await db.prepare('DELETE FROM counters WHERE name = ? OR name = ? OR name = ? OR substr(name, 1, ?) = ?')
    .bind(`${counter}:total`, `${counter}:meta:label`, `${counter}:meta:config`, dailyPrefix.length, dailyPrefix)
    .run()

  return jsonResponse({ success: true, counter })
}

function validateAuthCode(authCode) {
  const configuredAuthCode = String(AUTH_CODE || '').trim()
  const submittedAuthCode = String(authCode || '').trim()
  if (!configuredAuthCode || configuredAuthCode === 'change-this-auth-code') {
    return jsonResponse({ error: 'Auth code is not configured. Set AUTH_CODE in worker.js before deployment.' }, 500)
  }
  if (!submittedAuthCode) {
    return jsonResponse({ error: 'Auth code is required' }, 400)
  }
  if (submittedAuthCode !== configuredAuthCode) {
    return jsonResponse({ error: 'Invalid auth code' }, 403)
  }
  return null
}

async function handleCounterRequest(url, db, counter, isSvg) {
  counter = normalizeCounterName(counter)
  if (!counter || !isCounterAllowed(counter)) {
    return textResponse('Not Found', 404)
  }

  const action = (url.searchParams.get('action') || 'view').toLowerCase()
  if (!['view', 'hit'].includes(action)) {
    return jsonResponse({ error: 'Invalid action. Use view or hit.' }, 400)
  }

  const today = todayString()
  const totalKey = `${counter}:total`
  const dailyKey = `${counter}:daily:${today}`
  let total
  let daily

  if (action === 'hit') {
    total = await incrementExistingCounter(db, totalKey)
    if (total === null) return textResponse('Counter not found', 404)
    daily = await incrementCounter(db, dailyKey)
  } else {
    total = await getCounterValue(db, totalKey)
    if (total === null) return textResponse('Counter not found', 404)
    daily = await getCounter(db, dailyKey)
  }

  if (isSvg) {
    return svgResponse(generateBadgeSvg({
      title: getParam(url, 'label', 'title') || 'Hits',
      titleBg: getParam(url, 'labelColor', 'title_bg') || 'grey',
      countBg: getParam(url, 'countColor', 'count_bg') || 'green',
      edgeFlat: url.searchParams.get('edge_flat') === 'true',
      style: url.searchParams.get('style') || 'flat',
      labelStyle: url.searchParams.get('labelStyle') || 'default',
      dailyCount: daily,
      totalCount: total,
    }))
  }

  return jsonResponse({
    counter,
    action,
    total,
    daily,
    date: today,
    timestamp: new Date().toISOString(),
  })
}

async function handleVisitorBadge(url, db) {
  const counter = normalizeCounterName(url.searchParams.get('counter') || url.searchParams.get('path'))
  if (!counter) {
    return jsonResponse({ error: 'Missing or invalid path' }, 400)
  }

  if (!isCounterAllowed(counter)) {
    return textResponse('Not Found', 404)
  }

  const today = todayString()
  const total = await incrementExistingCounter(db, `${counter}:total`)
  if (total === null) {
    return textResponse('Counter not found', 404)
  }
  const daily = await incrementCounter(db, `${counter}:daily:${today}`)

  return svgResponse(generateBadgeSvg({
    title: getParam(url, 'label', 'title') || 'Visitors',
    titleBg: getParam(url, 'labelColor', 'title_bg') || 'grey',
    countBg: getParam(url, 'countColor', 'count_bg') || 'green',
    edgeFlat: url.searchParams.get('edge_flat') === 'true',
    style: url.searchParams.get('style') || 'flat',
    labelStyle: url.searchParams.get('labelStyle') || 'default',
    dailyCount: daily,
    totalCount: total,
  }))
}

async function handleStatusPage(url, db) {
  const counter = normalizeCounterName(url.searchParams.get('counter') || url.searchParams.get('path'))
  if (!counter) {
    return htmlResponse(renderStatusPage({ error: 'Missing or invalid path' }))
  }

  const today = todayString()
  const total = await getCounterValue(db, `${counter}:total`)
  if (total === null) {
    return htmlResponse(renderStatusPage({ counter, error: 'Counter not found' }))
  }
  const daily = await getCounter(db, `${counter}:daily:${today}`)
  const series = await getDailySeries(db, counter, 30)
  return htmlResponse(renderStatusPage({ counter, total, daily, series }))
}
async function handleHistoryChart(url, db, counter) {
  if (!isCounterAllowed(counter)) {
    return textResponse('Not Found', 404)
  }

  if (!await counterExists(db, counter)) {
    return textResponse('Counter not found', 404)
  }

  const days = clampInt(url.searchParams.get('days'), DEFAULT_HISTORY_DAYS, 1, MAX_HISTORY_DAYS)
  const width = clampInt(url.searchParams.get('width'), 900, 320, 2400)
  const height = clampInt(url.searchParams.get('height'), 520, 220, 1400)
  const chartType = (url.searchParams.get('chartType') || 'bar').toLowerCase()
  const safeChartType = ['bar', 'line', 'area', 'scatter'].includes(chartType) ? chartType : 'bar'
  const color = resolveColor(url.searchParams.get('color') || url.searchParams.get('count_bg') || 'green')
  const title = url.searchParams.get('title') || `${counter} daily hits`
  const series = await getDailySeries(db, counter, days)

  return svgResponse(generateHistorySvg({
    title,
    series,
    width,
    height,
    chartType: safeChartType,
    color,
  }), 'public, max-age=300')
}

async function counterExists(db, counter) {
  const { results } = await db.prepare('SELECT 1 FROM counters WHERE name = ? LIMIT 1')
    .bind(`${counter}:total`)
    .all()
  return results.length > 0
}

async function createCounter(db, counter) {
  await db.prepare('INSERT INTO counters (name, count) VALUES (?, 0)')
    .bind(`${counter}:total`)
    .run()
}

async function setCounterConfig(db, counter, config) {
  await db.prepare(`
    INSERT INTO counters (name, count)
    VALUES (?, ?)
    ON CONFLICT(name)
    DO UPDATE SET count = excluded.count
  `).bind(`${counter}:meta:config`, JSON.stringify(config)).run()
}

async function getCounterConfig(db, counter) {
  const { results } = await db.prepare('SELECT count FROM counters WHERE name = ?')
    .bind(`${counter}:meta:config`)
    .all()
  if (!results.length) {
    const legacy = await getLegacyCounterLabel(db, counter)
    return normalizeBadgeConfig({ label: legacy })
  }
  try {
    return normalizeBadgeConfig(JSON.parse(String(results[0].count || '{}')))
  } catch {
    return normalizeBadgeConfig({})
  }
}

async function getLegacyCounterLabel(db, counter) {
  const { results } = await db.prepare('SELECT count FROM counters WHERE name = ?')
    .bind(`${counter}:meta:label`)
    .all()
  return results.length ? String(results[0].count || '') : ''
}
async function getCounterValue(db, key) {
  const { results } = await db.prepare('SELECT count FROM counters WHERE name = ?')
    .bind(key)
    .all()
  return results.length ? Number(results[0].count) : null
}

async function getCounter(db, key) {
  return await getCounterValue(db, key) ?? 0
}

async function incrementExistingCounter(db, key) {
  const { results } = await db.prepare('UPDATE counters SET count = count + 1 WHERE name = ? RETURNING count')
    .bind(key)
    .all()
  return results.length ? Number(results[0].count) : null
}

async function incrementCounter(db, key) {
  const { results } = await db.prepare(`
    INSERT INTO counters (name, count)
    VALUES (?, 1)
    ON CONFLICT(name)
    DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(key).all()
  return Number(results[0].count)
}

async function getDailySeries(db, counter, days) {
  const dates = recentDates(days)
  const first = dates[0]
  const last = dates[dates.length - 1]
  const prefix = `${counter}:daily:`
  const { results } = await db.prepare(`
    SELECT name, count
    FROM counters
    WHERE substr(name, 1, ?) = ?
      AND substr(name, ?) BETWEEN ? AND ?
    ORDER BY name ASC
  `).bind(prefix.length, prefix, prefix.length + 1, first, last).all()

  const countByDate = new Map()
  for (const row of results) {
    countByDate.set(String(row.name).slice(prefix.length), Number(row.count) || 0)
  }

  return dates.map(date => ({
    date,
    count: countByDate.get(date) || 0,
  }))
}

function generateBadgeSvg({ title, titleBg, countBg, edgeFlat, style, labelStyle, dailyCount, totalCount }) {
  const badgeStyle = normalizeBadgeStyle(style, edgeFlat)
  const rawTitle = String(title || 'Hits').slice(0, 48)
  const titleText = badgeStyle === 'for-the-badge' ? rawTitle.toUpperCase() : rawTitle
  const safeTitle = escapeXml(titleText)
  const countText = normalizeLabelStyle(labelStyle) === 'none' ? `${totalCount}` : `${dailyCount} / ${totalCount}`
  const height = badgeStyle === 'for-the-badge' ? 28 : 20
  const fontSize = badgeStyle === 'for-the-badge' ? 12 : 11
  const baseline = badgeStyle === 'for-the-badge' ? 18 : 14
  const shadowBaseline = baseline + 1
  const titleWidth = getTextWidth(titleText) + (badgeStyle === 'for-the-badge' ? 14 : 0)
  const countWidth = getTextWidth(countText) + (badgeStyle === 'for-the-badge' ? 14 : 0)
  const width = titleWidth + countWidth
  const radius = badgeStyle === 'flat-square' || badgeStyle === 'for-the-badge' ? 0 : 3
  const titleColor = badgeStyle === 'social' ? '#fff' : resolveColor(titleBg)
  const countColor = resolveColor(countBg)
  const border = badgeStyle === 'social' ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" fill="none" stroke="#d0d7de"/>` : ''
  const titleTextColor = badgeStyle === 'social' ? '#24292f' : '#fff'
  const gradientOpacity = badgeStyle === 'plastic' ? '.22' : '.10'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${safeTitle}: ${countText}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity="${gradientOpacity}"/>
    <stop offset="1" stop-color="#000" stop-opacity="${gradientOpacity}"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${titleWidth}" height="${height}" fill="${titleColor}"/>
    <rect x="${titleWidth}" width="${countWidth}" height="${height}" fill="${countColor}"/>
    <rect width="${width}" height="${height}" fill="url(#s)"/>
  </g>
  ${border}
  <g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="${fontSize}" font-weight="${badgeStyle === 'for-the-badge' ? '700' : '400'}">
    <text x="${Math.floor(titleWidth / 2)}" y="${shadowBaseline}" fill="#010101" fill-opacity=".25">${safeTitle}</text>
    <text x="${Math.floor(titleWidth / 2)}" y="${baseline}" fill="${titleTextColor}">${safeTitle}</text>
    <text x="${titleWidth + Math.floor(countWidth / 2)}" y="${shadowBaseline}" fill="#010101" fill-opacity=".25">${countText}</text>
    <text x="${titleWidth + Math.floor(countWidth / 2)}" y="${baseline}" fill="#fff">${countText}</text>
  </g>
</svg>`
}

function normalizeLabelStyle(labelStyle) {
  const value = String(labelStyle || 'default').toLowerCase()
  return ['default', 'none'].includes(value) ? value : 'default'
}

function normalizeBadgeStyle(style, edgeFlat) {
  if (edgeFlat) return 'flat-square'
  const value = String(style || 'flat').toLowerCase()
  return ['flat', 'flat-square', 'plastic', 'for-the-badge', 'social'].includes(value) ? value : 'flat'
}
function generateHistorySvg({ title, series, width, height, chartType, color }) {
  const padding = { top: 58, right: 34, bottom: 58, left: 58 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxCount = Math.max(...series.map(item => item.count), 1)
  const barStep = chartWidth / Math.max(series.length, 1)
  const pointStep = series.length > 1 ? chartWidth / (series.length - 1) : chartWidth
  const barWidth = Math.max(2, barStep * 0.64)
  const tickInterval = Math.max(1, Math.ceil(series.length / 12))
  const safeTitle = escapeXml(title.slice(0, 80))
  const total = series.reduce((sum, item) => sum + item.count, 0)
  const points = series.map((item, index) => {
    const x = padding.left + index * pointStep
    const y = padding.top + chartHeight - (item.count / maxCount) * chartHeight
    return { ...item, x, y }
  })

  let marks = ''
  let shape = ''
  for (let i = 0; i < series.length; i++) {
    const item = series[i]
    if (i % tickInterval === 0 || i === series.length - 1) {
      const labelX = chartType === 'bar'
        ? padding.left + i * barStep + barStep / 2
        : points[i].x
      marks += `<text x="${round(labelX)}" y="${height - 24}" text-anchor="middle" font-size="10" fill="#586069">${item.date.slice(5)}</text>`
    }
  }

  if (chartType === 'bar') {
    for (let i = 0; i < series.length; i++) {
      const item = series[i]
      const valueHeight = (item.count / maxCount) * chartHeight
      const x = padding.left + i * barStep + (barStep - barWidth) / 2
      const y = padding.top + chartHeight - valueHeight
      shape += `<rect x="${round(x)}" y="${round(y)}" width="${round(barWidth)}" height="${round(valueHeight)}" fill="${color}" opacity="0.86"/>`
    }
  } else {
    const pathData = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)},${round(point.y)}`).join(' ')
    if (chartType === 'area') {
      const first = points[0]
      const last = points[points.length - 1]
      shape += `<path d="${pathData} L${round(last.x)},${padding.top + chartHeight} L${round(first.x)},${padding.top + chartHeight} Z" fill="${color}" opacity="0.20"/>`
      shape += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5"/>`
    } else if (chartType === 'line') {
      shape += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5"/>`
    } else {
      shape += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="1.6" opacity="0.55"/>`
      shape += points.map(point => `<circle cx="${round(point.x)}" cy="${round(point.y)}" r="3.5" fill="${color}"/>`).join('')
    }
  }

  const yMarks = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = padding.top + chartHeight - ratio * chartHeight
    const value = Math.round(maxCount * ratio)
    return `<line x1="${padding.left}" y1="${round(y)}" x2="${width - padding.right}" y2="${round(y)}" stroke="#eaeef2"/>
<text x="${padding.left - 10}" y="${round(y + 4)}" text-anchor="end" font-size="11" fill="#586069">${value}</text>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${safeTitle}">
  <rect width="100%" height="100%" fill="#fff"/>
  <text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#24292f">${safeTitle}</text>
  <text x="${width / 2}" y="47" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#57606a">Total in range: ${total}</text>
  ${yMarks}
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" stroke="#8c959f"/>
  <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}" stroke="#8c959f"/>
  ${marks}
  ${shape}
</svg>`
}
function renderGeneratorPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cloudflare D1 Visit Counter</title>
  <link rel="icon" type="image/svg+xml" href="${FAVICON_HREF}">
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f8fa; color: #24292f; }
    main { max-width: 1120px; margin: 0 auto; padding: 36px 18px 56px; }
    h1 { margin: 0 0 8px; font-size: 32px; letter-spacing: 0; }
    .product-head { margin-bottom: 28px; padding-top: 6px; text-align: center; }
    .powered-title { color: #24292f; font-size: clamp(36px, 5vw, 52px); font-weight: 850; letter-spacing: 0; line-height: 1.12; }
    .powered-title a { color: #0969da; text-decoration: none; }
    .powered-title a:hover { text-decoration: underline; }
    .powered-prefix { color: #24292f; font-weight: 650; }
    p { color: #57606a; line-height: 1.65; }
    .panel { background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 20px; margin-top: 18px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .color-row { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .output-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: start; }
    .copy-btn { min-height: 34px; background: #24292f; white-space: nowrap; }
    .danger-btn { background: #cf222e; }
    .secondary-btn { background: #57606a; }
    .counter-list { display: grid; gap: 8px; margin-top: 10px; }
    .counter-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .counter-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 8px; align-items: center; border: 1px solid #d0d7de; border-radius: 6px; padding: 10px; background: #f6f8fa; }
    .counter-name { overflow-wrap: anywhere; font-weight: 700; }
    .counter-total { color: #57606a; font-size: 12px; margin-top: 6px; }
    .saved-badge { display: inline-flex; align-items: center; min-height: 20px; border-radius: 3px; overflow: hidden; font-family: Verdana,Geneva,DejaVu Sans,sans-serif; font-size: 11px; line-height: 1; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
    .saved-badge-label { background: #A4D3EE; color: #24292f; padding: 5px 7px; font-weight: 700; }
    .saved-badge-count { background: #555555; color: #fff; padding: 5px 7px; }
    .saved-badge-flat-square, .saved-badge-for-the-badge { border-radius: 0; }
    .saved-badge-for-the-badge { min-height: 28px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .saved-badge-for-the-badge .saved-badge-label, .saved-badge-for-the-badge .saved-badge-count { padding: 8px 9px; }
    .saved-badge-social { background: #fff; border: 1px solid #d0d7de; box-shadow: none; }
    .status-preview { margin-top: 12px; border: 1px dashed #d0d7de; border-radius: 8px; background: #f6f8fa; padding: 14px; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .stat { background: #fff; border: 1px solid #d0d7de; border-radius: 6px; padding: 10px; }
    .stat strong { display: block; font-size: 22px; }
    .stat span { color: #57606a; font-size: 12px; }
    label { display: grid; gap: 6px; font-size: 13px; font-weight: 650; }
    .field-title { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
    .field-note { color: #57606a; font-size: 12px; font-weight: 500; text-align: right; }
    input, select { min-height: 38px; border: 1px solid #d0d7de; border-radius: 6px; padding: 0 10px; font: inherit; }
    button { min-height: 40px; border: 0; border-radius: 6px; background: #0969da; color: #fff; font-weight: 700; padding: 0 14px; cursor: pointer; }
    code { display: block; overflow-wrap: anywhere; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 10px; color: #24292f; }
    .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
    .preview { min-height: 34px; display: flex; align-items: center; }
    .hint { margin: 8px 0 0; font-size: 12px; color: #57606a; }
    .empty { color: #6e7781; font-style: italic; }
    .color-field { position: relative; display: grid; gap: 6px; font-size: 13px; font-weight: 650; }
    .color-button { min-height: 38px; border: 1px solid #d0d7de; border-radius: 6px; padding: 0 12px; color: #fff; font-weight: 700; text-shadow: 0 1px 1px rgba(0,0,0,.25); }
    .color-popover { position: absolute; z-index: 20; top: 66px; left: 0; width: 196px; background: #fff; border: 1px solid #d0d7de; border-radius: 6px; box-shadow: 0 12px 28px rgba(31,35,40,.18); padding: 10px; display: none; }
    .color-popover.open { display: block; }
    .color-popover::before { content: ""; position: absolute; top: -8px; left: 90px; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 8px solid #555; }
    .color-large { height: 78px; border-radius: 4px 4px 0 0; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; text-shadow: 0 1px 1px rgba(0,0,0,.28); }
    .palette { display: grid; grid-template-columns: repeat(6, 22px); gap: 9px; padding: 10px 0; }
    .swatch { width: 22px; height: 22px; min-height: 22px; border: 0; border-radius: 4px; padding: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
    .hex-input { width: 100%; box-sizing: border-box; min-height: 30px; font-size: 12px; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } .powered-title { font-size: 32px; } .counter-item { grid-template-columns: auto minmax(0, 1fr); } .counter-item button { width: 100%; } .field-title { align-items: flex-start; flex-direction: column; gap: 2px; } .field-note { text-align: left; } }
  </style>
</head>
<body>
  <main>
    <header class="product-head"><div class="powered-title"><span class="powered-prefix">Powered by</span> <a href="https://github.com/FuTseYi/cloudflare-d1-visit-counter" target="_blank" rel="noopener noreferrer">cloudflare-d1-visit-counter</a></div></header>
    <section class="panel">
      <div class="grid">
        <label style="grid-column: 1 / -1;">Auth Code<input id="authCode" type="password" placeholder="Enter auth code to unlock create, load, and delete"></label>
        <label><span class="field-title"><span>URL</span><span class="field-note">Custom public key is also supported</span></span><input id="source"></label>
        <label><span class="field-title"><span>Badge Label</span><span class="field-note"></span></span><input id="label"></label>
        <div class="color-row">
        <div class="color-field" data-color-field="labelColor">
          <span>Label Background</span>
          <button class="color-button" type="button" id="labelColorButton">Click to change</button>
          <div class="color-popover" id="labelColorPanel">
            <div class="color-large" id="labelColorLarge">#A4D3EE</div>
            <div class="palette" id="labelColorPalette"></div>
            <input class="hex-input" id="labelColor" value="#A4D3EE">
          </div>
        </div>
        <div class="color-field" data-color-field="countColor">
          <span>Count Background</span>
          <button class="color-button" type="button" id="countColorButton">Click to change</button>
          <div class="color-popover" id="countColorPanel">
            <div class="color-large" id="countColorLarge">#555555</div>
            <div class="palette" id="countColorPalette"></div>
            <input class="hex-input" id="countColor" value="#555555">
          </div>
        </div>
        </div>
        <label>Badge Style
          <select id="style">
            <option value="flat">flat</option>
            <option value="flat-square">flat-square</option>
            <option value="plastic">plastic</option>
            <option value="for-the-badge">for-the-badge</option>
            <option value="social">social</option>
          </select>
        </label>
        <label>Badge Type
          <select id="labelStyle">
            <option value="default">today / total</option>
            <option value="none">total only</option>
          </select>
        </label>
      </div>
      <p class="hint">URL is the public key for badge data and the status page. Page names, repository paths, and Chinese keys are also supported. Badge Label only changes the text shown on the badge.</p>
      <div class="actions">
        <button id="create">Create Counter</button><button id="loadCounters" class="secondary-btn" type="button">Load Created Counters</button>
        <div class="preview"><img id="badgePreview" alt=""><a id="statusLink" href="#" target="_blank" rel="noopener noreferrer" style="display:none; margin-left:12px; color:#0969da; font-weight:700;">Open status page</a></div>
      </div>
    </section>
    <section class="panel">      <p>Markdown (badge only)</p><div class="output-row"><code id="markdownCode" class="empty">Create a counter first.</code><button class="copy-btn" data-copy="markdownCode">Copy</button></div>
      <p>Markdown (with status)</p><div class="output-row"><code id="markdownLinkCode" class="empty">Create a counter first.</code><button class="copy-btn" data-copy="markdownLinkCode">Copy</button></div>
      <p>HTML (with status)</p><div class="output-row"><code id="htmlCode" class="empty">Create a counter first.</code><button class="copy-btn" data-copy="htmlCode">Copy</button></div>
      <p>Image URL (badge only)</p><div class="output-row"><code id="imageUrlCode" class="empty">Create a counter first.</code><button class="copy-btn" data-copy="imageUrlCode">Copy</button></div><p>Status page (status only)</p><div class="output-row"><code id="statusUrlCode" class="empty">Create a counter first.</code><button class="copy-btn" data-copy="statusUrlCode">Copy</button></div>
    </section>
    <section class="panel">
      <h2>Created Counters</h2>
      <p class="hint">Load requires Auth Code. Deleting a counter removes its badge data and status chart data.</p>
      <div class="counter-toolbar"><button id="selectAllCounters" class="secondary-btn" type="button">Select All</button><button id="deleteSelectedCounters" class="danger-btn" type="button">Delete Selected</button></div>
      <div id="counterList" class="counter-list"><span class="empty">No counters loaded.</span></div>
    </section>
  </main>
  <script>
    const domain = location.host
    const $ = id => document.getElementById(id)
    let createdCounter = ''
    const paletteColors = ['#D8E3F0', '#F87171', '#64748B', '#2ECC71', '#33C2D8', '#555555', '#E1E95B', '#FF8A65', '#B46AD1', '#A4D3EE', '#FFB6C1', '#FFFFFF']
    function sourceValue() { return $('source').value.trim() }
    function counterValue() { return sourceValue() }
    function normalizeHex(value, fallback) {
      const raw = String(value || '').trim()
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase()
      if (/^[0-9a-fA-F]{6}$/.test(raw)) return ('#' + raw).toUpperCase()
      return fallback
    }
    function readableTextColor(hex) {
      const value = normalizeHex(hex, '#555555').slice(1)
      const r = parseInt(value.slice(0, 2), 16)
      const g = parseInt(value.slice(2, 4), 16)
      const b = parseInt(value.slice(4, 6), 16)
      return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#24292f' : '#fff'
    }
    function setPickerColor(id, value) {
      const fallback = id === 'countColor' ? '#555555' : '#A4D3EE'
      const color = normalizeHex(value, fallback)
      const input = $(id)
      const button = $(id + 'Button')
      const large = $(id + 'Large')
      input.value = color
      button.style.background = color
      button.style.color = readableTextColor(color)
      large.style.background = color
      large.style.color = readableTextColor(color)
      large.textContent = color
      updateOutputs(counterValue())
    }
    function setupColorPicker(id) {
      const panel = $(id + 'Panel')
      const button = $(id + 'Button')
      const input = $(id)
      const palette = $(id + 'Palette')
      for (const color of paletteColors) {
        const swatch = document.createElement('button')
        swatch.type = 'button'
        swatch.className = 'swatch'
        swatch.style.background = color
        swatch.title = color
        swatch.addEventListener('click', () => setPickerColor(id, color))
        palette.appendChild(swatch)
      }
      button.addEventListener('click', () => {
        for (const other of document.querySelectorAll('.color-popover.open')) {
          if (other !== panel) other.classList.remove('open')
        }
        panel.classList.toggle('open')
      })
      input.addEventListener('input', () => setPickerColor(id, input.value))
      setPickerColor(id, input.value)
    }
    function imageUrl(counter) {
      const params = new URLSearchParams({
        path: counter,
        label: $('label').value || 'Visitors',
        labelColor: $('labelColor').value || '#A4D3EE',
        countColor: $('countColor').value || '#555555',
        style: $('style').value,
        labelStyle: $('labelStyle').value,
      })
      return 'https://' + domain + '/api/combined?' + params.toString()
    }
    function statusUrl(counter) {
      return 'https://' + domain + '/status?path=' + encodeURIComponent(counter)
    }
    function setCode(id, text) {
      const node = $(id)
      node.textContent = text
      node.classList.remove('empty')
    }
    function updateOutputs(counter) {
      if (!counter || counter !== createdCounter) return
      const image = imageUrl(counter)
      const status = statusUrl(counter)
      $('badgePreview').src = image
      setCode('markdownCode', '![' + counter + '](' + image + ')')
      setCode('markdownLinkCode', '[![' + counter + '](' + image + ')](' + status + ')')
      setCode('htmlCode', '<a href="' + status + '" target="_blank" rel="noopener noreferrer"><img src="' + image + '" alt="Visitor badge" /></a>')
      setCode('imageUrlCode', image)
      setCode('statusUrlCode', status)
      $('statusLink').href = status
      $('statusLink').style.display = 'inline-block'
    }
    function renderCounterList(counters) {
      const list = $('counterList')
      list.innerHTML = ''
      if (!counters.length) {
        list.innerHTML = '<span class="empty">No counters created yet.</span>'
        return
      }
      for (const item of counters) {
        const row = document.createElement('div')
        row.className = 'counter-item'
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.className = 'counter-select'
        checkbox.value = item.counter
        checkbox.setAttribute('aria-label', 'Select counter ' + item.counter)
        const info = document.createElement('div')
        const name = document.createElement('div')
        name.className = 'counter-name'
        name.textContent = item.counter
        const config = item.config || {}
        const badge = document.createElement('div')
        badge.className = 'saved-badge saved-badge-' + (config.style || 'flat')
        const badgeLabel = document.createElement('span')
        badgeLabel.className = 'saved-badge-label'
        badgeLabel.textContent = config.label || 'not set'
        badgeLabel.style.background = config.labelColor || '#A4D3EE'
        badgeLabel.style.color = readableTextColor(config.labelColor || '#A4D3EE')
        const badgeCount = document.createElement('span')
        badgeCount.className = 'saved-badge-count'
        badgeCount.textContent = config.labelStyle === 'none' ? item.total : (item.daily || 0) + ' / ' + item.total
        badgeCount.style.background = config.countColor || '#555555'
        badge.append(badgeLabel, badgeCount)
        const total = document.createElement('div')
        total.className = 'counter-total'
        total.textContent = 'Total visits: ' + item.total
        info.append(name, badge, total)
        const useButton = document.createElement('button')
        useButton.type = 'button'
        useButton.className = 'secondary-btn'
        useButton.textContent = 'Use'
        useButton.addEventListener('click', () => {
          createdCounter = item.counter
          $('source').value = item.counter
          $('label').value = config.label || ''
          $('style').value = config.style || 'flat'
          $('labelStyle').value = config.labelStyle || 'default'
          setPickerColor('labelColor', config.labelColor || '#A4D3EE')
          setPickerColor('countColor', config.countColor || '#555555')
          updateOutputs(item.counter)
        })
        const deleteButton = document.createElement('button')
        deleteButton.type = 'button'
        deleteButton.className = 'danger-btn'
        deleteButton.textContent = 'Delete'
        deleteButton.addEventListener('click', async () => {
          await deleteCounters([item.counter])
        })
        row.append(checkbox, info, useButton, deleteButton)
        list.appendChild(row)
      }
    }
    function selectedCounters() {
      return Array.from(document.querySelectorAll('.counter-select:checked')).map(input => input.value)
    }
    async function deleteCounters(counters) {
      if (!counters.length) {
        alert('Select at least one counter')
        return
      }
      if (!confirm('Delete selected counter data and status charts?')) return
      const authCode = $('authCode').value.trim()
      if (!authCode) {
        alert('Auth code is required')
        return
      }
      for (const counter of counters) {
        const res = await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counter, authCode })
        })
        const data = await res.json()
        if (!res.ok) {
          alert(data.error || 'Delete failed')
          return
        }
        if (createdCounter === counter) createdCounter = ''
      }
      await loadCounters()
    }
    async function loadCounters() {
      const authCode = $('authCode').value.trim()
      if (!authCode) {
        alert('Auth code is required')
        return
      }
      const res = await fetch('/api/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authCode })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Load failed')
        return
      }
      renderCounterList(data.counters || [])
    }
    $('create').addEventListener('click', async () => {
      const counter = counterValue()
      const authCode = $('authCode').value.trim()
      if (!counter) {
        alert('URL is required')
        return
      }
      if (!authCode) {
        alert('Auth code is required')
        return
      }
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counter, authCode, label: $('label').value.trim(), labelColor: $('labelColor').value, countColor: $('countColor').value, style: $('style').value, labelStyle: $('labelStyle').value })
      })
      const data = await res.json()
      if (!res.ok && !data.exists) {
        alert(data.error || 'Create failed')
        return
      }
      createdCounter = counter
      updateOutputs(counter)
      await loadCounters()
    })
    $('loadCounters').addEventListener('click', loadCounters)
    $('selectAllCounters').addEventListener('click', () => {
      const boxes = Array.from(document.querySelectorAll('.counter-select'))
      const shouldSelect = boxes.some(box => !box.checked)
      for (const box of boxes) box.checked = shouldSelect
    })
    $('deleteSelectedCounters').addEventListener('click', async () => deleteCounters(selectedCounters()))
    for (const id of ['source', 'label', 'style', 'labelStyle']) {
      $(id).addEventListener('input', () => updateOutputs(counterValue()))
      $(id).addEventListener('change', () => updateOutputs(counterValue()))
    }
    setupColorPicker('labelColor')
    setupColorPicker('countColor')
    document.addEventListener('click', event => {
      if (!event.target.closest('.color-field')) {
        for (const panel of document.querySelectorAll('.color-popover.open')) panel.classList.remove('open')
      }
    })
    async function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return
      }
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.focus()
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    for (const button of document.querySelectorAll('[data-copy]')) {
      button.addEventListener('click', async () => {
        const code = $(button.dataset.copy).textContent
        if (!code || code === 'Create a counter first.') return
        await copyText(code)
        const old = button.textContent
        button.textContent = 'Copied'
        setTimeout(() => { button.textContent = old }, 900)
      })
    }
    $('source').addEventListener('input', () => {
      if (counterValue() !== createdCounter) {
        $('badgePreview').removeAttribute('src')
      }
    })
  </script>
</body>
</html>`
}
function getParam(url, ...names) {
  for (const name of names) {
    const value = url.searchParams.get(name)
    if (value !== null && value !== '') return value
  }
  return ''
}

function renderStatusPage({ counter = '', total = 0, daily = 0, series = [], error = '' }) {
  const safeCounter = escapeXml(counter || 'status')
  const chart = error ? '' : generateHistorySvg({
    title: 'Visit Trend',
    series,
    width: 980,
    height: 430,
    chartType: 'area',
    color: '#A4D3EE',
  })
  const updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeCounter} status</title>
  <link rel="icon" type="image/svg+xml" href="${FAVICON_HREF}">
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f8fa; color: #24292f; }
    main { max-width: 1080px; margin: 0 auto; padding: 42px 18px 44px; }
    .topline { text-align: center; margin-bottom: 26px; }
    .project-line { margin-top: 12px; color: #57606a; font-size: 14px; }
    .project-line strong { color: #24292f; }
    .project-line a { color: #0969da; font-weight: 750; text-decoration: none; }
    .project-line a:hover { text-decoration: underline; }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 46px); letter-spacing: 0; }
    .overview { margin: 10px 0 0; color: #57606a; font-size: 16px; overflow-wrap: anywhere; }
    .center { text-align: center; }
    .eyebrow { color: #57606a; font-weight: 750; }
    h2 { margin: 10px 0 8px; font-size: clamp(28px, 5vw, 42px); }
    .sub { margin: 0; color: #6e7781; font-size: 16px; }
    .panel { background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 22px; margin-top: 20px; box-shadow: 0 8px 24px rgba(31, 35, 40, .06); }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .stat { background: linear-gradient(180deg, #ffffff, #f6f8fa); border: 1px solid #d0d7de; border-radius: 8px; padding: 18px; }
    .value { font-size: 36px; font-weight: 850; line-height: 1; }
    .label { margin-top: 8px; color: #57606a; font-size: 13px; }
    .chart-wrap { overflow-x: auto; }
    .error { color: #b42318; font-weight: 700; }
    @media (max-width: 720px) { .stats { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    ${error ? `<section class="panel error">${escapeXml(error)}</section>` : `<section class="topline"><h1>Analytics Overview</h1><p class="overview">Overview for</p><div class="target-key">${safeCounter}</div><div class="project-line">Powered by <a class="project-link" href="https://github.com/FuTseYi/cloudflare-d1-visit-counter" target="_blank" rel="noopener noreferrer">cloudflare-d1-visit-counter</a> · Author: <a class="project-link" href="https://github.com/FuTseYi" target="_blank" rel="noopener noreferrer">FuTseYi</a></div></section><section class="center"><p class="sub">Comprehensive statistics for the last 30 days · Last generated: ${updatedAt}</p></section><section class="panel stats"><div class="stat"><div class="value">${daily}</div><div class="label">Today</div></div><div class="stat"><div class="value">${total}</div><div class="label">Total visits</div></div><div class="stat"><div class="value">30</div><div class="label">Days in chart</div></div></section><section class="panel"><div class="chart-wrap">${chart}</div></section>`}
  </main>
</body>
</html>`
}
function isCounterAllowed(counter) {
  return !ENABLE_ALLOWLIST || ALLOWED_PATHS.includes(counter)
}

function normalizeBadgeConfig(value = {}) {
  return {
    label: normalizeBadgeLabel(value.label),
    labelColor: normalizeStoredHex(value.labelColor, '#A4D3EE'),
    countColor: normalizeStoredHex(value.countColor, '#555555'),
    style: normalizeBadgeStyle(value.style || 'flat', false),
    labelStyle: normalizeLabelStyle(value.labelStyle || 'default'),
  }
}

function normalizeStoredHex(value, fallback) {
  const raw = String(value || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase()
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return ('#' + raw).toUpperCase()
  return fallback
}

function normalizeBadgeLabel(value) {
  return String(value || '').trim().slice(0, 80)
}

function normalizeCounterName(value) {
  const counter = String(value || '').trim()
  if (!counter || counter.length > 512) return ''
  if (/[\x00-\x1F\x7F]/.test(counter)) return ''
  return counter
}

function resolveColor(value) {
  const color = String(value || '').trim().toLowerCase()
  if (namedColors[color]) return namedColors[color]
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) return color
  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) return `#${color}`
  return '#97ca00'
}

function getTextWidth(text) {
  let width = 10
  for (const char of text) {
    width += char.charCodeAt(0) > 255 ? 14 : 7
  }
  return Math.max(width, 28)
}

function recentDates(days) {
  const dates = []
  for (let offset = days - 1; offset >= 0; offset--) {
    dates.push(offsetDateString(-offset))
  }
  return dates
}

function todayString() {
  return offsetDateString(0)
}

function offsetDateString(offset) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function round(value) {
  return Math.round(value * 100) / 100
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  })
}

function svgResponse(svg, cacheControl = 'no-cache, no-store, must-revalidate, max-age=0') {
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': cacheControl,
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function textResponse(text, status) {
  return new Response(text, { status })
}
































