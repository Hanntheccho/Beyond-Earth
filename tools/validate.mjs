#!/usr/bin/env node
// Project sanity checks. Put this file in tools/ and run it from anywhere:
//
//   node tools/validate.mjs          errors and warnings
//   node tools/validate.mjs --info   also lists POI stubs and marker/panel links
//
// Errors are things that break the page and make the exit code 1. Warnings are
// suspicious but not fatal. Needs Node 18 or newer, and no packages.
//
// What it cannot do: it checks syntax, not undefined variables. For that class
// of bug (a leftover constant after a rename, say) use ESLint with "no-undef".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOW_INFO = process.argv.includes('--info');

const errors = [];
const warnings = [];
const infos = [];
const error = (area, message) => errors.push(`[${area}] ${message}`);
const warn = (area, message) => warnings.push(`[${area}] ${message}`);
const info = (area, message) => infos.push(`[${area}] ${message}`);

const abs = (...parts) => path.join(ROOT, ...parts);
const exists = file => fs.existsSync(file);
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
// Absolute URLs, protocol-relative URLs, data: URIs and in-page anchors are not local files.
const isExternal = ref => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);
const stripQuery = ref => ref.split(/[?#]/)[0];

function readJson(rel) {
    const file = abs(rel);
    if (!exists(file)) {
        error('files', `${rel} is missing`);
        return null;
    }
    try {
        return JSON.parse(read(file));
    } catch (e) {
        error('json', `${rel}: ${e.message}`);
        return null;
    }
}

// Every top-level key of a JSON object, in file order and however the file is laid
// out (one key per line, several on one line, any indentation). JSON.parse keeps only
// the last duplicate, so duplicates can only be found by walking the raw text.
function topLevelKeys(text) {
    const keys = [];
    const isObject = text.trimStart().startsWith('{');
    let depth = 0;
    let expectKey = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            let end = i + 1;
            while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
            if (depth === 1 && expectKey) {
                keys.push(JSON.parse(text.slice(i, end + 1)));
                expectKey = false;
            }
            i = end;
        } else if (ch === '{' || ch === '[') {
            depth++;
            if (depth === 1) expectKey = isObject;
        } else if (ch === '}' || ch === ']') {
            depth--;
        } else if (ch === ',' && depth === 1) {
            expectKey = isObject;
        }
    }
    return keys;
}

// ---------------------------------------------------------------- localization

function checkLocalization() {
    const manifest = readJson('data/loc/manifest.json');
    if (!Array.isArray(manifest)) return {};

    const merged = {};
    const origin = {};
    manifest.forEach(file => {
        const rel = `data/loc/${file}`;
        if (!exists(abs(rel))) {
            error('loc', `${rel} is listed in manifest.json but does not exist`);
            return;
        }
        const text = read(abs(rel));
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            error('loc', `${rel}: invalid JSON (${e.message})`);
            return;
        }

        // JSON.parse silently keeps the last duplicate, so scan the raw text.
        const seen = new Set();
        for (const key of topLevelKeys(text)) {
            if (seen.has(key)) error('loc', `${rel}: duplicate key "${key}"`);
            seen.add(key);
        }

        Object.keys(data).forEach(key => {
            if (key in merged) warn('loc', `"${key}" is in both ${origin[key]} and ${rel}; the later file wins`);
            merged[key] = data[key];
            origin[key] = rel;
        });
    });

    // JSON files in data/loc/ that the manifest does not load (keyword lists are loaded separately).
    fs.readdirSync(abs('data/loc'))
        .filter(f => f.endsWith('.json') && f !== 'manifest.json' && !f.startsWith('keywords-'))
        .filter(f => !manifest.includes(f))
        .forEach(f => warn('loc', `data/loc/${f} is not listed in manifest.json, so it is never loaded`));

    const seenKeywords = new Map();
    ['keywords-ph1.json', 'keywords-ph2.json', 'keywords-ph3.json'].forEach(file => {
        const list = readJson(`data/loc/${file}`);
        if (!list) return;

        if (!Array.isArray(list) || list.some(item => typeof item !== 'string')) {
            error('loc', `data/loc/${file} must be an array of strings`);
            return;
        }

        list.forEach(keyword => {
            // A leading "=" makes loc.js match the keyword with exact case.
            const exactCase = keyword.startsWith('=');
            const word = exactCase ? keyword.slice(1) : keyword;
            if (!word) {
                error('loc', `data/loc/${file} has an empty keyword ("${keyword}")`);
                return;
            }
            if (exactCase && word.toLowerCase() === word) {
                warn('loc', `keyword "${keyword}" in ${file} is exact-case but has no capital letters, so "=" changes nothing`);
            }
            if (seenKeywords.has(word)) {
                warn('loc', `keyword "${word}" is in both ${seenKeywords.get(word)} and ${file}`);
            } else {
                seenKeywords.set(word, file);
            }
        });
    });

    // Loading-tip headers should carry the same number as their key.
    Object.keys(merged).forEach(key => {
        const keyMatch = /^LOADING_TIP_(\d+)$/.exec(key);
        const headerMatch = typeof merged[key] === 'string' && /\[DATALINK\.(\d+)\]/.exec(merged[key]);
        if (keyMatch && headerMatch && Number(keyMatch[1]) !== Number(headerMatch[1])) {
            warn('loc', `${key} is labelled DATALINK.${headerMatch[1]}`);
        }
    });

    return merged;
}

// ------------------------------------------------------------------------ POIs

function checkPois(loc) {
    const keys = Object.keys(loc);
    // Same rule as pois.js: top-level POIs start with "poi" and do not end in "-desc".
    const topLevel = keys.filter(k => k.startsWith('poi') && !k.endsWith('-desc'));
    const topSet = new Set(topLevel);

    topLevel.forEach(id => {
        if (typeof loc[`${id}-desc`] !== 'string') error('pois', `"${id}" has no "${id}-desc"`);
    });

    keys.filter(k => k.endsWith('-desc')).forEach(descKey => {
        const base = descKey.slice(0, -5);
        const text = loc[descKey];
        if (typeof text !== 'string') return;
        const isPoiKey = /^(?:poi|[A-Za-z0-9]+poi\d+$)/.test(base);
        if ((isPoiKey || text.includes('{{title}}')) && typeof loc[base] !== 'string') {
            error('pois', `"${descKey}" has no matching title key "${base}"`);
        }
    });

    // Nested POIs like FRApoi001 become tooltip buttons inside poiFRA's panel.
    const nested = new Map();
    keys.forEach(key => {
        const match = /^([A-Za-z0-9]+)poi(\d+)$/.exec(key);
        if (!match) return;
        if (!nested.has(match[1])) nested.set(match[1], []);
        nested.get(match[1]).push({ key, n: Number(match[2]) });
    });
    nested.forEach((items, prefix) => {
        if (!topSet.has(`poi${prefix}`)) {
            error('pois', `${items.length} nested POI(s) use the prefix "${prefix}" but "poi${prefix}" does not exist, so they never appear`);
        }
        const numbers = items.map(item => item.n).sort((a, b) => a - b);
        const gaps = numbers.filter((n, i) => n !== i + 1);
        if (gaps.length) warn('pois', `${prefix}poiNNN numbering is not 001, 002, 003... (found ${numbers.join(', ')})`);
        items.forEach(({ key }) => {
            if (typeof loc[`${key}-desc`] !== 'string') warn('pois', `"${key}" has no "${key}-desc", so pois.js skips it`);
        });
    });

    const stubs = topLevel.filter(id => typeof loc[`${id}-desc`] === 'string' && !loc[`${id}-desc`].includes('<p'));
    if (stubs.length) info('pois', `${stubs.length} of ${topLevel.length} panels are still stubs (title only): ${stubs.join(', ')}`);

    return topSet;
}

// --------------------------------------------------------------------- markers

function checkMarkers(poiIds) {
    // globe-markers.js throws on the first invalid marker and then shows none at all,
    // so every problem here is an error.
    const markers = readJson('data/globe-markers.json');
    if (!markers) return;
    if (!Array.isArray(markers)) {
        error('markers', 'data/globe-markers.json must contain an array');
        return;
    }

    const ids = new Set();
    const withPanel = [];
    const withoutPanel = [];
    markers.forEach((marker, index) => {
        if (!marker || typeof marker.id !== 'string' || !marker.id) {
            error('markers', `marker #${index} has no id`);
            return;
        }
        const where = `marker "${marker.id}"`;
        if (ids.has(marker.id)) error('markers', `${where}: duplicate id`);
        ids.add(marker.id);

        if (typeof marker.label !== 'string' || !marker.label) error('markers', `${where}: missing label`);
        if (typeof marker.icon !== 'string' || !marker.icon) {
            error('markers', `${where}: missing icon`);
        } else if (!exists(path.resolve(abs('src/js'), marker.icon))) {
            // globe-markers.js resolves icons against its own location, src/js/.
            error('markers', `${where}: icon "${marker.icon}" not found (resolved from src/js/)`);
        }

        const number = (field, ok, rule) => {
            if (!Number.isFinite(marker[field]) || !ok(marker[field])) error('markers', `${where}: ${field} ${rule}`);
        };
        number('lon', v => v >= -180 && v <= 180, 'must be a number from -180 to 180');
        number('lat', v => v >= -90 && v <= 90, 'must be a number from -90 to 90');
        number('altitudeKm', v => v >= 0 && v <= 100000, 'must be a number from 0 to 100000');
        number('size', v => v > 0 && v <= 256, 'must be above 0 and at most 256');

        (poiIds.has(marker.id) ? withPanel : withoutPanel).push(marker.id);
    });

    info('markers', `${withPanel.length} marker(s) open a panel; no panel for: ${withoutPanel.join(', ') || 'none'}`);
    const unmarked = [...poiIds].filter(id => !ids.has(id));
    info('markers', `panels without a globe marker: ${unmarked.join(', ') || 'none'}`);
}

// -------------------------------------------------------------------- treemaps

function checkTreemaps(html) {
    // The files and tag settings come from the treemap <div>s in index.html.
    const sources = [...html.matchAll(/<div[^>]*\bclass="treemap"[^>]*>/g)]
        .map(match => ({
            source: (/data-source="([^"]+)"/.exec(match[0]) || [])[1],
            useTags: /data-use-tags="true"/.test(match[0])
        }))
        .filter(entry => entry.source);

    sources.forEach(({ source, useTags }) => {
        const root = readJson(source);
        if (!root) return;

        const walk = (node, trail) => {
            const label = node.name || node.tag || '(unnamed)';
            const here = [...trail, label].join(' > ');
            if (!node.name && !node.tag) warn(source, `${here}: node has no name or tag`);

            const children = Array.isArray(node.children) ? node.children : [];
            if (children.length) {
                if (Object.prototype.hasOwnProperty.call(node, 'value')) {
                    error(source, `${here}: parent has an explicit "value"; it is ignored and computed from its children`);
                }
                const seen = new Set();
                children.forEach(child => {
                    const key = child.tag || child.name;
                    if (seen.has(key)) error(source, `${here}: two children share the key "${key}"`);
                    seen.add(key);
                    if (useTags && !child.tag) warn(source, `${here} > ${child.name || '(unnamed)'}: no "tag" (tags are used as labels here)`);
                    walk(child, [...trail, label]);
                });
            } else if (!(Number(node.value) > 0)) {
                warn(source, `${here}: leaf has no positive "value"`);
            }
        };
        walk(root, []);
    });
}

// -------------------------------------------------------------- scenario data

function checkScenario() {
    const rel = 'src/js/scenario-data.js';
    if (!exists(abs(rel))) {
        error('files', `${rel} is missing`);
        return;
    }
    const context = vm.createContext({ window: {} });
    try {
        vm.runInContext(read(abs(rel)), context, { filename: rel });
    } catch (e) {
        error('scenario', `${rel} failed to run: ${e.message}`);
        return;
    }
    const series = context.window.scenarioSeries || {};
    const data = context.window.scenarioChartData || {};
    const config = context.window.scenarioConfig || {};

    const range = {};
    Object.keys(data).forEach(key => {
        if (!series[key]) warn(rel, `chart data "${key}" has no entry in scenarioSeries, so it never gets a chart`);
        const points = Array.isArray(data[key]) ? data[key] : [];
        const valid = points.filter(p => Number.isFinite(p.year) && Number.isFinite(p.value));
        if (valid.length !== points.length) warn(rel, `${key}: ${points.length - valid.length} point(s) without a numeric year/value are ignored`);
        if (valid.length < 2) {
            warn(rel, `${key}: needs at least 2 valid points to draw a line`);
            return;
        }
        const years = valid.map(p => p.year);
        if (new Set(years).size !== years.length) warn(rel, `${key}: has duplicate years`);
        range[key] = [Math.min(...years), Math.max(...years)];
        if (Number.isFinite(config.baselineYear) && !years.includes(config.baselineYear)) {
            warn(rel, `${key}: no ${config.baselineYear} point, so its summary row shows N/A`);
        }
    });
    Object.keys(series).forEach(key => {
        if (!range[key]) warn(rel, `scenarioSeries "${key}" has no usable chart data, so its button is skipped`);
    });

    const unknownSeries = (item, kind, label) => (item.series || []).filter(s => {
        if (series[s]) return false;
        warn(rel, `${kind} "${label}" refers to unknown series "${s}"`);
        return true;
    });

    (config.events || []).forEach(event => {
        const label = `${event.label} (${event.year})`;
        if (!Number.isFinite(event.year)) {
            warn(rel, `event "${event.label}" has no numeric year and is never drawn`);
            return;
        }
        if (Array.isArray(event.series)) {
            const known = event.series.filter(s => series[s]);
            unknownSeries(event, 'event', label);
            const drawn = known.some(s => range[s] && event.year >= range[s][0] && event.year <= range[s][1]);
            if (known.length && !drawn) warn(rel, `event "${label}" is outside the year range of its series and is never drawn`);
        }
    });

    (config.eras || []).forEach(era => {
        if (!(era.start < era.end)) warn(rel, `era "${era.label}": start (${era.start}) must be before end (${era.end})`);
        unknownSeries(era, 'era', era.label);
    });

    // Without the slider the globe uses this constant, so it should match the chart.
    const globePath = abs('src/js/globe.js');
    const sea = Array.isArray(data.seaLevel) ? data.seaLevel.slice().sort((a, b) => a.year - b.year) : [];
    const match = exists(globePath) && /const\s+DEFAULT_SEA_LEVEL\s*=\s*([\d.]+)/.exec(read(globePath));
    if (match && sea.length && Number(match[1]) !== sea[sea.length - 1].value) {
        warn('globe', `DEFAULT_SEA_LEVEL is ${match[1]} but the last seaLevel value is ${sea[sea.length - 1].value}`);
    }

    // elev-1080.webp flattens deep ocean, which is only invisible while the sea
    // level never drops below 0 m.
    const negative = sea.filter(p => Number(p.value) < 0);
    if (negative.length) {
        error('globe', `seaLevel has values below 0 m (${negative.map(p => `${p.year}: ${p.value}`).join(', ')}); the flattened ocean in elev-1080.webp would show. Rebuild it from the PNG with a deeper band, or keep sea level >= 0`);
    }
}

// ------------------------------------------------------------- html and assets

function checkHtmlAndAssets(loc) {
    if (!exists(abs('index.html'))) {
        error('files', 'index.html is missing');
        return '';
    }
    const html = read(abs('index.html'));

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    new Set(ids.filter((id, i) => ids.indexOf(id) !== i)).forEach(id => {
        error('html', `index.html: id "${id}" is used more than once`);
    });

    for (const match of html.matchAll(/\b(?:src|href|data-source)="([^"]+)"/g)) {
        if (isExternal(match[1])) continue;
        if (!exists(abs(stripQuery(match[1])))) error('assets', `index.html references "${match[1]}" which does not exist`);
    }

    // Stylesheets: every url() must resolve and every @import must point at a real file.
    // url()s resolve against the stylesheet that contains them, so each file is checked in its own directory.
    for (const file of listCss('src/css')) {
        const dir = path.dirname(abs(file));
        const text = read(abs(file));
        for (const match of text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) {
            if (isExternal(match[2])) continue;
            if (!exists(path.resolve(dir, stripQuery(match[2])))) error('assets', `${file} references "${match[2]}" which does not exist`);
        }
        for (const match of text.matchAll(/@import\s+(?:url\(\s*)?["']([^"')]+)["']/g)) {
            if (isExternal(match[1])) continue;
            if (!exists(path.resolve(dir, stripQuery(match[1])))) error('assets', `${file} imports "${match[1]}" which does not exist`);
        }
    }

    if (exists(abs('src/js/globe.js'))) {
        // globe.js resolves these against its own location, src/js/.
        const globeSource = read(abs('src/js/globe.js'));
        const list = /const\s+ELEVATION_SOURCES\s*=\s*\[([^\]]*)\]/.exec(globeSource);
        const sources = list ? [...list[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
        if (!list) warn('globe', 'ELEVATION_SOURCES was not found in globe.js, so elevation files were not checked');
        sources.forEach((source, index) => {
            if (exists(path.resolve(abs('src/js'), source))) return;
            const message = `globe.js loads "${source}" (resolved from src/js/) which does not exist`;
            if (index === 0) error('assets', message);
            else warn('assets', `${message}; it is only the fallback`);
        });

        // The WebP is generated from the PNG; flag a PNG edited without a rebuild.
        const png = abs('data/elev-1080.png');
        const webp = abs('data/elev-1080.webp');
        if (exists(png) && exists(webp) && fs.statSync(png).mtimeMs > fs.statSync(webp).mtimeMs) {
            warn('globe', 'data/elev-1080.png is newer than data/elev-1080.webp; rebuild it with tools/make-elevation-webp.py');
        }

        // The shader clamp and the generator must agree on the coast band.
        const script = abs('tools/make-elevation-webp.py');
        const shaderPath = abs('src/js/globe-shaders.js');
        const jsBand = exists(shaderPath) && /const\s+COAST_BAND_M\s*=\s*([\d.]+)/.exec(read(shaderPath));
        const pyBand = exists(script) && /^COAST_BAND_M\s*=\s*([\d.]+)/m.exec(read(script));
        if (!jsBand) warn('globe', 'COAST_BAND_M was not found in src/js/globe-shaders.js, so the coast band was not checked against tools/make-elevation-webp.py');
        else if (!pyBand) warn('globe', 'COAST_BAND_M was not found in tools/make-elevation-webp.py, so the coast band was not checked');
        if (jsBand && pyBand && Number(jsBand[1]) !== Number(pyBand[1])) {
            error('globe', `COAST_BAND_M is ${jsBand[1]} in globe-shaders.js but ${pyBand[1]} in tools/make-elevation-webp.py; deep ocean edits would show on the coastline`);
        }
    }

    return html;
}

// ------------------------------------------------------------- economic relations

function checkEconomicRelations() {
    // Relations larger than this are probably a typo (the guide in data/relations.md
    // suggests steps of 0.05 and the existing data tops out at 0.2).
    const MAX_RELATION_WEIGHT = 0.25;

    // Index every node of the database files by its tag and by its name, the two keys
    // data-calc.js uses to resolve a sourceKey/targetKey. depth 1 is a top-level
    // entity (a direct child of the root); the root itself is not a valid key.
    const nodesByKey = new Map();
    let nodeCount = 0;
    ['data/src-data.json', 'data/mkt-data.json', 'data/gdp-data.json'].forEach(file => {
        const data = readJson(file);
        if (!data) return;
        const isResource = file === 'data/src-data.json';
        (function walk(node, depth) {
            if (!node || typeof node !== 'object') return;
            const id = ++nodeCount;
            if (depth > 0) {
                new Set([node.tag, node.name].filter(key => typeof key === 'string' && key)).forEach(key => {
                    if (!nodesByKey.has(key)) nodesByKey.set(key, []);
                    nodesByKey.get(key).push({ id, resource: isResource, topLevel: depth === 1, byTag: key === node.tag });
                });
            }
            (node.children || []).forEach(child => walk(child, depth + 1));
        })(data, 0);
    });

    const rel = readJson('data/relations.json');
    if (!rel) return;

    if (!Array.isArray(rel.relations)) {
        error('relations', 'relations.json must contain a "relations" array');
        return;
    }

    const seenPairs = new Map();
    rel.relations.forEach((entry, index) => {
        const where = `relations.json relations[${index}]`;
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            error('relations', `${where}: expected an object`);
            return;
        }

        const matches = {};
        ['sourceKey', 'targetKey'].forEach(field => {
            const value = entry[field];
            if (typeof value !== 'string' || !value) {
                error('relations', `${where}: missing ${field}`);
                return;
            }
            const records = nodesByKey.get(value);
            if (!records) {
                error('relations', `${where}: ${field} "${value}" is not a known name or tag in src-data.json, mkt-data.json, or gdp-data.json`);
                return;
            }
            matches[field] = records;
            if (new Set(records.map(record => record.id)).size > 1) {
                warn('relations', `${where}: ${field} "${value}" matches more than one entry in the data files, so it is ambiguous`);
            }
        });

        // Rules from data/relations.md.
        const { sourceKey: from, targetKey: to } = matches;
        if (to) {
            if (to.some(record => record.resource)) {
                error('relations', `${where}: targetKey "${entry.targetKey}" is a resource; resources can only be a sourceKey`);
            } else if (!to.some(record => record.topLevel)) {
                error('relations', `${where}: targetKey "${entry.targetKey}" is a child entity; a targetKey must be a top-level parent entity`);
            }
        }
        if (from && from.some(record => record.resource) && !from.some(record => record.resource && record.byTag)) {
            warn('relations', `${where}: resource sourceKey "${entry.sourceKey}" is a name; use the resource's tag`);
        }

        if (from && to) {
            if (entry.sourceKey === entry.targetKey) {
                error('relations', `${where}: sourceKey and targetKey are both "${entry.sourceKey}"`);
            }
            const pair = `${entry.sourceKey}\u0000${entry.targetKey}`;
            if (seenPairs.has(pair)) {
                warn('relations', `${where}: repeats relations[${seenPairs.get(pair)}] (${entry.sourceKey} -> ${entry.targetKey})`);
            } else {
                seenPairs.set(pair, index);
            }
        }

        if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight)) {
            error('relations', `${where}: weight must be a finite JSON number`);
        } else if (entry.weight === 0) {
            warn('relations', `${where}: weight is 0, so this relation has no effect`);
        } else if (Math.abs(entry.weight) > MAX_RELATION_WEIGHT) {
            warn('relations', `${where}: weight ${entry.weight} is larger than ${MAX_RELATION_WEIGHT}`);
        }
    });
}

// ------------------------------------------------------------- check data files
// Walk a treemap JSON tree and report duplicate tag/name values.
function checkDataFileDuplicates(filePath) {
    const data = readJson(filePath);
    if (!data) return;

    const seenTags = new Map();   // tag -> file
    const seenNames = new Map();  // name -> file

    function walk(node) {
        if (!node || typeof node !== 'object') return;

        // Check tag
        if (typeof node.tag === 'string' && node.tag.trim()) {
            if (seenTags.has(node.tag)) {
                error('data', `duplicate tag "${node.tag}" in ${filePath}`);
            } else {
                seenTags.set(node.tag, filePath);
            }
        }

        // Check name
        if (typeof node.name === 'string' && node.name.trim()) {
            if (seenNames.has(node.name)) {
                error('data', `duplicate name "${node.name}" in ${filePath}`);
            } else {
                seenNames.set(node.name, filePath);
            }
        }

        // Recurse into children
        const children = Array.isArray(node.children) ? node.children : [];
        for (const child of children) {
            walk(child);
        }
    }

    walk(data);
}

// ---------------------------------------------------------------------- syntax

function listJs(dir) {
    if (!exists(abs(dir))) return [];
    return fs.readdirSync(abs(dir)).filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`);
}

function listCss(dir) {
    if (!exists(abs(dir))) return [];
    return fs.readdirSync(abs(dir)).filter(f => f.endsWith('.css')).map(f => `${dir}/${f}`);
}

function checkSyntax() {
    const files = [...listJs('data/loc'), ...listJs('src/js')];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-'));
    try {
        files.forEach((rel, index) => {
            const source = read(abs(rel));
            // Copy to a temp file with an explicit extension so a future package.json
            // "type" setting cannot change how the file is parsed.
            const isModule = /\bimport\.meta\b|^\s*(?:import|export)\s/m.test(source);
            const target = path.join(temp, `${index}${isModule ? '.mjs' : '.cjs'}`);
            fs.writeFileSync(target, source);
            const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
            if (result.status !== 0) {
                const detail = result.stderr.split('\n').filter(Boolean).slice(0, 4).join(' | ').replaceAll(target, rel);
                error('syntax', `${rel}: ${detail}`);
            }
        });
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

// ----------------------------------------------------------------- stylesheets

// index.html links every stylesheet itself so they all download at once. A file in
// src/css that is neither linked nor @imported is never applied, and the cascade
// relies on reduced-motion.css coming last. A var(--x) without a fallback drops its
// whole declaration when --x is never set, which shows no error in the browser.
function checkStylesheets(html) {
    if (!html) return;
    const linked = [...html.matchAll(/<link\b[^>]*>/g)]
        .map(match => match[0])
        .filter(tag => /\brel="stylesheet"/.test(tag))
        .map(tag => /\bhref="([^"]+)"/.exec(tag)?.[1])
        .filter(href => href && !isExternal(href))
        .map(stripQuery);

    // Stylesheets reached from the links, following @import.
    const loaded = new Set();
    const queue = linked.map(href => abs(href));
    while (queue.length) {
        const file = queue.shift();
        if (loaded.has(file) || !exists(file)) continue;
        loaded.add(file);
        for (const match of read(file).matchAll(/@import\s+(?:url\(\s*)?["']([^"')]+)["']/g)) {
            if (!isExternal(match[1])) queue.push(path.resolve(path.dirname(file), stripQuery(match[1])));
        }
    }
    const cssFiles = listCss('src/css');
    cssFiles.forEach(rel => {
        if (!loaded.has(abs(rel))) warn('css', `${rel} is not linked from index.html (or imported by a linked stylesheet), so it is never applied`);
    });
    if (linked.length && !linked.at(-1).endsWith('reduced-motion.css')) {
        warn('css', `reduced-motion.css should be the last stylesheet linked from index.html (the last one is ${linked.at(-1)}), or later rules can undo the reduced-motion overrides`);
    }

    // Custom properties are set in the stylesheets, registered with @property, or set
    // from the scripts (style.setProperty('--x', ...) or "--x:" in an inline style).
    const sources = cssFiles.map(rel => [rel, read(abs(rel))]);
    const defined = new Set();
    sources.forEach(([, text]) => {
        for (const match of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);
        for (const match of text.matchAll(/@property\s+(--[\w-]+)/g)) defined.add(match[1]);
    });
    const scripts = ['src/default.js', ...listJs('src/js')]
        .filter(rel => exists(abs(rel)))
        .map(rel => read(abs(rel)))
        .join('\n') + html;
    for (const match of scripts.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) defined.add(match[1]);
    for (const match of scripts.matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);

    sources.forEach(([rel, text]) => {
        const reported = new Set();
        for (const match of text.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
            const name = match[1];
            if (defined.has(name) || reported.has(name)) continue;
            reported.add(name);
            warn('css', `${rel} uses var(${name}) without a fallback, but ${name} is never set, so those declarations are ignored`);
        }
    });
}

// --------------------------------------------------------------------- modules

// Names a module exports: `export function/const/let/class name` and `export { a, b as c }`.
function exportedNames(source) {
    const names = new Set();
    for (const match of source.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
        names.add(match[1]);
    }
    for (const match of source.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
        match[1].split(',').forEach(part => {
            const name = part.trim().split(/\s+as\s+/).pop().trim();
            if (name) names.add(name);
        });
    }
    return names;
}

// The page is one module graph starting at src/default.js: a missing file or a
// missing named export stops every script on the page, so both are errors. A module
// in src/js that nothing imports never runs, which is only a warning.
function checkModules() {
    const entry = 'src/default.js';
    if (!exists(abs(entry))) {
        error('modules', `${entry} is missing`);
        return;
    }
    const exportsCache = new Map();
    const exportsOf = file => {
        if (!exportsCache.has(file)) exportsCache.set(file, exportedNames(read(file)));
        return exportsCache.get(file);
    };
    const reached = new Set();
    const queue = [abs(entry)];

    while (queue.length) {
        const file = queue.shift();
        if (reached.has(file)) continue;
        reached.add(file);
        const rel = path.relative(ROOT, file).replaceAll('\\', '/');
        const source = read(file);
        const dir = path.dirname(file);

        // Static imports: import './x.js', import { a, b as c } from './x.js'
        for (const match of source.matchAll(/^\s*import\s+(?:([^'";]+?)\s+from\s+)?['"]([^'"]+)['"]/gm)) {
            const [, clause, spec] = match;
            if (!spec.startsWith('.')) continue;
            const target = path.resolve(dir, spec);
            if (!exists(target)) {
                error('modules', `${rel} imports "${spec}" which does not exist`);
                continue;
            }
            if (!target.endsWith('.js')) continue;
            queue.push(target);

            const named = clause && /\{([^}]*)\}/.exec(clause);
            if (!named) continue;
            const available = exportsOf(target);
            named[1].split(',')
                .map(part => part.trim().split(/\s+as\s+/)[0].trim())
                .filter(Boolean)
                .forEach(name => {
                    if (!available.has(name)) error('modules', `${rel} imports { ${name} } from "${spec}", which does not export it; no script on the page would run`);
                });
        }

        // Dynamic imports of local files (the globe's marker JSON, for example).
        for (const match of source.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]/g)) {
            if (!exists(path.resolve(dir, match[1]))) error('modules', `${rel} dynamically imports "${match[1]}" which does not exist`);
        }
    }

    listJs('src/js').forEach(rel => {
        if (!reached.has(abs(rel))) warn('modules', `${rel} is not imported from ${entry} (directly or through another module), so it never runs`);
    });
}

// ------------------------------------------------------------------------ main

const loc = checkLocalization();
const poiIds = checkPois(loc);
checkMarkers(poiIds);
const html = checkHtmlAndAssets(loc);
checkStylesheets(html);
checkTreemaps(html);
checkDataFileDuplicates('data/src-data.json');
checkDataFileDuplicates('data/mkt-data.json');
checkDataFileDuplicates('data/gdp-data.json');
checkEconomicRelations();
checkScenario();
checkModules();
checkSyntax();

function print(title, list) {
    if (!list.length) return;
    console.log(`\n${title} (${list.length})`);
    list.forEach(line => console.log(`  - ${line}`));
}

print('Errors', errors);
print('Warnings', warnings);
if (SHOW_INFO) print('Info', infos);
else if (infos.length) console.log(`\n(${infos.length} info note(s) hidden, run with --info to see them)`);

console.log(errors.length
    ? `\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s)`
    : `\nOK: no errors, ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);

