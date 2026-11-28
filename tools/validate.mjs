#!/usr/bin/env node
// Project sanity checks. Put this file in tools/ and run it from anywhere:
//
//   node tools/validate.mjs          errors and warnings
//   node tools/validate.mjs --info   also lists POI stubs and which POIs have globe markers
//
// Errors are things that break the page and make the exit code 1. Warnings are
// suspicious but not fatal. Needs Node 20.10 or newer (for the JSON import syntax),
// and no packages.
//
// What it cannot do: it checks syntax, not undefined variables. For that class
// of bug (a leftover constant after a rename, say) use ESLint with "no-undef".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

// Same rules as src/js/poi-data.js, which logs and drops a bad field (or the whole entry,
// for a bad id), so a problem that loses a button, panel or marker is an error here.
const POI_FIELDS = new Set(['id', 'icon', 'background', 'children', 'globe']);

function checkPois(loc) {
    const rel = 'data/pois.json';
    const hasText = key => typeof loc[key] === 'string';
    const list = readJson(rel);
    if (list && !Array.isArray(list)) error('pois', `${rel} must contain an array`);

    const ids = new Set();
    const shown = [];
    const parentOf = new Map();
    const withMarker = [];
    const withoutMarker = [];
    (Array.isArray(list) ? list : []).forEach((entry, index) => {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id) {
            error('pois', `${rel} entry #${index} has no id, so it is skipped`);
            return;
        }
        const { id } = entry;
        const where = `POI "${id}"`;
        if (ids.has(id)) {
            error('pois', `${where} appears more than once in ${rel}; only the first is used`);
            return;
        }
        ids.add(id);

        const unknown = Object.keys(entry).filter(field => !POI_FIELDS.has(field));
        if (unknown.length) warn('pois', `${where}: unknown field(s) ${unknown.join(', ')} are ignored`);

        if (!hasText(id)) {
            warn('pois', `${where} has no "${id}" localization, so it gets no button or panel${entry.globe !== undefined ? ' and its globe marker is labeled with its id' : ''}`);
        } else {
            shown.push(id);
            if (!hasText(`${id}-desc`)) error('pois', `${where} has no "${id}-desc", so its panel is empty`);
        }

        const hasIcon = typeof entry.icon === 'string' && entry.icon.length > 0;
        if (entry.icon !== undefined && !hasIcon) {
            error('pois', `${where}: "icon" must be a non-empty path`);
        } else if (hasIcon && !exists(path.resolve(ROOT, stripQuery(entry.icon)))) {
            // poi-data.js resolves icons against the project root.
            error('pois', `${where}: icon "${entry.icon}" not found (resolved from the project root)`);
        }

        if (entry.background !== undefined) {
            const background = entry.background;
            if (!background || typeof background !== 'object' || Array.isArray(background)) {
                error('pois', `${where}: "background" must be an object, so its panel has no background`);
            } else {
                if (!Number.isFinite(background.size) || background.size <= 0 || background.size > 100) {
                    error('pois', `${where}: background size must be a percentage above 0 and at most 100, so its panel has no background`);
                }
                if (!hasIcon) error('pois', `${where}: a background needs an icon, so its panel has no background`);
            }
        }

        if (entry.children !== undefined) {
            if (!Array.isArray(entry.children)) {
                error('pois', `${where}: "children" must be an array of ids, so it has no nested POIs`);
            } else {
                entry.children.forEach(child => {
                    if (typeof child !== 'string' || !child) {
                        error('pois', `${where}: a child id is not a non-empty string and is skipped`);
                        return;
                    }
                    if (parentOf.has(child)) warn('pois', `"${child}" is a child of both "${parentOf.get(child)}" and "${id}"`);
                    else parentOf.set(child, id);
                    if (!hasText(`${child}-desc`)) {
                        warn('pois', `${where}: child "${child}" has no "${child}-desc", so it has nothing to show`);
                    } else if (!hasText(child)) {
                        error('pois', `${where}: child "${child}" has no "${child}" localization, so its button has no label`);
                    }
                });
            }
        }

        if (entry.globe === undefined) {
            withoutMarker.push(id);
            return;
        }
        const globe = entry.globe;
        if (!globe || typeof globe !== 'object' || Array.isArray(globe)) {
            error('pois', `${where}: "globe" must be an object, so it has no globe marker`);
            return;
        }
        const number = (field, ok, rule) => {
            if (!Number.isFinite(globe[field]) || !ok(globe[field])) error('pois', `${where}: globe ${field} ${rule}, so it has no globe marker`);
        };
        number('lat', v => v >= -90 && v <= 90, 'must be a number from -90 to 90');
        number('lon', v => v >= -180 && v <= 180, 'must be a number from -180 to 180');
        number('altitudeKm', v => v >= 0 && v <= 100000, 'must be a number from 0 to 100000');
        number('size', v => v > 0 && v <= 256, 'must be above 0 and at most 256');
        if (!hasIcon) error('pois', `${where}: a globe marker needs an icon, so it has no globe marker`);
        withMarker.push(id);
    });

    parentOf.forEach((parent, child) => {
        if (ids.has(child)) warn('pois', `"${child}" is both a POI of its own and a child of "${parent}"`);
    });

    // Nested POI ids are their parent's id plus a number ("poiFRA" -> "poiFRA001").
    const isNestedId = (key, parent) => key.startsWith(parent) && /^\d+$/.test(key.slice(parent.length));
    ids.forEach(id => {
        if (!id.startsWith('poi')) warn('pois', `POI "${id}" does not start with "poi" like the other ids`);
    });
    parentOf.forEach((parent, child) => {
        if (!isNestedId(child, parent)) warn('pois', `child "${child}" of "${parent}" is not named "${parent}" plus a number`);
    });

    // Localized names that look like POIs but that no entry in data/pois.json uses.
    Object.keys(loc).filter(key => key.startsWith('poi') && !key.endsWith('-desc')).forEach(key => {
        if (ids.has(key) || parentOf.has(key)) return;
        const parent = [...ids].find(id => isNestedId(key, id));
        if (parent) {
            warn('pois', `"${key}" is localized but not in the "children" of "${parent}" in ${rel}, so it never appears`);
        } else {
            warn('pois', `"${key}" is localized but not in ${rel}, so it never appears`);
        }
    });

    Object.keys(loc).filter(k => k.endsWith('-desc')).forEach(descKey => {
        const base = descKey.slice(0, -5);
        const text = loc[descKey];
        if (typeof text !== 'string') return;
        const isPoiKey = ids.has(base) || parentOf.has(base) || base.startsWith('poi');
        if (isPoiKey && typeof loc[base] !== 'string') {
            error('pois', `"${descKey}" has no matching title key "${base}"`);
        }
    });

    // Inline POI links, {{id|text}} or {{id}}; the same pattern as in src/js/loc.js, which
    // shows a link to a POI without a description as plain text. They are the only way
    // to reach a nested POI, so each one needs a link in a text the reader can get to:
    // a panel, a text that is not a POI's, or a POI reached that way in turn.
    const POI_LINK = /\{\{([^{}|]+)(?:\|([^{}]*))?\}\}/g;
    const isPoi = key => ids.has(key) || parentOf.has(key);
    const linked = new Set();
    const linksFrom = new Map();
    const reached = new Set(shown);
    Object.entries(loc).forEach(([key, text]) => {
        if (typeof text !== 'string' || !text.includes('{{')) return;
        const rest = text.replace(POI_LINK, '');
        if (rest.includes('{{') || rest.includes('}}')) {
            warn('pois', `"${key}" has a "{{" or "}}" that is not a complete {{id|text}} link, so it shows as typed`);
        }
        const base = key.endsWith('-desc') ? key.slice(0, -5) : key;
        const owner = isPoi(base) ? base : null;
        for (const [, rawId, rawText] of text.matchAll(POI_LINK)) {
            const id = rawId.trim();
            if (!hasText(`${id}-desc`)) {
                warn('pois', `"${key}" links to "${id}", which has no "${id}-desc", so the link shows as plain text`);
                continue;
            }
            if (!rawText?.trim() && !hasText(id)) {
                warn('pois', `"${key}" links to "${id}" without a text and "${id}" has no name, so the link shows the id`);
            }
            // A description linking to its own POI does not make it reachable.
            if (id === owner) continue;
            linked.add(id);
            if (!owner) reached.add(id);
            else {
                if (!linksFrom.has(owner)) linksFrom.set(owner, new Set());
                linksFrom.get(owner).add(id);
            }
        }
    });
    const queue = [...reached];
    while (queue.length) {
        (linksFrom.get(queue.shift()) ?? []).forEach(id => {
            if (reached.has(id)) return;
            reached.add(id);
            queue.push(id);
        });
    }
    parentOf.forEach((parent, child) => {
        if (!hasText(`${child}-desc`) || reached.has(child)) return;
        if (!linked.has(child)) {
            warn('pois', `child "${child}" of "${parent}" is not linked from any text with {{${child}|text}}, so it cannot be reached`);
        } else {
            const from = [...linksFrom].filter(([, targets]) => targets.has(child)).map(([owner]) => owner);
            warn('pois', `child "${child}" of "${parent}" is only linked from ${from.join(', ')}, which cannot be reached either; link it, or one of them, from a text that can`);
        }
    });

    const stubs = shown.filter(id => hasText(`${id}-desc`) && !loc[`${id}-desc`].includes('<p'));
    if (stubs.length) info('pois', `${stubs.length} of ${shown.length} panels are still stubs (title only): ${stubs.join(', ')}`);
    info('pois', `${withMarker.length} POI(s) have a globe marker; none for: ${withoutMarker.join(', ') || 'none'}`);
}

// -------------------------------------------------------------------- treemaps

function checkTreemaps(html) {
    // A leaf "volatility" is the largest random move per tick, as a fraction of the
    // value. Anything above this is probably a percent typed as a fraction.
    const MAX_VOLATILITY = 0.05;

    // The files and tag settings come from the elements in index.html that declare a feed:
    // the treemaps (data-treemap) and other consumers such as the ticker (data-feed).
    const treemapFiles = [...html.matchAll(/<[a-z][\w-]*\b[^>]*\bdata-(?:treemap|feed)="[^"]*"[^>]*>/g)]
        .map(match => ({
            file: (/data-url="([^"]+)"/.exec(match[0]) || [])[1],
            useTags: /data-use-tags="true"/.test(match[0])
        }))
        .filter(entry => entry.file);

    treemapFiles.forEach(({ file, useTags }) => {
        const root = readJson(file);
        if (!root) return;

        const walk = (node, trail) => {
            const label = node.name || node.tag || '(unnamed)';
            const here = [...trail, label].join(' > ');
            if (!node.name && !node.tag) warn(file, `${here}: node has no name or tag`);
            const hasVolatility = Object.prototype.hasOwnProperty.call(node, 'volatility');

            const children = Array.isArray(node.children) ? node.children : [];
            if (children.length) {
                if (Object.prototype.hasOwnProperty.call(node, 'value')) {
                    error(file, `${here}: parent has an explicit "value"; it is ignored and computed from its children`);
                }
                if (hasVolatility) {
                    warn(file, `${here}: parent has a "volatility"; only leaves move on their own, so it is ignored. Set it on the leaves instead`);
                }
                const seen = new Set();
                children.forEach(child => {
                    const key = child.tag || child.name;
                    if (seen.has(key)) error(file, `${here}: two children share the key "${key}"`);
                    seen.add(key);
                    if (useTags && !child.tag) warn(file, `${here} > ${child.name || '(unnamed)'}: no "tag" (tags are used as labels here)`);
                    walk(child, [...trail, label]);
                });
            } else {
                if (!(Number(node.value) > 0)) warn(file, `${here}: leaf has no positive "value"`);
                if (!hasVolatility) return;
                const volatility = node.volatility;
                if (typeof volatility !== 'number' || !Number.isFinite(volatility) || volatility < 0) {
                    warn(file, `${here}: "volatility" must be a number from 0 (a fraction of the value per tick, 0.01 is 1%); simulation.js falls back to its size rule`);
                } else if (volatility > MAX_VOLATILITY) {
                    warn(file, `${here}: "volatility" ${volatility} is larger than ${MAX_VOLATILITY}; it is a fraction of the value per tick (0.01 is 1%), not a percent`);
                }
            }
        };
        walk(root, []);
    });
}

// ---------------------------------------------------------------------- feeds

// A feed only loads when an element in index.html declares it with a data-url: a treemap
// (data-treemap) or another consumer (data-feed). A ledger or a script that reads an
// undeclared feed stays empty without an error in the browser.
function checkFeeds(html) {
    if (!html) return;
    const declared = new Set();
    for (const match of html.matchAll(/<[a-z][\w-]*\b[^>]*>/g)) {
        const tag = match[0];
        if (!/\bdata-url="/.test(tag)) continue;
        const id = /\bdata-(?:treemap|feed)="([^"]+)"/.exec(tag)?.[1];
        if (id) declared.add(id);
    }
    for (const match of html.matchAll(/\bdata-ledger="([^"]+)"/g)) {
        if (!declared.has(match[1])) {
            warn('html', `index.html: data-ledger="${match[1]}" names a feed that no element declares with a data-url (data-treemap or data-feed), so the ledger stays empty`);
        }
    }
    // data-sort orders a ledger (ledger.js): "value" or "change".
    for (const match of html.matchAll(/<[a-z][\w-]*\b[^>]*\bdata-sort="([^"]*)"[^>]*>/g)) {
        if (!/\bdata-ledger="/.test(match[0])) {
            warn('html', `index.html: data-sort="${match[1]}" is on an element without data-ledger, so nothing reads it`);
        } else if (!['value', 'change'].includes(match[1])) {
            warn('html', `index.html: data-sort="${match[1]}" is not "value" or "change", so the ledger sorts by value`);
        }
    }
    // data-compact trims a ledger to name and change (ledger.js, ledger.css).
    for (const match of html.matchAll(/<[a-z][\w-]*\b[^>]*\bdata-compact\b[^>]*>/g)) {
        if (!/\bdata-ledger="/.test(match[0])) {
            warn('html', 'index.html: data-compact is on an element without data-ledger, so nothing reads it');
        }
    }
    listJs('src/js').forEach(rel => {
        for (const match of read(abs(rel)).matchAll(/\bgetFeed\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            if (!declared.has(match[1])) {
                warn('html', `${rel} reads the "${match[1]}" feed, which no element in index.html declares with a data-url (data-treemap or data-feed)`);
            }
        }
    });
}

// ---------------------------------------------------------------- chart window

// index.html without its comments, so the markup checks below only see real elements.
const withoutComments = html => html.replace(/<!--[\s\S]*?-->/g, '');

// chart.js puts the charts into [data-chart-panels], names the one on screen in
// [data-chart-name] and steps through them with the [data-chart-step] keys (-1 for the
// previous chart, 1 for the next).
function checkChartWindow(html) {
    if (!html) return;
    const markup = withoutComments(html);
    if (markup.includes('data-chart-summary') && !markup.includes('data-chart-panels')) {
        warn('html', 'index.html: there is a data-chart-summary but no data-chart-panels, so no chart is drawn');
    }
    if (markup.includes('data-chart-panels') && !markup.includes('data-chart-name')) {
        warn('html', 'index.html: there is a data-chart-panels but no data-chart-name, so the chart nav bar names no chart');
    }
    for (const match of markup.matchAll(/\sdata-chart-step="([^"]*)"/g)) {
        if (!['-1', '1'].includes(match[1])) {
            warn('html', `index.html: data-chart-step="${match[1]}" is not "-1" or "1", so the key does not step to another chart`);
        }
    }
}

// ---------------------------------------------------------------------- panels

// panel-toggle.js shows the element whose id a button's data-panel-target names, but
// only when that element is in the button's data-panel-group: otherwise the button
// does nothing. pois.js builds the POI buttons, so only the ones in index.html are checked.
function checkPanelTargets(html) {
    if (!html) return;
    const tags = [...withoutComments(html).matchAll(/<[a-z][\w-]*\b[^>]*>/g)].map(match => match[0]);
    const idOf = tag => /\sid="([^"]*)"/.exec(tag)?.[1];
    const groupOf = tag => /\sdata-panel-group="([^"]*)"/.exec(tag)?.[1];
    const targetOf = tag => /\sdata-panel-target="([^"]*)"/.exec(tag)?.[1];
    const panelGroups = new Map();
    tags.forEach(tag => {
        const id = idOf(tag);
        if (id !== undefined && targetOf(tag) === undefined) panelGroups.set(id, groupOf(tag));
    });
    tags.forEach(tag => {
        const target = targetOf(tag);
        if (target === undefined) return;
        const group = groupOf(tag);
        if (!panelGroups.has(target)) {
            warn('html', `index.html: data-panel-target="${target}" names no element in index.html, so its button shows nothing`);
        } else if (panelGroups.get(target) !== group) {
            warn('html', `index.html: data-panel-target="${target}" names an element outside the button's data-panel-group ("${group ?? ''}"), so the button shows nothing`);
        }
    });
}

// treemap.js fills the nav bar of each treemap panel: the level name (data-treemap-name)
// and the back key (data-treemap-back).
function checkTreemapPanels(html) {
    if (!html) return;
    const markup = withoutComments(html);
    const count = name => markup.split(name).length - 1;
    const panels = count('data-treemap-panel');
    if (count('data-treemap-name') < panels) {
        warn('html', 'index.html: a data-treemap-panel has no data-treemap-name, so its nav bar names no level');
    }
    if (count('data-treemap-back') < panels) {
        warn('html', 'index.html: a data-treemap-panel has no data-treemap-back, so there is no key back up from a level');
    }
}

// -------------------------------------------------------------- scenario data

function checkScenario() {
    const rel = 'data/scenario-data.json';
    const scenario = readJson(rel);
    if (!scenario) return;
    const series = scenario.series || {};
    const pointsBySeries = scenario.points || {};
    const timeline = scenario.timeline || {};

    const range = {};
    Object.keys(pointsBySeries).forEach(key => {
        if (!series[key]) warn(rel, `points "${key}" has no entry in series, so it never gets a chart`);
        const points = Array.isArray(pointsBySeries[key]) ? pointsBySeries[key] : [];
        const valid = points.filter(p => Number.isFinite(p.year) && Number.isFinite(p.value));
        if (valid.length !== points.length) warn(rel, `${key}: ${points.length - valid.length} point(s) without a numeric year/value are ignored`);
        if (valid.length < 2) {
            warn(rel, `${key}: needs at least 2 valid points to draw a line`);
            return;
        }
        const years = valid.map(p => p.year);
        if (new Set(years).size !== years.length) warn(rel, `${key}: has duplicate years`);
        range[key] = [Math.min(...years), Math.max(...years)];
        if (Number.isFinite(timeline.baselineYear) && !years.includes(timeline.baselineYear)) {
            warn(rel, `${key}: no ${timeline.baselineYear} point, so its summary row shows N/A`);
        }
    });
    Object.keys(series).forEach(key => {
        if (!range[key]) warn(rel, `series "${key}" has no usable points, so it gets no chart`);
        // chart.js no longer shows series icons, so an icon is left over from the old chart tabs.
        if ('icon' in series[key]) warn(rel, `series "${key}": "icon" is no longer used by the charts`);
    });

    const unknownSeries = (item, kind, label) => (item.series || []).filter(s => {
        if (series[s]) return false;
        warn(rel, `${kind} "${label}" refers to unknown series "${s}"`);
        return true;
    });

    (timeline.events || []).forEach(event => {
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

    (timeline.eras || []).forEach(era => {
        if (!(era.start < era.end)) warn(rel, `era "${era.label}": start (${era.start}) must be before end (${era.end})`);
        unknownSeries(era, 'era', era.label);
    });

    // Without the slider the globe uses this constant, so it should match the chart.
    const globePath = abs('src/js/globe.js');
    const sea = Array.isArray(pointsBySeries.seaLevel) ? pointsBySeries.seaLevel.slice().sort((a, b) => a.year - b.year) : [];
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

    for (const match of html.matchAll(/\b(?:src|href|data-url)="([^"]+)"/g)) {
        if (isExternal(match[1])) continue;
        if (!exists(abs(stripQuery(match[1])))) error('assets', `index.html references "${match[1]}" which does not exist`);
    }

    // A button only fits an image to itself when its class says how (src/css/buttons.css):
    // btn-icon for an icon key, btn-plain for a button with no key look.
    for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        if (!/<img\b/.test(match[2])) continue;
        const classes = (/\bclass="([^"]*)"/.exec(match[1])?.[1] || '').split(/\s+/);
        if (classes.includes('btn-icon') || classes.includes('btn-plain')) continue;
        const label = /\b(?:id|aria-label)="([^"]*)"/.exec(match[1])?.[1] || 'a button';
        warn('html', `index.html: "${label}" holds an image but has neither the btn-icon nor the btn-plain class, so the image is drawn at its own size`);
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
        const globeCode = read(abs('src/js/globe.js'));
        const list = /const\s+ELEVATION_URLS\s*=\s*\[([^\]]*)\]/.exec(globeCode);
        const urls = list ? [...list[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
        if (!list) warn('globe', 'ELEVATION_URLS was not found in globe.js, so elevation files were not checked');
        urls.forEach((url, index) => {
            if (exists(path.resolve(abs('src/js'), url))) return;
            const message = `globe.js loads "${url}" (resolved from src/js/) which does not exist`;
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

// ---------------------------------------------------------------------- relations

function checkRelations() {
    // Relations larger than this are probably a typo (the guide in data/relations.md
    // suggests small fixed steps, and the existing data stays below this).
    const MAX_RELATION_WEIGHT = 0.25;
    // simulation.js passes bloc/corp pushes on from link to link and shifts resting
    // values by them. They fade only while each item's total incoming bloc/corp weight
    // stays small, so warn when one goes above this.
    const MAX_INCOMING_LINK_WEIGHT = 0.75;
    const incomingLinkWeight = new Map();

    // Index every node of the database files by its tag and by its name, the two keys
    // simulation.js uses to resolve a fromKey/toKey. depth 1 is a top-level
    // entity (a direct child of the root); the root itself is not a valid key.
    const nodesByKey = new Map();
    let nodeCount = 0;
    ['data/good-data.json', 'data/corp-data.json', 'data/bloc-data.json'].forEach(file => {
        const data = readJson(file);
        if (!data) return;
        const isGood = file === 'data/good-data.json';
        (function walk(node, depth) {
            if (!node || typeof node !== 'object') return;
            const id = ++nodeCount;
            if (depth > 0) {
                new Set([node.tag, node.name].filter(key => typeof key === 'string' && key)).forEach(key => {
                    if (!nodesByKey.has(key)) nodesByKey.set(key, []);
                    nodesByKey.get(key).push({ id, good: isGood, topLevel: depth === 1, byTag: key === node.tag });
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
        ['fromKey', 'toKey'].forEach(field => {
            const value = entry[field];
            if (typeof value !== 'string' || !value) {
                error('relations', `${where}: missing ${field}`);
                return;
            }
            const records = nodesByKey.get(value);
            if (!records) {
                error('relations', `${where}: ${field} "${value}" is not a known name or tag in good-data.json, corp-data.json, or bloc-data.json`);
                return;
            }
            matches[field] = records;
            if (new Set(records.map(record => record.id)).size > 1) {
                warn('relations', `${where}: ${field} "${value}" matches more than one entry in the data files, so it is ambiguous`);
            }
        });

        // Rules from data/relations.md.
        const { fromKey: from, toKey: to } = matches;
        if (to) {
            if (to.some(record => record.good)) {
                error('relations', `${where}: toKey "${entry.toKey}" is a good; goods can only be a fromKey`);
            } else if (!to.some(record => record.topLevel)) {
                error('relations', `${where}: toKey "${entry.toKey}" is a child entity; a toKey must be a top-level parent entity`);
            }
        }
        if (from && from.some(record => record.good) && !from.some(record => record.good && record.byTag)) {
            warn('relations', `${where}: good fromKey "${entry.fromKey}" is a name; use the good's tag`);
        }

        if (from && to) {
            if (entry.fromKey === entry.toKey) {
                error('relations', `${where}: fromKey and toKey are both "${entry.fromKey}"`);
            }
            const pair = `${entry.fromKey}\u0000${entry.toKey}`;
            if (seenPairs.has(pair)) {
                warn('relations', `${where}: repeats relations[${seenPairs.get(pair)}] (${entry.fromKey} -> ${entry.toKey})`);
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

        if (from && to && !from.some(record => record.good) && Number.isFinite(entry.weight)) {
            incomingLinkWeight.set(entry.toKey, (incomingLinkWeight.get(entry.toKey) || 0) + Math.abs(entry.weight));
        }
    });

    incomingLinkWeight.forEach((total, toKey) => {
        if (total > MAX_INCOMING_LINK_WEIGHT) {
            warn('relations', `"${toKey}" receives bloc/corp links totalling ${total.toFixed(2)} (absolute weights); above ${MAX_INCOMING_LINK_WEIGHT} pushes passed between linked items fade slowly, and at 1 they stop fading`);
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
            const code = read(abs(rel));
            // Copy to a temp file with an explicit extension so a future package.json
            // "type" setting cannot change how the file is parsed.
            const isModule = /\bimport\.meta\b|^\s*(?:import|export)\s/m.test(code);
            const target = path.join(temp, `${index}${isModule ? '.mjs' : '.cjs'}`);
            fs.writeFileSync(target, code);
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
    const cssTexts = cssFiles.map(rel => [rel, read(abs(rel))]);
    const defined = new Set();
    cssTexts.forEach(([, text]) => {
        for (const match of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);
        for (const match of text.matchAll(/@property\s+(--[\w-]+)/g)) defined.add(match[1]);
    });
    const scripts = ['src/default.js', ...listJs('src/js')]
        .filter(rel => exists(abs(rel)))
        .map(rel => read(abs(rel)))
        .join('\n') + html;
    for (const match of scripts.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) defined.add(match[1]);
    for (const match of scripts.matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);

    cssTexts.forEach(([rel, text]) => {
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
function exportedNames(code) {
    const names = new Set();
    for (const match of code.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
        names.add(match[1]);
    }
    for (const match of code.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
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
        const code = read(file);
        const dir = path.dirname(file);

        // Static imports: import './x.js', import { a, b as c } from './x.js'
        for (const match of code.matchAll(/^\s*import\s+(?:([^'";]+?)\s+from\s+)?['"]([^'"]+)['"]/gm)) {
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

        // Dynamic imports of local files (the POI JSON, for example).
        for (const match of code.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]/g)) {
            if (!exists(path.resolve(dir, match[1]))) error('modules', `${rel} dynamically imports "${match[1]}" which does not exist`);
        }
    }

    listJs('src/js').forEach(rel => {
        if (!reached.has(abs(rel))) warn('modules', `${rel} is not imported from ${entry} (directly or through another module), so it never runs`);
    });
}

// ------------------------------------------------------------------------ main

const loc = checkLocalization();
checkPois(loc);
const html = checkHtmlAndAssets(loc);
checkStylesheets(html);
checkTreemaps(html);
checkFeeds(html);
checkChartWindow(html);
checkPanelTargets(html);
checkTreemapPanels(html);
checkDataFileDuplicates('data/good-data.json');
checkDataFileDuplicates('data/corp-data.json');
checkDataFileDuplicates('data/bloc-data.json');
checkRelations();
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

