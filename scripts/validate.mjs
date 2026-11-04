// Validates Baggo catalog files.
//
//   npm run validate                 every file in templates/ and examples/
//   npm run validate -- my.json      the files you name
//   npm run validate -- --check-urls my.json
//                                    also fetch every picture and report any
//                                    that does not answer (needs network)
//
// Two layers, because JSON Schema cannot say everything:
//
//   1. The file against schema/catalog.schema.json.
//   2. What a schema cannot express: slugs unique within their list, every
//      item's category present in the file, a relative $schema that really
//      points at the schema, and (for a standalone file) every picture an
//      absolute https:// address, since a relative path has nothing to
//      resolve against and Baggo drops it.
//
// Exit code 1 when anything fails. Length limits Baggo clamps rather than
// rejects are reported as warnings and do not fail the run.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(root, 'schema', 'catalog.schema.json');

const args = process.argv.slice(2);
const named = args.filter((a) => !a.startsWith('--'));
const checkUrls = args.includes('--check-urls');

const MAX_BYTES = 5 * 1024 * 1024; // Baggo refuses a catalog file over 5 MB.
const LIMITS = { item: 84, category: 52, note: 356 }; // clamped, not rejected

// Icon sets whose licence asks for credit.
const ATTRIBUTION_SETS = [
  { name: 'OpenMoji', licence: 'CC BY-SA 4.0', host: /openmoji/i, words: ['openmoji'] },
  { name: 'game-icons.net', licence: 'CC BY 3.0', host: /game-icons/i, words: ['game-icons'] },
];

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));

function defaultFiles() {
  const out = [];
  for (const dir of ['templates', 'examples']) {
    const full = join(root, dir);
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full).sort()) {
      if (f.endsWith('.json')) out.push(join(full, f));
    }
  }
  return out;
}

/** Every string the catalog says in some language, with where it sits. */
function* texts(value) {
  if (typeof value === 'string') yield value;
  else if (value && typeof value === 'object') yield* Object.values(value);
}

function duplicates(list, key) {
  const seen = new Set();
  const dup = new Set();
  for (const entry of list ?? []) {
    const k = entry?.[key];
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}

function check(file) {
  const errors = [];
  const warnings = [];
  const raw = readFileSync(file, 'utf8');

  if (Buffer.byteLength(raw) > MAX_BYTES) {
    errors.push('file is over 5 MB, which Baggo refuses');
  }

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    return { errors: [`not valid JSON: ${e.message}`], warnings, urls: [] };
  }

  if (!validate(doc)) {
    for (const e of validate.errors) {
      // anyOf failures arrive as a pile of branch errors; the useful line is
      // the one that names the field.
      if (e.keyword === 'anyOf') continue;
      errors.push(`schema: ${e.instancePath || '/'} ${e.message}`);
    }
  }

  if (typeof doc.$schema === 'string' && !/^https?:/.test(doc.$schema)) {
    const target = resolve(dirname(file), doc.$schema);
    if (!existsSync(target)) {
      errors.push(`$schema "${doc.$schema}" does not point at a file`);
    }
  }

  for (const [list, label] of [
    ['categories', 'category'],
    ['items', 'item'],
    ['pins', 'pin'],
  ]) {
    for (const slug of duplicates(doc[list], 'slug')) {
      errors.push(`duplicate ${label} slug "${slug}"`);
    }
  }

  const categories = new Set((doc.categories ?? []).map((c) => c.slug));
  for (const item of doc.items ?? []) {
    if (!categories.has(item.category)) {
      errors.push(`item "${item.slug}" uses unknown category "${item.category}"`);
    }
  }
  const used = new Set((doc.items ?? []).map((i) => i.category));
  for (const c of categories) {
    if (!used.has(c)) warnings.push(`category "${c}" has no items`);
  }

  const refs = [
    ['icon', doc.icon],
    ...Object.entries(doc.shortcuts ?? {}).map(([k, v]) => [`shortcuts.${k}`, v]),
    ...(doc.pins ?? []).map((p) => [`pin "${p.slug}"`, p.image]),
    ...(doc.categories ?? []).map((c) => [`category "${c.slug}" icon`, c.icon]),
    ...(doc.items ?? []).map((i) => [`item "${i.slug}" image`, i.image]),
  ];
  for (const [where, ref] of refs) {
    // An icon NAME (no dot, no slash) is not a file; leave those alone.
    if (typeof ref !== 'string' || !/[./]/.test(ref)) continue;
    if (!ref.startsWith('https://')) {
      errors.push(`${where} must be an absolute https:// URL in a standalone file: ${ref}`);
    }
  }

  for (const c of doc.categories ?? []) {
    for (const t of texts(c.name)) {
      if (t.length > LIMITS.category) warnings.push(`category "${c.slug}" name is over ${LIMITS.category} characters; Baggo will cut it`);
    }
  }
  for (const i of doc.items ?? []) {
    for (const t of texts(i.name)) {
      if (t.length > LIMITS.item) warnings.push(`item "${i.slug}" name is over ${LIMITS.item} characters; Baggo will cut it`);
    }
    for (const t of texts(i.note)) {
      if (t.length > LIMITS.note) warnings.push(`item "${i.slug}" note is over ${LIMITS.note} characters; Baggo will cut it`);
    }
  }

  const locales = (v) =>
    v && typeof v === 'object' ? Object.keys(v) : [];
  if (doc.default_locale && doc.name && typeof doc.name === 'object' &&
      !locales(doc.name).includes(doc.default_locale)) {
    warnings.push(`default_locale "${doc.default_locale}" is not one of the catalog name's languages`);
  }

  // default_locale is where every map falls back, so each map should have it.
  if (doc.default_locale) {
    const missing = (doc.items ?? []).filter((i) => {
      const l = locales(i.name);
      return l.length && !l.includes(doc.default_locale);
    });
    if (missing.length) {
      const names = missing.slice(0, 3).map((i) => `"${i.slug}"`).join(', ');
      warnings.push(`${missing.length} item name(s) have no "${doc.default_locale}" text (default_locale), e.g. ${names}`);
    }
  }

  // Attribution licences need credit in description or homepage.
  const credit = [...texts(doc.description), doc.homepage ?? ''].join(' ').toLowerCase();
  const urls = refs.map(([, r]) => r).filter((r) => typeof r === 'string');
  for (const set of ATTRIBUTION_SETS) {
    if (urls.some((u) => set.host.test(u)) && !set.words.some((w) => credit.includes(w))) {
      warnings.push(`pictures from ${set.name} (${set.licence}) need credit in description or homepage`);
    }
  }

  return { errors, warnings, urls: [...new Set(urls.filter((u) => u.startsWith('https://')))] };
}

const files = named.length ? named.map((f) => resolve(f)) : defaultFiles();
if (files.length === 0) {
  console.error('No catalog files found.');
  process.exit(1);
}

async function unreachable(urls) {
  const bad = [];
  const queue = [...urls];
  const worker = async () => {
    for (let u; (u = queue.pop()); ) {
      try {
        let r;
        // 429 means "slow down", not "missing": back off and try again.
        for (let attempt = 0; attempt < 4; attempt++) {
          r = await fetch(u, { signal: AbortSignal.timeout(15000) });
          if (r.status !== 429) break;
          await new Promise((ok) => setTimeout(ok, 1000 * 2 ** attempt));
        }
        if (!r.ok) bad.push(`${u} (HTTP ${r.status})`);
      } catch (e) {
        bad.push(`${u} (${e.cause?.code ?? e.message})`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return bad;
}

let failed = 0;
for (const file of files) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    console.error(`✗ ${file}\n    not a file`);
    failed++;
    continue;
  }
  const { errors, warnings, urls = [] } = check(file);
  if (checkUrls) {
    for (const b of await unreachable(urls)) warnings.push(`picture does not answer: ${b}`);
  }
  const name = relative(process.cwd(), file) || file;
  console.log(`${errors.length ? '✗' : '✓'} ${name}`);
  for (const e of errors) console.log(`    error: ${e}`);
  for (const w of warnings) console.log(`    warning: ${w}`);
  if (errors.length) failed++;
}

console.log(failed ? `\n${failed} of ${files.length} failed.` : `\nAll ${files.length} files are valid.`);
process.exit(failed ? 1 : 0);
