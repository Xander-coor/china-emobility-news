# 微出行情報站 — 專案脈絡

## 專案概述
中國電動微出行新聞聚合器。用 Serper News API 搜尋新聞，按分類顯示文章標題與摘要。
- **前端**：`index.html`（GitHub Pages：github.com/Xander-coor/china-emobility-news）
- **Worker**：`src/index.js`（Cloudflare Workers：emobility-fetcher-production.pichia47.workers.dev，用 `npx wrangler deploy --env production` 部署）

## 目前狀態（2026-04-12）
**Serper News API 架構**——每張卡片顯示標題 + Google 從文章內文抽出的 2-3 句真實摘要。

## 架構

### 資料流
```
前端 → Worker /news?q=...&num=20 → Serper News API → 真實文章 URL + 摘要
```

### index.html 重要部分
- `FEEDS` — 5 個分類的搜尋關鍵詞與顏色設定
- `SOURCE_TIER` — 媒體梯隊對照表（T1 人民日報/新華網 → T5 搜狐/中華網）
- `SOURCE_BLACKLIST` — 過濾聯合報、Porsche Newsroom
- `loadFeed(feedKey)` — 呼叫 Worker `/news` 端點，過濾黑名單，按梯隊排序後渲染
- `renderCards(articles, feedKey)` — 渲染卡片，顯示標題 + snippet

### Worker (index.js) 重要端點
- `GET /news?q=...&num=...` — 呼叫 Serper API，回傳 `{title, snippet, url, source, date}[]`，結果快取 4 小時
- `GET /config` — 讀取 KV 中的分類設定，無設定時回傳預設值
- `POST /config` — 寫入新分類設定到 KV，需帶 `X-Admin-Password` header，同時清除相關新聞快取

### 分類與搜尋關鍵字（FEEDS）

| 分類 | 顏色 | 搜尋關鍵字 |
|------|------|-----------|
| 品牌動態 | #1a73e8 | 雅迪 OR 爱玛 OR 绿源 OR 台铃 OR 新日 OR 小牛 OR 九号 OR 春风动力 OR 豪爵 OR 速珂 |
| 行業＆政策 | #4338ca | 两轮电动 行业 OR 市场 OR 政策 OR 标准 OR 法规 |
| 充電設施 | #0891b2 | 电动车 换电站 OR 充电桩 OR 换电标准 OR 充电基础设施 |
| 配送機器人 | #92400e | 配送机器人 OR 无人配送 OR 末端配送 OR 送货机器人 |
| 共享出行 | #15803d | 哈啰 OR 美团单车 OR 滴滴青桔 OR 共享单车 OR 共享电单车 |

## 頁面

| 頁面 | 網址 | 說明 |
|------|------|------|
| 主頁 | https://xander-coor.github.io/china-emobility-news/ | 新聞瀏覽 |
| 管理頁 | https://xander-coor.github.io/china-emobility-news/admin.html | 關鍵字管理，密碼：`!Aihcipol74` |

### 管理頁使用方式
1. 輸入密碼登入
2. 每個分類下可新增或刪除關鍵字
3. 按「儲存所有變更」後自動清除 KV 快取，下次載入立即生效

## 外部服務

| 服務 | 用途 | 管理網址 |
|------|------|---------|
| GitHub Pages | 前端靜態網站託管 | github.com/Xander-coor/china-emobility-news |
| Cloudflare Workers | 後端 API，隱藏 Serper key、處理 CORS | dash.cloudflare.com |
| Cloudflare KV | 快取搜尋結果（4小時 TTL），減少 Serper 用量 | dash.cloudflare.com → Storage & databases → KV |
| Serper.dev | Google 搜尋 API 代理，取得新聞標題與摘要 | serper.dev |

## API Keys
- **Serper API Key**：`9ce18c03aabe54e3cdc1292dd0ca987fd6daa4df`（Worker env var：`SERPER_KEY`）
- **Serper 用量**：免費 2,500 次（一次性，不 renew）；每次完整載入用 5 次
- **付費方案**：$50 買 50,000 次（約可載入 10,000 次）

## 已放棄的摘要方案（不要再試）
以下全部失敗，不要重提：
1. **Google batchexecute** — Cloudflare IP 被封
2. **DuckDuckGo 搜尋** — 機房 IP 被限速
3. **Bing 搜尋** — 機房 IP 被限速
4. **Baidu** — 非中國 IP 直接 302 到 CAPTCHA
5. **Jina AI Reader** — 封鎖 news.google.com
6. **Google CSE** — 2026-01-20 起新帳號全面 403，無法解決
7. **NewsAPI** — snippet 內容等同標題，無實質摘要
8. **直接媒體 RSS** — 中文媒體大多已停止維護 RSS（澎湃、財聯社、21財經等全部 404）

## 媒體梯隊
- **T1**：人民日報、新華網、中國新聞網
- **T2**：財新、經濟觀察網、21財經、Fortune Business Insights
- **T3**：汽車之家、財聯社、澎湃新聞、每日經濟新聞、國際充電網
- **T4**：新浪財經、東方財富、上海觀察、京報網、鳳凰科技
- **T5**：搜狐、中華網、DoNews 等

## 資料流角色說明

### Google 的角色
Google 爬蟲持續抓取中文新聞網站內容並建立索引。當用戶搜尋時，Google 會從索引中回傳文章標題與從內文抽出的 2-3 句摘要片段。本專案的摘要內容來源就是 Google 已整理好的搜尋結果，不是直接爬中國網站。

### Serper 的角色
Serper 是 Google 搜尋的 API 代理。Google 本身沒有公開搜尋 API，Serper 靠維護自己的爬蟲基礎設施與 IP 輪換去查 Google，將結果以乾淨的 JSON 格式回傳。付費買的是「不被 Google 封鎖」的能力。

### 為何不需要翻牆
瀏覽器只連 GitHub Pages + Cloudflare Worker，Worker 呼叫 Serper，Serper 查 Google。整條鏈路沒有直接連中國網站。點文章連結後的全文頁面（新浪、財聯社等）在台灣/香港通常可直接開，在其他地區不一定。

## 注意事項
- Google News RSS 本質上只提供標題，description 欄位為空，不要嘗試用它取得摘要
- Serper 回傳的 date 欄位是「2 天前」這種相對格式，直接顯示即可
