#!/usr/bin/env node
/**
 * check-i18n — extracts static `t('...')` keys from src/**\/*.{ts,tsx} and reports
 * keys missing from each locale (src/i18n/locales/{zh,en,es}.ts).
 * Exit code 1 when any key is missing. Dynamic keys (template literals) are skipped.
 *
 * Usage: node scripts/check-i18n.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const LOCALES = ['en', 'es', 'zh'];
const LOCALE_DIR = join(SRC, 'i18n', 'locales');

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(name) && !/\.d\.ts$/.test(name)) {
      out.push(p);
    }
  }
  return out;
};

// Matches t('key') / t("key") — not template literals (dynamic keys are skipped).
const CALL_RE = /(?<![\w$.])t\(\s*(['"])([^'"\\]+)\1\s*[,)]/g;
// Matches locale entries: 'key': '...' or "key": "..."
const ENTRY_RE = /^\s*(['"])([^'"]+)\1\s*:/gm;

const loadLocaleKeys = (lang) => {
  const src = readFileSync(join(LOCALE_DIR, `${lang}.ts`), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(ENTRY_RE)) keys.add(m[2]);
  return keys;
};

const usages = new Map(); // key → [file:line]
for (const file of walk(SRC)) {
  if (file.startsWith(LOCALE_DIR)) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(CALL_RE)) {
    const key = m[2];
    const line = text.slice(0, m.index).split('\n').length;
    if (!usages.has(key)) usages.set(key, []);
    usages.get(key).push(`${relative(ROOT, file)}:${line}`);
  }
}

let failed = false;
for (const lang of LOCALES) {
  const keys = loadLocaleKeys(lang);
  const missing = [...usages.keys()].filter((k) => !keys.has(k)).sort();
  if (missing.length === 0) {
    console.log(`[i18n] ${lang}: ok (${usages.size} keys used, ${keys.size} defined)`);
    continue;
  }
  failed = true;
  console.log(`[i18n] ${lang}: ${missing.length} missing key(s)`);
  for (const k of missing) {
    console.log(`  - ${k}  (${usages.get(k).slice(0, 3).join(', ')}${usages.get(k).length > 3 ? ', …' : ''})`);
  }
}

// Locale parity: keys defined in one locale but not another.
const defined = Object.fromEntries(LOCALES.map((l) => [l, loadLocaleKeys(l)]));
const union = new Set(LOCALES.flatMap((l) => [...defined[l]]));
for (const lang of LOCALES) {
  const gaps = [...union].filter((k) => !defined[lang].has(k)).sort();
  if (gaps.length) {
    failed = true;
    console.log(`[i18n] ${lang}: ${gaps.length} key(s) defined in other locales but not here`);
    for (const k of gaps) console.log(`  - ${k}`);
  }
}

process.exit(failed ? 1 : 0);
