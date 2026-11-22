// svg.js - Small helpers for building SVG by hand (treemap.js, chart.js).
export const SVG_NS = 'http://www.w3.org/2000/svg';

// Width of one character as a fraction of the font size. The page font is
// monospaced, so this is its ch in em; it lets SVG text be measured without layout.
export const CHAR_WIDTH = 0.6;

// Creates an SVG element, sets the attributes that are not null/undefined, adds the
// optional text, appends it to parent and returns it.
export function appendSvg(parent, tag, attrs = {}, text) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value !== null && value !== undefined) element.setAttribute(key, value);
    }
    if (text !== undefined) element.textContent = text;
    parent.appendChild(element);
    return element;
}
