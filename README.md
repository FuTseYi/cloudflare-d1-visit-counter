# cloudflare-d1-visit-counter

<p>
  <a href="https://github.com/FuTseYi/cloudflare-d1-visit-counter"><img src="https://img.shields.io/badge/project-cloudflare--d1--visit--counter-0969DA" alt="project" /></a>
  <img src="https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/database-Cloudflare%20D1-5A67D8" alt="Cloudflare D1" />
  <img src="https://img.shields.io/badge/output-SVG%20Badge-2ECC71" alt="SVG Badge" />
  <img src="https://img.shields.io/badge/deploy-serverless-24292F" alt="serverless" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
</p>

中文 | [English](README_EN.md)

**cloudflare-d1-visit-counter** 是一个基于 **Cloudflare Workers + Cloudflare D1** 的开源、自托管、低成本访问计数器。它可以为 GitHub README、个人网站、博客、文档站和项目主页生成 SVG 访问徽章，并提供可视化 Dashboard、公开 status page 和 history chart。


## 快速开始

- [5 分钟部署](#快速部署)
- [创建第一个访问徽章](#看板功能)
- [复制 Markdown / HTML / Image URL](#使用示例)
- [查看公开状态页](#状态页)
- [了解 API](#api)
- [安全与隐私说明](#安全与隐私)

## 目录

- [为什么做这个项目](#为什么做这个项目)
- [核心亮点](#核心亮点)
- [关键词能力矩阵](#关键词能力矩阵)
- [适合场景](#适合场景)
- [项目结构](#项目结构)
- [工作逻辑](#工作逻辑)
- [快速部署](#快速部署)
- [看板功能](#看板功能)
- [使用示例](#使用示例)
- [API](#api)
- [数据结构](#数据结构)
- [安全与隐私](#安全与隐私)
- [成本与性能设计](#成本与性能设计)
- [为什么它更适合开源自部署](#为什么它更适合开源自部署)
- [Roadmap](#roadmap)
- [License](#license)

项目地址：[FuTseYi/cloudflare-d1-visit-counter](https://github.com/FuTseYi/cloudflare-d1-visit-counter)  
作者：[FuTseYi](https://github.com/FuTseYi)

## 为什么做这个项目

市面上的访问徽章项目通常只解决“显示访问量”这一个点，但在自部署、管理、防滥用、状态页、样式保存、低成本运行之间很难同时兼顾。

`cloudflare-d1-visit-counter` 是一个从自托管场景出发设计的全新项目：既能快速生成 Markdown / HTML / Image URL，又能保存徽章样式、管理已创建计数器，并为每个计数器自动提供公开状态页。它强调数据自有、部署简单、权限边界清晰和长期运行成本可控。

## 核心亮点

| 能力 | 本项目 | 常见公开服务 / 简单开源计数器 |
| --- | --- | --- |
| 自托管 | 使用你自己的 Cloudflare Worker、D1、域名 | 多数依赖公共服务域名，服务可用性不可控 |
| 创建保护 | `AUTH_CODE` 保护 create / list / delete | 很多 badge URL 可直接生成或缺少管理权限边界 |
| 防滥用 | 公开 badge URL 不会自动创建新 counter | 容易被随机 path 填充数据或污染统计 |
| 管理看板 | 可创建、加载、复用、批量删除 | 常见方案只给 URL，没有完整管理面板 |
| 统计页 | 每个 counter 自动拥有公开 status page | 很多项目只返回 badge，没有可读状态页 |
| 样式保存 | 保存 Badge Label、颜色、样式、类型 | 重新生成时往往只靠 URL 参数 |
| 数据隔离 | URL / counter key 是真实数据键，Badge Label 只是显示名 | 常见说明容易把显示名和数据键混在一起 |
| 中文支持 | counter key 支持中文、URL、页面名、仓库路径 | 部分项目只推荐英文 keyword |
| 成本控制 | 单表 D1、无外部依赖、无静态资源请求、热路径极简 | 有些方案需要额外服务、KV、Action 或外部托管 |
| 兼容性 | 同时保留 `/api/combined`、path-style SVG、JSON、history chart | 很多项目只支持单一输出格式 |

## 关键词能力矩阵

| 搜索关键词 | 本项目对应能力 |
| --- | --- |
| Cloudflare Workers visitor counter | Worker 原生运行，无服务器维护。 |
| Cloudflare D1 visit counter | D1 单表存储总量、每日访问量和徽章配置。 |
| GitHub README visitor badge | 直接输出可粘贴到 README 的 Markdown badge。 |
| self-hosted visitor badge | 使用自己的域名、Worker 和 D1，数据自有。 |
| SVG hit counter | 返回轻量 SVG 徽章，适合 README、博客和文档站。 |
| visitor badge status page | 每个 counter 自动拥有公开状态页和趋势图。 |
| open source badge generator | 内置 Dashboard，可生成 Markdown、HTML、Image URL。 |
| Shields style badge | 支持 `flat`、`flat-square`、`plastic`、`for-the-badge`、`social`。 |
| website visit counter | 支持 URL、页面名、仓库路径、中文 key 等统计对象。 |
| low cost Cloudflare counter | 无外部依赖、无静态资源请求、公开 URL 不自动创建 counter。 |
## 适合场景

- GitHub README 访问徽章
- 个人主页、博客、文档站访问计数
- 项目页面访问量展示
- 多页面共用相同 Badge Label，但分别统计不同页面数据
- 想自己掌控域名、数据库和部署成本的开源项目维护者

## 项目结构

```text
cloudflare-d1-visit-counter/
├─ worker.js
├─ README.md
└─ README_EN.md
```

只需要核心文件即可运行，不需要构建工具、前端框架、npm 依赖或静态资源目录。

## 工作逻辑

本项目把“统计对象”和“徽章显示名”分开：

| 名称 | 作用 |
| --- | --- |
| URL / counter key | 真实数据键，决定哪个计数器和状态页被更新。 |
| Badge Label | 只控制徽章上显示的文字，不影响统计数据归属。 |

例如你可以在不同页面都显示 `Visitors`，但每个页面使用不同 counter key：

| 页面 | Counter key | Badge Label | 统计数据 |
| --- | --- | --- | --- |
| 首页 | `https://example.com/` | `Visitors` | 首页访问量 |
| 博客 | `https://example.com/blog` | `Visitors` | 博客访问量 |
| GitHub 仓库 | `FuTseYi/cloudflare-d1-visit-counter` | `Visitors` | 仓库访问量 |

公开 badge URL 只会更新已经存在的 counter。你必须先通过看板或 `/api/create` 创建 counter，这样可以避免别人随便改 URL 就在你的 D1 里创建大量垃圾数据。

## 快速部署

### 1. 创建 D1 数据库

在 Cloudflare Dashboard 创建一个 D1 数据库，例如 `hits`，然后在 D1 Console 执行：

```sql
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
);
```

### 2. 创建 Worker

创建一个 Cloudflare Worker，把 `worker.js` 的内容复制到 Worker 编辑器。

### 3. 修改配置

在 `worker.js` 顶部修改：

```js
const ALLOWED_DOMAIN = 'your.domain.com'
const AUTH_CODE = 'change-this-auth-code'
const ENABLE_ALLOWLIST = false
const ALLOWED_PATHS = []
```

| 配置 | 必填 | 说明 |
| --- | --- | --- |
| `ALLOWED_DOMAIN` | 是 | 你的计数器域名，不带 `https://`。其他 Host 会返回 `404`。 |
| `AUTH_CODE` | 是 | 创建、加载、删除 counter 的管理密钥，必须改掉默认值。 |
| `ENABLE_ALLOWLIST` | 否 | 开启后只允许 `ALLOWED_PATHS` 中的 counter key。 |
| `ALLOWED_PATHS` | 否 | 允许使用的 counter key 列表。 |
| `DEFAULT_HISTORY_DAYS` | 否 | legacy history SVG 默认天数。 |
| `MAX_HISTORY_DAYS` | 否 | legacy history SVG 最大天数。 |

### 4. 绑定 D1

在 Worker 设置中添加 D1 binding：

| Binding name | 绑定值 |
| --- | --- |
| `HITS` | 你的 D1 数据库 |

### 5. 绑定自定义域名

给 Worker 添加自定义域名，并确保它和 `ALLOWED_DOMAIN` 一致。

部署完成后访问：

```url
https://your.domain.com/
```

## 看板功能

看板负责创建、预览、生成链接和管理已有 counter。

| 字段 | 说明 |
| --- | --- |
| Auth Code | 只有输入正确 Auth Code 才能创建、加载和删除。 |
| URL | 真实 counter key，可以是 URL、页面名、仓库路径或中文。 |
| Badge Label | 徽章显示名，只影响展示文字。 |
| Label Background | 左侧背景色，默认 `#A4D3EE`。 |
| Count Background | 右侧计数背景色，默认 `#555555`。 |
| Badge Style | `flat`、`flat-square`、`plastic`、`for-the-badge`、`social`。 |
| Badge Type | 默认 `today / total`，也可选 `total only`。 |

生成格式：

| 输出 | 说明 |
| --- | --- |
| Markdown | 只有徽章。 |
| Markdown with status | 徽章带 status page 跳转。 |
| HTML | 徽章带 status page 跳转。 |
| Image URL | 纯 SVG 图片地址。 |
| Status page | 公开统计页地址。 |

`Created Counters` 会显示已创建的 counter、保存的徽章样式、今日 / 总访问量，并支持选择删除。

## 使用示例

### Markdown

```md
![Visitors](https://your.domain.com/api/combined?path=https%3A%2F%2Fexample.com%2F&label=Visitors&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default)
```

### Markdown with status

```md
[![Visitors](https://your.domain.com/api/combined?path=https%3A%2F%2Fexample.com%2F&label=Visitors&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default)](https://your.domain.com/status?path=https%3A%2F%2Fexample.com%2F)
```

### HTML

```html
<a href="https://your.domain.com/status?path=https%3A%2F%2Fexample.com%2F" target="_blank" rel="noopener noreferrer">
  <img src="https://your.domain.com/api/combined?path=https%3A%2F%2Fexample.com%2F&label=Visitors&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default" alt="Visitor badge" />
</a>
```

## API

### 访问徽章

```url
GET /api/combined?path={counterKey}&label={badgeLabel}&labelColor=%23A4D3EE&countColor=%23555555&style=flat&labelStyle=default
```

返回 SVG badge，并让已存在的 counter 访问量 +1。

| 参数 | 别名 | 说明 |
| --- | --- | --- |
| `path` | `counter` | counter key，必填。 |
| `label` | `title` | 徽章显示名。 |
| `labelColor` | `title_bg` | 左侧背景色，支持十六进制和 Shields 命名色。 |
| `countColor` | `count_bg` | 右侧背景色，支持十六进制和 Shields 命名色。 |
| `style` | - | `flat`、`flat-square`、`plastic`、`for-the-badge`、`social`。 |
| `labelStyle` | - | `default` 为 `today / total`，`none` 为 `total only`。 |

### 状态页

```url
GET /status?path={counterKey}
```

公开展示今日访问量、总访问量和最近 30 天趋势。

### 创建或更新 counter

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

### 加载已创建 counter

```bash
curl -X POST https://your.domain.com/api/list \
  -H "Content-Type: application/json" \
  -d '{"authCode":"your-auth-code"}'
```

### 删除 counter

```bash
curl -X POST https://your.domain.com/api/delete \
  -H "Content-Type: application/json" \
  -d '{"counter":"https://example.com/","authCode":"your-auth-code"}'
```

删除会移除总访问量、每日趋势数据和保存的徽章配置。

### 兼容接口

```url
GET /api/monthly?counter={counterKey}
GET /{counterKey}.svg?action=hit
GET /{counterKey}?action=view
GET /history/{counterKey}.svg?days=30&chartType=bar
GET /chart/{counterKey}.svg?days=30&chartType=scatter
```

推荐新项目优先使用 `/api/combined` 和 `/status`，因为它们和看板输出完全一致。

## 数据结构

只使用一个 D1 表：

```sql
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
);
```

| Key pattern | 说明 |
| --- | --- |
| `{counter}:total` | 总访问量。 |
| `{counter}:daily:{YYYY-MM-DD}` | 每日访问量。 |
| `{counter}:meta:config` | 保存的徽章配置。 |

## 安全与隐私

- `AUTH_CODE` 只保护管理操作，不会隐藏公开 badge 或 status page。
- badge 和 status page 是公开链接，知道 counter key 的人都可以访问。
- 公开 badge URL 不会自动创建 counter，降低数据库被滥用的风险。
- Worker 不存储 IP、User-Agent、Referer、Cookie 或访客身份信息。
- 如果你只想允许固定页面统计，开启 `ENABLE_ALLOWLIST`。
- 不要把 `AUTH_CODE` 写进 README、前端源码或公开 issue。

## 成本与性能设计

本项目专门为 Cloudflare 免费层和低成本运行设计：

- 热路径只做总访问量和每日访问量两次 D1 写入。
- SVG 直接在 Worker 内生成，无图片存储和静态资源请求。
- favicon 使用内联 SVG data URL，不增加额外请求。
- 没有公开自动创建 counter，避免垃圾 key 拉高 D1 写入和存储。
- 只用一个 D1 表，避免复杂迁移和额外服务依赖。

Cloudflare D1 按查询和存储计费，Workers 免费层也有请求与 CPU 限额。高流量公开 badge 建议结合 Cloudflare 官方价格与限制评估部署规模。

## 为什么它更适合开源自部署

| 对比维度 | cloudflare-d1-visit-counter 的设计 |
| --- | --- |
| 部署形态 | 单文件 Worker，D1 绑定后即可运行，不需要后端服务器。 |
| 数据归属 | 数据保存在你自己的 Cloudflare D1 中，域名和数据都由自己控制。 |
| 管理能力 | 内置创建、加载、复用、选择删除和批量删除流程。 |
| 滥用控制 | 公开 badge URL 不会自动创建 counter，减少垃圾 key 和无意义写入。 |
| 展示能力 | 同时提供 SVG badge、Markdown、HTML、Image URL 和 Status page。 |
| 状态页 | 每个 counter 自动拥有趋势页，不需要额外配置。 |
| 样式持久化 | 徽章名、颜色、样式和显示类型会保存，加载时能恢复。 |
| 成本效率 | 只使用一个 D1 表，热路径只做必要写入，无外部资源依赖。 |

## Roadmap

- [ ] 增加 `wrangler.toml` 示例。
- [ ] 增加一键初始化 SQL 文档。
- [ ] 增加截图和部署演示图。
- [ ] 增加可选 Turnstile / rate limit 说明。
- [ ] 增加多语言 UI 文案选项。

## License

This project is licensed under the [MIT License](LICENSE).




