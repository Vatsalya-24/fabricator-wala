#!/usr/bin/env node
'use strict';
// Static build: src/ + site.config.json  ->  dist/index.html (one self-contained page)
// Zero dependencies. Run: npm run build

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = (...p) => path.join(root, 'src', ...p);
const dist = path.join(root, 'dist');
const LANGS = ['en', 'hi', 'mr'];

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Safe to embed inside <script> tags
const forScript = (o) =>
  JSON.stringify(o)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029');

// Replace {{key}} for the keys in vals only; other placeholders are left for a later pass.
const fill = (str, vals) => str.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vals ? vals[k] : m));

function build() {
  const site = readJSON(path.join(root, 'site.config.json'));
  const services = readJSON(src('data', 'services.json'));
  const reviews = readJSON(src('data', 'reviews.json'));

  // ---- i18n (values may use {{name}}, {{city}}, {{region}}) ----
  const vars = { name: site.name, city: site.city, region: site.region };
  const i18n = {};
  for (const l of LANGS) {
    const dict = readJSON(src('i18n', `${l}.json`));
    i18n[l] = Object.fromEntries(Object.entries(dict).map(([k, v]) => [k, fill(v, vars)]));
  }
  const en = i18n.en;

  // ---- derived values ----
  const full = `${site.countryCode}${site.phone}`;
  const waBase = `https://wa.me/${full}`;
  const wa = `${waBase}?text=${encodeURIComponent(site.waMessage)}`;
  const tel = `tel:+${full}`;
  const words = site.name.split(' ');
  const last = words.pop();
  const logo = `${esc(words.join(' '))} <b>${esc(last)}</b>`;
  const base = (site.siteUrl || '').replace(/\/+$/, '');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
    description: site.schemaDescription || site.description,
    telephone: `+${site.countryCode}-${site.phone}`,
    areaServed: site.city,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.city,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: site.hours.days,
      opens: site.hours.opens,
      closes: site.hours.closes,
    },
    priceRange: '$$',
  };
  if (base) schema.url = `${base}/`;

  // ---- generated fragments ----
  const servicesHtml = services
    .map((s) => `<div class="tile"><i>${s.icon}</i><span data-t="svc_${s.id}"></span></div>`)
    .join('\n');

  const areasHtml = site.areas.map((a) => `<span>${esc(a)}</span>`).join('');

  const reviewsHtml = reviews
    .map(
      (r) =>
        `<div class="rev"><div class="st">★★★★★</div><p${r.text ? '' : ' data-t="rv"'}>${
          r.text ? esc(r.text) : ''
        }</p><small>${esc(r.name)}, ${esc(r.area)}</small></div>`
    )
    .join('\n');

  const gdir = src('assets', 'gallery');
  const photos = fs.existsSync(gdir)
    ? fs.readdirSync(gdir).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort().slice(0, 9)
    : [];
  const galleryHtml = (photos.length
    ? photos.map(
        (f, i) =>
          `<div class="ph has"><img src="assets/gallery/${encodeURIComponent(f)}" alt="${esc(site.name)} work in ${esc(
            site.city
          )} ${i + 1}" loading="lazy" decoding="async"></div>`
      )
    : [1, 2, 3, 4, 5, 6].map((n) => `<div class="ph"><span><span data-t="ph"></span> ${n}</span></div>`)
  ).join('\n');

  // ---- render ----
  let html = fs.readFileSync(src('index.template.html'), 'utf8');
  html = fill(html, { services: servicesHtml, areas: areasHtml, reviews: reviewsHtml, gallery: galleryHtml });

  // Bake English text into the HTML (good for SEO and no flash of empty text).
  html = html.replace(/(<(\w+)\b[^>]*?\sdata-t="([^"]+)"[^>]*>)(<\/\2>)/g, (m, open, tag, key, close) => {
    if (!(key in en)) throw new Error(`Missing i18n key "${key}" in en.json`);
    return open + en[key] + close;
  });
  html = html.replace(/(<input\b[^>]*?)\sdata-p="([^"]+)"([^>]*>)/g, (m, a, key, b) => {
    if (!(key in en)) throw new Error(`Missing i18n key "${key}" in en.json`);
    return `${a} data-p="${key}" placeholder="${esc(en[key])}"${b}`;
  });

  html = fill(html, {
    title: esc(site.title),
    description: esc(site.description),
    themeColor: site.themeColor,
    canonical: base ? `<link rel="canonical" href="${esc(base)}/">` : '',
    schema: JSON.stringify(schema).replace(/</g, '\\u003c'),
    css: fs.readFileSync(src('styles.css'), 'utf8').trim(),
    js: fs.readFileSync(src('app.js'), 'utf8').trim(),
    i18n: forScript(i18n),
    site: forScript({ waBase }),
    logo,
    tel,
    wa,
    phone: esc(site.phone),
    name: esc(site.name),
    year: String(new Date().getFullYear()),
  });

  const left = html.match(/\{\{\w+\}\}/g);
  if (left) throw new Error(`Unreplaced placeholders: ${[...new Set(left)].join(', ')}`);

  // ---- write dist ----
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  if (fs.existsSync(src('assets'))) {
    fs.cpSync(src('assets'), path.join(dist, 'assets'), {
      recursive: true,
      filter: (p) => path.basename(p) !== '.gitkeep',
    });
  }
  fs.writeFileSync(
    path.join(dist, 'robots.txt'),
    `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`
  );
  if (base) {
    fs.writeFileSync(
      path.join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>\n`
    );
  }

  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`Built dist/index.html (${kb} KB, ${photos.length} gallery photos, ${services.length} services)`);
}

if (require.main === module) {
  try {
    build();
  } catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
  }
}

module.exports = { build };
