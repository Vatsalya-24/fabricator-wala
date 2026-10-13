# Fabricator Wala website

Mobile-first one-page site for a fabrication service in Nagpur. English, Hindi and Marathi.
No dependencies. Needs Node 20 or newer.

```
npm run dev     # preview at http://localhost:3000, rebuilds when you save
npm test        # build + quality checks (this is what CI runs)
npm run build   # writes dist/ (the folder you publish)
```

## Where to change things

| To change | Edit |
|---|---|
| Phone, WhatsApp message, title, meta description, areas, hours, site URL | `site.config.json` |
| Any text on the page, in any language | `src/i18n/en.json`, `hi.json`, `mr.json` |
| Services (icon + name key) | `src/data/services.json` and add `svc_<id>` to all three i18n files |
| Reviews | `src/data/reviews.json` (set `text` to the real review) |
| Gallery photos | Drop up to 9 `.jpg/.png/.webp` files into `src/assets/gallery/` |
| Layout and colours | `src/index.template.html`, `src/styles.css` |

Set `siteUrl` in `site.config.json` once you have your domain. It adds the canonical link, `sitemap.xml` and the URL in the Local Business schema.

`npm test` fails if a translation key is missing, the phone number is not 10 digits, the page is over 120 KB, a link is broken, or placeholders are left in the output. It never needs a browser.

## Deploy with CI

1. Create a GitHub repo and push this folder to the `main` branch.
2. In the repo go to Settings, Pages, and set Source to "GitHub Actions".
3. Every push to `main` runs `.github/workflows/deploy.yml`: test, then publish `dist/`. Pull requests run the tests only.

Netlify or Cloudflare Pages also work: build command `npm test`, publish directory `dist`.

## Growing into e-commerce

`src/data/services.json` is the start of a catalogue. When you add products, give each one an id, an image, a price and a name key in the i18n files, and have `scripts/build.js` render a product page per item.

A static site can show products and take enquiries on WhatsApp. A cart, online payment (Razorpay or UPI) and order tracking need a backend or a hosted store. Two practical routes:

- Keep this site as the front page and use a hosted shop (Shopify, or WooCommerce) for checkout.
- Move to a framework such as Astro or Next.js. The config, i18n files and data files here carry over unchanged, and the CI workflow stays the same apart from the build command.
