const BOT_RE = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|kakaotalk-scrap|slackbot|discordbot|telegrambot|whatsapp|curl|wget|python-requests|headless/i;

function detectDevice(ua) {
  if (!ua) return "desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

function normalizeRef(raw) {
  if (!raw || typeof raw !== "string") return "direct";
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "hyunseob.me" || host.endsWith(".hyunseob.me") || host.endsWith(".workers.dev")) {
      return "direct";
    }
    return host.slice(0, 80);
  } catch {
    return "direct";
  }
}

function kstDate(ms = Date.now()) {
  return new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
}

// 쿠키 없이 일별 고유 방문자(UV)를 추정하는 단방향 해시 (원본 IP는 저장하지 않음)
async function hashVisitor(date, ip, ua) {
  const raw = new TextEncoder().encode(`hyunseob.me|${date}|${ip || "0"}|${(ua || "").slice(0, 120)}`);
  const buf = await crypto.subtle.digest("SHA-256", raw);
  return Array.from(new Uint8Array(buf).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // 최신 공개 유튜브 본편 영상 1건 (slate D1의 yt_videos에서 직접 조회)
    if (url.pathname === "/api/latest-video" && req.method === "GET") {
      if (!env.DB) return new Response(JSON.stringify({ video: null }), { headers: { "content-type": "application/json" } });
      try {
        const row = await env.DB.prepare(
          "SELECT video_id, title, published_at, duration_s, view_count FROM yt_videos WHERE privacy = 'public' AND (duration_s IS NULL OR duration_s > 60) ORDER BY published_at DESC LIMIT 1"
        ).first();
        return new Response(JSON.stringify({ video: row || null }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      } catch {
        return new Response(JSON.stringify({ video: null }), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }

    if (url.pathname === "/api/event" && req.method === "POST") {
      const ua = req.headers.get("user-agent") || "";
      if (BOT_RE.test(ua)) return new Response(null, { status: 204 });

      let body = null;
      try {
        body = await req.json();
      } catch {
        return new Response(null, { status: 400 });
      }

      const kind = body?.kind === "click" ? "click" : body?.kind === "view" ? "view" : null;
      if (!kind) return new Response(null, { status: 400 });

      const now = Date.now();
      const at = new Date(now).toISOString();
      const date = kstDate(now);
      const target = kind === "click" && typeof body.target === "string" ? body.target.trim().slice(0, 100) : null;
      const targetUrl = kind === "click" && typeof body.url === "string" ? body.url.trim().slice(0, 300) : null;
      const refHost = normalizeRef(body.ref);
      const country = req.cf && typeof req.cf.country === "string" ? req.cf.country : null;
      const device = detectDevice(ua);
      const ip = req.headers.get("cf-connecting-ip") || "";
      const visitorHash = await hashVisitor(date, ip, ua);

      if (env.DB) {
        ctx.waitUntil(
          env.DB.prepare(
            "INSERT INTO link_events (at, date, kind, target, url, ref_host, country, device, visitor_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
            .bind(at, date, kind, target, targetUrl, refHost, country, device, visitorHash)
            .run()
            .catch(() => {})
        );
      }

      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }

    return env.ASSETS.fetch(req);
  },
};
