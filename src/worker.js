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

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

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
      const country = (req.cf && typeof req.cf.country === "string") ? req.cf.country : null;
      const device = detectDevice(ua);

      if (env.DB) {
        ctx.waitUntil(
          env.DB.prepare(
            "INSERT INTO link_events (at, date, kind, target, url, ref_host, country, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          )
            .bind(at, date, kind, target, targetUrl, refHost, country, device)
            .run()
            .catch(() => {})
        );
      }

      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }

    return env.ASSETS.fetch(req);
  },
};
