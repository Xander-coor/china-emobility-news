const DEFAULT_FEEDS = {
  brand:    { label: '品牌動態',   color: '#1a73e8', query: '雅迪 OR 爱玛 OR 绿源 OR 台铃 OR 新日 OR 小牛 OR 九号 OR 春风动力 OR 豪爵 OR 速珂' },
  industry: { label: '行業＆政策', color: '#4338ca', query: '两轮电动 行业 OR 市场 OR 政策 OR 标准 OR 法规' },
  moto:     { label: '電動摩托車', color: '#7c3aed', query: '电动摩托车 OR 电摩 OR 两轮电动 摩托' },
  safety:   { label: '安全／事故', color: '#dc2626', query: '电动车 起火 OR 事故 OR 召回 OR 安全隐患 OR 违规' },
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
      const tbs = searchParams.get('tbs') || '';
      if (!q) return json({ error: 'Missing q' }, 400);
      try {
        const cacheKey = `news:${q}:${num}:${tbs}`;
        const cached = await env.NEWS_CACHE?.get(cacheKey, 'json');
        if (cached) return json(cached);

        const results = await searchSerper(q, num, tbs, env);
        await env.NEWS_CACHE?.put(cacheKey, JSON.stringify(results), { expirationTtl: 14400 });
        return json(results);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ── GET /summary?label=...&q=... ───────────────────────────────
    if (pathname === '/summary') {
      const label = searchParams.get('label') || '';
      const q     = searchParams.get('q') || '';
      if (!q) return json({ error: 'Missing q' }, 400);
      try {
        const cacheKey = `summary:${q}`;
        const cached = await env.NEWS_CACHE?.get(cacheKey);
        if (cached) return json({ summary: cached });

        // 抓本週文章
        const articles = await searchSerper(q, 20, 'qdr:w', env);
        if (!articles.length) return json({ summary: null });

        // 組 prompt
        const items = articles.slice(0, 15).map((a, i) =>
          `${i + 1}. ${a.title}${a.snippet ? '：' + a.snippet : ''}`
        ).join('\n');

        const prompt = `以下是「${label}」分類本週的新聞標題與摘要：\n\n${items}\n\n請用繁體中文寫出本週焦點摘要，3到5句話，重點說明本週最重要的趨勢或事件，不要條列、不要標題、直接寫段落。`;

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.CLAUDE_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        const claudeData = await claudeRes.json();
        const summary = claudeData.content?.[0]?.text?.trim() || null;
        if (summary) {
          await env.NEWS_CACHE?.put(cacheKey, summary, { expirationTtl: 43200 }); // 12小時
        }
        return json({ summary });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ── GET /credits ───────────────────────────────────────────────
    if (pathname === '/credits') {
      const pw = request.headers.get('X-Admin-Password');
      if (pw !== env.ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);
      try {
        const res = await fetch('https://google.serper.dev/account', {
          headers: { 'X-API-KEY': env.SERPER_KEY },
        });
        const data = await res.json();
        return json({ balance: data.balance ?? null });
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

async function searchSerper(q, num = 10, tbs = '', env) {
  const apiKey = env?.SERPER_KEY;
  if (!apiKey) throw new Error('SERPER_KEY not configured');

  const body = { q, gl: 'cn', hl: 'zh-cn', num };
  if (tbs) body.tbs = tbs;

  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
