// poi-data.js - Loads data/pois.json, the one list of POIs: their order, icons, nested POIs
// and globe positions. Names and descriptions stay in the localization files, under the
// POI's id ("poiFRA" and "poiFRA-desc"), so they can be translated.
// pois.js builds the POI buttons and panels from it, and globe.js the globe markers.
//
// Each entry: { id, icon?, background?, children?, globe? }
//   id          the localization key of the POI's name; "<id>-desc" is its description
//   icon        image path from the project root
//   background  { size } to show the icon behind the panel text, size in % of the panel's
//               width; needs an icon
//   children    ids of nested POIs, reached through {{id|text}} links in the text (see
//               loc.js); tools/validate.mjs checks that each one is linked
//   globe       { lat, lon, altitudeKm, size } of its globe marker; needs an icon
//
// A bad field is logged and dropped (a bad id drops the whole entry), so one typo does
// not take down the other POIs. tools/validate.mjs checks the same rules.

const ROOT_URL = new URL('../../', import.meta.url);
const ENTRY_FIELDS = new Set(['id', 'icon', 'background', 'children', 'globe']);

const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const GLOBE_FIELDS = {
    lat: value => inRange(value, -90, 90),
    lon: value => inRange(value, -180, 180),
    altitudeKm: value => inRange(value, 0, 100000),
    size: value => inRange(value, 0, 256) && value > 0
};

const isName = value => typeof value === 'string' && value.length > 0;

function readIcon(id, icon) {
    if (icon === undefined) return null;
    if (!isName(icon)) {
        console.error(`POI "${id}": "icon" must be a non-empty path; it has no icon.`);
        return null;
    }
    return new URL(icon, ROOT_URL).href;
}

function readBackground(id, background, icon) {
    if (background === undefined) return null;
    if (!background || typeof background !== 'object' || Array.isArray(background)) {
        console.error(`POI "${id}": "background" must be an object; its panel has no background.`);
        return null;
    }
    if (!inRange(background.size, 0, 100) || background.size <= 0) {
        console.error(`POI "${id}": background size must be a percentage above 0 and at most 100; its panel has no background.`);
        return null;
    }
    if (!icon) {
        console.error(`POI "${id}": a background needs an icon; its panel has no background.`);
        return null;
    }
    return { size: background.size };
}

function readChildren(id, children) {
    if (children === undefined) return [];
    if (!Array.isArray(children)) {
        console.error(`POI "${id}": "children" must be an array of ids; it has no nested POIs.`);
        return [];
    }
    const valid = children.filter(isName);
    if (valid.length !== children.length) {
        console.error(`POI "${id}": ${children.length - valid.length} child id(s) are not non-empty strings and are skipped.`);
    }
    return valid;
}

function readGlobe(id, globe, icon) {
    if (globe === undefined) return null;
    if (!globe || typeof globe !== 'object' || Array.isArray(globe)) {
        console.error(`POI "${id}": "globe" must be an object; it has no globe marker.`);
        return null;
    }
    const invalid = Object.keys(GLOBE_FIELDS).filter(field => !GLOBE_FIELDS[field](globe[field]));
    if (invalid.length) {
        console.error(`POI "${id}": invalid globe ${invalid.join(', ')}; it has no globe marker.`);
        return null;
    }
    if (!icon) {
        console.error(`POI "${id}": a globe marker needs an icon; it has no globe marker.`);
        return null;
    }
    const { lat, lon, altitudeKm, size } = globe;
    return { lat, lon, altitudeKm, size };
}

function readPois(list) {
    if (!Array.isArray(list)) throw new TypeError('data/pois.json must contain an array.');
    const ids = new Set();
    const pois = [];
    list.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object' || !isName(entry.id)) {
            console.error(`POI at index ${index} of data/pois.json has no id and is skipped.`);
            return;
        }
        const { id } = entry;
        if (ids.has(id)) {
            console.error(`POI "${id}" appears more than once in data/pois.json; only the first is used.`);
            return;
        }
        ids.add(id);
        const unknown = Object.keys(entry).filter(field => !ENTRY_FIELDS.has(field));
        if (unknown.length) console.warn(`POI "${id}": unknown field(s) ${unknown.join(', ')} are ignored.`);

        const icon = readIcon(id, entry.icon);
        pois.push(Object.freeze({
            id,
            icon,
            background: readBackground(id, entry.background, icon),
            children: Object.freeze(readChildren(id, entry.children)),
            globe: readGlobe(id, entry.globe, icon)
        }));
    });
    return Object.freeze(pois);
}

let poisPromise = null;

// The POIs in file order, read once and shared by every caller.
export function getPois() {
    poisPromise ??= import('../../data/pois.json', { with: { type: 'json' } })
        .then(({ default: list }) => readPois(list));
    return poisPromise;
}
