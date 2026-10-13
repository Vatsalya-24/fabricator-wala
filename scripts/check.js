#!/usr/bin/env node
'use strict';
// Quality gate for CI. Run after build: npm run check

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const readJSON = (...p) => JSON.parse(read(...p));
const LANGS = ['en', 'hi', 'mr'];
const MAX_KB = 120;

const errors = [];
const warnings = [];
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) errors.push(msg);
};

// ---- config ----
const site = readJSON('site.config.json');
for (const k of ['name', 'city', 'region', 'country', 'phone', 'countryCode', 'waMessage', 'title', 'description', 'themeColor']) {
  ok(typeof site[k] === 'string' && site[k].trim(), `site.config.json: "${k}" is missing or empty`);
}
ok(/^\d{10}$/.test(site.phone || ''), 'site.config.json: "phone" must be exactly 10 digits (no +91, no spaces)');
ok(/^\d{1,3}$/.test(site.countryCode || ''), 'site.config.json: "countryCode" must be digits only, e.g. "91"');
ok(!site.siteUrl || /^https:\/\/[^/]+/.test(site.siteUrl), 'site.config.json: "siteUrl" must start with https://');
ok(Array.isArray(site.areas) && site.areas.length > 0, 'site.config.json: "areas" must be a non-empty list');

// ---- i18n parity ----
const dicts = Object.fromEntries(LANGS.map((l) => [l, readJSON('src', 'i18n', `${l}.json`)]));
const enKeys = Object.keys(dicts.en);
const tags = (s) => (s.match(/<[^>]+>/g) || []).join('');
for (const l of LANGS) {
  const keys = Object.keys(dicts[l]);
  for (const k of enKeys) ok(k in dicts[l], `i18n/${l}.json: missing key "${k}"`);
  for (const k of keys) ok(k in dicts.en, `i18n/${l}.json: extra key "${k}" not in en.json`);
  for (const k of keys) {
    const v = dicts[l][k];
    ok(typeof v === 'string' && v.trim(), `i18n/${l}.json: "${k}" is empty`);
    if (l !== 'en' && typeof v === 'string' && typeof dicts.en[k] === 'string') {
      ok(tags(v) === tags(dicts.en[k]), `i18n/${l}.json: "${k}" has different HTML tags than en.json`);
    }
    for (const t of v.match(/\{\{\w+\}\}/g) || []) {
      ok(['{{name}}', '{{city}}', '{{region}}'].includes(t), `i18n/${l}.json: "${k}" uses unknown placeholder ${t} (allowed: name, city, region)`);
    }
  }
}

// ---- data ----
const services = readJSON('src', 'data', 'services.json');
const seen = new Set();
for (const s of services) {
  ok(s.id && s.icon, `services.json: every service needs "id" and "icon" (${JSON.stringify(s)})`);
  ok(!seen.has(s.id), `services.json: duplicate id "${s.id}"`);
  seen.add(s.id);
  ok(`svc_${s.id}` in dicts.en, `i18n: missing "svc_${s.id}" for service "${s.id}"`);
}
const reviews = readJSON('src', 'data', 'reviews.json');
for (const r of reviews) ok(r.name && r.area, `reviews.json: every review needs "name" and "area"`);

// ---- template keys ----
const tpl = read('src', 'index.template.html');
// "rv" and "ph" are used by fragments that build.js generates (reviews, gallery placeholders)
const used = new Set([...services.map((s) => `svc_${s.id}`), 'rv', 'ph']);
for (const m of tpl.matchAll(/data-(?:t|p)="([^"]+)"/g)) {
  used.add(m[1]);
  ok(m[1] in dicts.en, `template: uses unknown i18n key "${m[1]}"`);
}
for (const k of enKeys) if (!used.has(k)) warnings.push(`i18n: key "${k}" is not used anywhere`);

// ---- built output ----
const distFile = path.join(root, 'dist', 'index.html');
ok(fs.existsSync(distFile), 'dist/index.html not found. Run "npm run build" first');
if (fs.existsSync(distFile)) {
  const html = fs.readFileSync(distFile, 'utf8');
  const kb = Buffer.byteLength(html) / 1024;
  ok(kb <= MAX_KB, `dist/index.html is ${kb.toFixed(1)} KB, over the ${MAX_KB} KB budget`);
  ok(!/\{\{\w+\}\}/.test(html), 'dist/index.html still contains {{placeholders}}');
  ok(html.includes(`<title>${site.title.replace(/&/g, '&amp;')}</title>`), 'dist/index.html: <title> does not match site.config.json');
  ok(html.includes(`name="description" content="`), 'dist/index.html: meta description missing');
  ok(html.includes(`href="tel:+${site.countryCode}${site.phone}"`), 'dist/index.html: tel: link missing or wrong');
  ok(html.includes(`https://wa.me/${site.countryCode}${site.phone}?text=`), 'dist/index.html: WhatsApp link missing or wrong');
  ok(!/wa\.me\/91\[/.test(html), 'dist/index.html: broken WhatsApp URL');
  ok(/class="bar"/.test(html), 'dist/index.html: sticky Call/WhatsApp bar missing');
  ok(/name="viewport"/.test(html), 'dist/index.html: viewport meta missing');

  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  ok(!!ld, 'dist/index.html: LocalBusiness JSON-LD missing');
  if (ld) {
    try {
      const j = JSON.parse(ld[1]);
      ok(j['@type'] === 'LocalBusiness' && j.telephone && j.address, 'JSON-LD: LocalBusiness needs telephone and address');
    } catch (e) {
      ok(false, `JSON-LD is not valid JSON: ${e.message}`);
    }
  }

  const empty = html.match(/<(\w+)\b[^>]*\sdata-t="[^"]+"[^>]*><\/\1>/g);
  ok(!empty, `dist/index.html: ${empty ? empty.length : 0} text elements are empty after build`);

  // local images exist
  for (const m of html.matchAll(/<img[^>]+src="(assets\/[^"]+)"/g)) {
    ok(fs.existsSync(path.join(root, 'dist', decodeURIComponent(m[1]))), `missing image file: ${m[1]}`);
  }
}

// ---- report ----
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}
console.log(`All ${checks} checks passed${warnings.length ? ` (${warnings.length} warnings)` : ''}.`);
