# hyunseob.me

Personal link hub for [hyunseob.me](https://hyunseob.me) — Command Palette style, zero-build static site.

## Edit links

Edit [`public/links.json`](public/links.json) to update profile info, links, icons, or keyboard shortcuts.

## Local preview

```bash
python3 -m http.server 8787 -d public
```

## Deploy (Cloudflare)

- **Cloudflare Pages**: Connect this GitHub repo with build output directory `public` (no build command).
- **Cloudflare Workers Static Assets**: `npx wrangler deploy`
- **DNS note**: Keep existing Zoho Mail `MX` and `TXT` (SPF/DKIM) records intact when connecting `hyunseob.me`.
