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

// ---------------------------------------------------------------- localization

function checkLocalization() {
    const manifest = readJson('loc/manifest.json');
    if (!Array.isArray(manifest)) return {};

    const merged = {};
    const origin = {};
    manifest.forEach(file => {
        const rel = `loc/${file}`;
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
        for (const match of text.matchAll(/^ {4}"((?:[^"\\]|\\.)*)"\s*:/gm)) {
            if (seen.has(match[1])) error('loc', `${rel}: duplicate key "${match[1]}"`);
            seen.add(match[1]);
        }

        Object.keys(data).forEach(key => {
            if (key in merged) warn('loc', `"${key}" is in both ${origin[key]} and ${rel}; the later file wins`);
            merged[key] = data[key];
            origin[key] = rel;
        });
    });

    // JSON files in loc/ that the manifest does not load (keyword lists are loaded separately).
    fs.readdirSync(abs('loc'))
        .filter(f => f.endsWith('.json') && f !== 'manifest.json' && !f.startsWith('keywords-'))
        .filter(f => !manifest.includes(f))
        .forEach(f => warn('loc', `loc/${f} is not listed in manifest.json, so it is never loaded`));

    ['keywords-ph1.json', 'keywords-ph2.json', 'keywords-ph3.json'].forEach(file => {
        const list = readJson(`loc/${file}`);
        if (list && (!Array.isArray(list) || list.some(item => typeof item !== 'string'))) {
            error('loc', `loc/${file} must be an array of strings`);
        }
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
    // globe.js throws on the first invalid marker and then shows none at all,
    // so every problem here is an error.
    const markers = readJson('scrpts/globe-markers.json');
    if (!markers) return;
    if (!Array.isArray(markers)) {
        error('markers', 'scrpts/globe-markers.json must contain an array');
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
        } else if (!exists(path.resolve(abs('scrpts'), marker.icon))) {
            // globe.js resolves icons against its own location, scrpts/.
            error('markers', `${where}: icon "${marker.icon}" not found (resolved from scrpts/)`);
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
    const rel = 'scrpts/scenario-data.js';
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
    const globePath = abs('scrpts/globe.js');
    const sea = Array.isArray(data.seaLevel) ? data.seaLevel.slice().sort((a, b) => a.year - b.year) : [];
    const match = exists(globePath) && /const\s+DEFAULT_SEA_LEVEL\s*=\s*([\d.]+)/.exec(read(globePath));
    if (match && sea.length && Number(match[1]) !== sea[sea.length - 1].value) {
        warn('globe', `DEFAULT_SEA_LEVEL is ${match[1]} but the last seaLevel value is ${sea[sea.length - 1].value}`);
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

    if (exists(abs('default.css'))) {
        for (const match of read(abs('default.css')).matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) {
            if (isExternal(match[2])) continue;
            if (!exists(abs(stripQuery(match[2])))) error('assets', `default.css references "${match[2]}" which does not exist`);
        }
    }

    if (exists(abs('default.js'))) {
        for (const match of read(abs('default.js')).matchAll(/(beLegacy\d+):\s*"([^"]+)"/g)) {
            if (!exists(abs(match[2]))) error('assets', `default.js loads "${match[2]}" which does not exist`);
            if (!ids.includes(match[1])) error('html', `default.js fills #${match[1]} but index.html has no such element`);
        }
    }

    if (exists(abs('scrpts/affy-graph.js'))) {
        const source = read(abs('scrpts/affy-graph.js'));
        for (const match of source.matchAll(/icon:\s*'([^']+)'/g)) {
            if (!exists(abs(match[1]))) error('assets', `affy-graph.js uses icon "${match[1]}" which does not exist`);
        }
        for (const match of source.matchAll(/description:\s*'([^']+)'/g)) {
            if (typeof loc[match[1]] !== 'string') error('loc', `affy-graph.js uses tooltip "${match[1]}" which is not in the localization files`);
        }
    }

    if (exists(abs('scrpts/globe.js'))) {
        // globe.js resolves this against its own location, scrpts/.
        const match = /decodeElevation\(\s*'([^']+)'\s*\)/.exec(read(abs('scrpts/globe.js')));
        if (match && !exists(path.resolve(abs('scrpts'), match[1]))) {
            error('assets', `globe.js loads "${match[1]}" but scrpts/${match[1]} does not exist`);
        }
    }

    return html;
}

// ---------------------------------------------------------------------- syntax

function listJs(dir) {
    if (!exists(abs(dir))) return [];
    return fs.readdirSync(abs(dir)).filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`);
}

function checkSyntax() {
    const files = [...(exists(abs('default.js')) ? ['default.js'] : []), ...listJs('loc'), ...listJs('scrpts')];
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

// ------------------------------------------------------------------------ main

const loc = checkLocalization();
const poiIds = checkPois(loc);
checkMarkers(poiIds);
const html = checkHtmlAndAssets(loc);
checkTreemaps(html);
checkScenario();
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

