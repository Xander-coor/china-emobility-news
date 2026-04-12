const DEFAULT_FEEDS = {
  brand:    { label: '品牌動態', color: '#1a73e8', query: '雅迪 OR 爱玛 OR 绿源 OR 台铃 OR 新日 OR 小牛 OR 九号 OR 春风动力 OR 豪爵 OR 速珂' },
  industry: { label: '行業＆政策', color: '#4338ca', query: '两轮电动 行业 OR 市场 OR 政策 OR 标准 OR 法规' },
  charging: { label: '充電設施',   color: '#0891b2', query: '电动车 换电站 OR 充电桩 OR 换电标准 OR 充电基础设施' },
  robot:    { label: '配送機器人', color: '#92400e', query: '配送机器人 OR 无人配送 OR 末端配送 OR 送货机器人' },
  sharing:  { label: '共享出行',   color: '#15803d', query: '哈啰 OR 美团单车 OR 滴滴青桔 OR 共享单车 OR 共享电单车' },
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password' },
      });
    }

    const { pathname, searchParams } = new URL(request.url);

    // ── GET /news?q=...&num=10 ─────────────────────────────────────
    if (pathname === '/news') {
      const q   = searchParams.get('q');
      const num = parseInt(searchParams.get('num') || '10', 10);
      if (!q) return json({ error: 'Missing q' }, 400);
      try {
        const cacheKey = `news:${q}:${num}`;
        const cached = await env.NEWS_CACHE?.get(cacheKey, 'json');
        if (cached) return json(cached);

        const results = await searchSerper(q, num, env);
        await env.NEWS_CACHE?.put(cacheKey, JSON.stringify(results), { expirationTtl: 14400 });
        return json(results);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ── GET /config ────────────────────────────────────────────────
    if (pathname === '/config' && request.method === 'GET') {
      const stored = await env.NEWS_CACHE?.get('config:feeds', 'json');
      return json(stored || DEFAULT_FEEDS);
    }

    // ── POST /config ───────────────────────────────────────────────
    if (pathname === '/config' && request.method === 'POST') {
      const pw = request.headers.get('X-Admin-Password');
      if (pw !== env.ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);
      try {
        const feeds = await request.json();
        await env.NEWS_CACHE?.put('config:feeds', JSON.stringify(feeds));

        // 清除所有新聞快取，讓新關鍵字立即生效
        for (const key of Object.keys(feeds)) {
          const q = feeds[key].query;
          await env.NEWS_CACHE?.delete(`news:${q}:20`);
        }

        return json({ ok: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};

async function searchSerper(q, num = 10, env) {
  const apiKey = env?.SERPER_KEY;
  if (!apiKey) throw new Error('SERPER_KEY not configured');

  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, gl: 'cn', hl: 'zh-cn', num }),
  });
  if (!res.ok) throw new Error(`Serper error ${res.status}`);
  const data = await res.json();

  return (data.news || []).map(item => ({
    title:   item.title   || '',
    snippet: item.snippet || '',
    url:     item.link    || '',
    source:  item.source  || '',
    date:    item.date    || '',
  }));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
