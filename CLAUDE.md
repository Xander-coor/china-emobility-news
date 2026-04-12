# 微出行情報站 — 專案脈絡

## 專案概述
中國電動微出行新聞聚合器。抓取 Google News RSS，按分類顯示文章標題。
- **前端**：`index.html`（GitHub Pages：github.com/Xander-coor/china-emobility-news）
- **Worker**：`/Users/jorgelo/Desktop/China Mobility Worker/src/index.js`（Cloudflare Workers：emobility-fetcher.pichia47.workers.dev）

## 目前狀態（2026-04-12）
**純標題卡片**——摘要功能暫時關閉。文章點擊後開新頁讀原文。

## 已知問題：摘要功能無法運作

### 根本原因
Google News URL 格式（CBMi... / AU_yqL）需要透過 Google batchexecute API 解碼才能得到真實文章 URL。Cloudflare Worker 的機房 IP 被 Google 封鎖，無法穩定呼叫。

### 已嘗試的方案（全部失敗）
1. **batchexecute 直接解碼** — Cloudflare IP 被封，1-2 次後失效
2. **DuckDuckGo 搜尋** — 機房 IP 被限速
3. **Bing 搜尋** — 機房 IP 被限速
4. **Baidu** — 非中國 IP 直接 302 到 CAPTCHA
5. **Jina AI Reader** — 封鎖 news.google.com
6. **Google Custom Search API（CSE）** — 持續 403 "This project does not have the access to Custom Search JSON API"，原因不明，疑似新 Cloud 帳號限制（Google 論壇有相同案例）
7. **換新 Cloud 專案** — 同樣 403
8. **升級帳戶（免費試用→付費）** — 同樣 403

### Google CSE 設定（等待可用）
- API Key（My Project 71330）：`AIzaSyAC2YtUc2McRWc1NnHgmNKiwie5twlRViQ`（目前 403，需等 Google 解除新帳號限制）
- Search Engine ID (cx)：`04b4e2956075c4db8`
- 已加入 30 個中文媒體域名
- Cloud 專案：My Project 71330

### 下一步選項
1. **等幾天** — Google 論壇顯示新帳號 403 有時會自動解除
2. **換到非機房 IP 的平台**（AWS Lambda 勝算稍高，但需重建環境）
3. **接受現狀** — 純瀏覽，無摘要

## 程式架構

### index.html 重要函數
- `loadFeed(feedKey)` — 抓 RSS，用 rss2json.com 轉 JSON
- `parseItems(items, feedKey)` — 解析 RSS items，提取 title/source/date/description
- `renderCards(articles, feedKey)` — 渲染卡片 HTML（目前只有標題）
- `summarizeAll` / `summarizeWithText` — 已停用（保留在代碼中但不被呼叫）

### Worker (index.js) 重要函數
- `batchResolve(articles)` — POST 端點，批量解析 Google News URL
- `resolveViaCustomSearch(title, source)` — 呼叫 Google CSE（目前 403）
- `fetchText(url)` — 用 HTMLRewriter 抓文章正文
- GET 端點（legacy）— 單篇文章，呼叫舊的 batchexecute / DDG / Bing

### RSS 分類（FEEDS）
品牌動態 / 行業政策 / 充電設施 / 配送機器人 / 共享出行 / 電動兩輪車 / 電動汽車

## 注意事項
- Claude API key 已從代碼移除（摘要功能停用，不需要）
- Google API key 已從 Worker 移除（CSE 暫時無法使用）
- 如要重新啟用摘要，需重新加入兩個 key 並修復 CSE 403
- Worker 已部署，但 GET 端點的 batchexecute/DDG/Bing fallback 仍在（供日後參考）
