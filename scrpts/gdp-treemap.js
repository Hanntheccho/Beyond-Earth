(function () {
    const host = document.querySelector('.gdp-treemap');
    if (!host) return;

    const status = document.querySelector('.gdp-status');
    const crumbs = document.querySelector('.gdp-breadcrumbs');
    const svgNS = 'http://www.w3.org/2000/svg';
    const formatter = new Intl.NumberFormat('en-US');
    const width = 800;
    const height = 800;
    let root;
    let path = [];

    function parse(text) {
        const roots = [];
        const stack = [];
        text.split(/\r?\n/).forEach(line => {
            if (!line.trim()) return;
            const indent = (line.match(/^\s*/) || [''])[0].length;
            const match = line.trim().match(/^(.*?)\s+(?:\(([-\d,]+)\)|([-\d,]+))\s*$/);
            if (!match) return;
            const node = { name: match[1].trim(), value: Number((match[2] || match[3]).replace(/,/g, '')), children: [] };
            while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
            if (stack.length) stack[stack.length - 1].node.children.push(node);
            else roots.push(node);
            stack.push({ indent, node });
        });
        return roots;
    }

    function addSvg(parent, tag, attrs, text) {
        const element = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function wrapName(name, maxChars) {
        const words = name.split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach(word => {
            while (word.length > maxChars) {
                if (line) { lines.push(line); line = ''; }
                lines.push(word.slice(0, maxChars));
                word = word.slice(maxChars);
            }
            if (line && `${line} ${word}`.length > maxChars) { lines.push(line); line = word; }
            else line = line ? `${line} ${word}` : word;
        });
        if (line) lines.push(line);
        return lines;
    }

    function fitLabel(name, value, w, h) {
        const availableWidth = Math.max(1, w - 8);
        const availableHeight = Math.max(1, h - 6);
        for (let fontSize = Math.min(16, availableWidth * 0.13, availableHeight * 0.2); fontSize >= 1.5; fontSize -= 0.25) {
            const maxChars = Math.max(1, Math.floor(availableWidth / (fontSize * 0.65)));
            const lines = wrapName(name, maxChars);
            const valueLabel = `€$${formatter.format(value)}`;
            const valueSize = Math.min(fontSize * 0.78, availableWidth / Math.max(1, valueLabel.length * 0.68));
            const lineHeight = fontSize * 1.08;
            const requiredHeight = lines.length * lineHeight + valueSize * 1.25 + 2;
            if (requiredHeight <= availableHeight) return { lines, fontSize, valueSize, lineHeight, requiredHeight };
        }
        const fontSize = 1.5;
        const lines = wrapName(name, Math.max(1, Math.floor(availableWidth / (fontSize * 0.65))));
        return { lines, fontSize, valueSize: 1, lineHeight: fontSize, requiredHeight: h };
    }

    function worst(row, side) {
        if (!row.length) return Infinity;
        const sum = row.reduce((total, item) => total + item.area, 0);
        const largest = Math.max(...row.map(item => item.area));
        const smallest = Math.min(...row.map(item => item.area));
        return Math.max((side * side * largest) / (sum * sum), (sum * sum) / (side * side * smallest));
    }

    function squarify(nodes, x, y, w, h) {
        const total = nodes.reduce((sum, node) => sum + node.value, 0);
        if (!total || !nodes.length || w <= 0 || h <= 0) return [];
        const scale = (w * h) / total;
        const remaining = nodes.map(node => ({ node, area: node.value * scale })).sort((a, b) => b.area - a.area);
        const rects = [];
        let row = [];
        let rx = x, ry = y, rw = w, rh = h;
        while (remaining.length) {
            const side = Math.min(rw, rh);
            const next = remaining[0];
            if (!row.length || worst(row.concat(next), side) <= worst(row, side)) {
                row.push(remaining.shift());
                continue;
            }
            placeRow(row); row = [];
        }
        if (row.length) placeRow(row);
        return rects;

        function placeRow(items) {
            const area = items.reduce((sum, item) => sum + item.area, 0);
            if (rw >= rh) {
                const strip = area / rh;
                let cy = ry;
                items.forEach(item => {
                    const ch = item.area / strip;
                    rects.push({ node: item.node, x: rx, y: cy, w: strip, h: ch });
                    cy += ch;
                });
                rx += strip; rw -= strip;
            } else {
                const strip = area / rw;
                let cx = rx;
                items.forEach(item => {
                    const cw = item.area / strip;
                    rects.push({ node: item.node, x: cx, y: ry, w: cw, h: strip });
                    cx += cw;
                });
                ry += strip; rh -= strip;
            }
        }
    }

    function render() {
        const current = path.length ? path[path.length - 1] : { node: root, depth: -1 };
        const items = current.node.children.length ? current.node.children : [current.node];
        const sum = items.reduce((total, item) => total + item.value, 0);
        host.replaceChildren();
        const svg = addSvg(host, 'svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
        const rects = squarify(items, 0, 0, width, height);
        rects.forEach(({ node, x, y, w, h }) => {
            const group = addSvg(svg, 'g', { class: `gdp-tile${node.children.length ? ' has-children' : ''}`, tabindex: '0', role: node.children.length ? 'button' : 'img', 'aria-label': `${node.name}: €$${formatter.format(node.value)}${node.children.length ? ', open details' : ''}` });
            const hue = (node.name.split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 17 + (current.depth + 1) * 37) % 360;
            addSvg(group, 'rect', { x: x + 2, y: y + 2, width: Math.max(0, w - 4), height: Math.max(0, h - 4), rx: 3, fill: `hsl(${hue} 54% ${node.children.length ? 31 : 25}%)`, class: 'gdp-tile-bg' });
            const fit = fitLabel(node.name, node.value, w - 4, h - 4);
            const centerX = x + w / 2;
            const topY = y + (h - fit.requiredHeight) / 2 + fit.fontSize;
            const label = addSvg(group, 'text', { x: centerX, y: topY, class: 'gdp-tile-name', style: `font-size:${fit.fontSize}px`, 'text-anchor': 'middle' });
            fit.lines.forEach((line, index) => addSvg(label, 'tspan', { x: centerX, dy: index === 0 ? 0 : fit.lineHeight }, line));
            addSvg(group, 'text', { x: centerX, y: topY + fit.lines.length * fit.lineHeight + fit.valueSize, class: 'gdp-tile-value', style: `font-size:${fit.valueSize}px`, 'text-anchor': 'middle' }, `€$${formatter.format(node.value)}`);
            addSvg(group, 'title', {}, `${node.name} — €$${formatter.format(node.value)}${node.children.length ? ' · Click to explore' : ''}`);
            if (node.children.length) {
                group.addEventListener('click', () => { path.push({ node, depth: current.depth + 1 }); render(); });
                group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); path.push({ node, depth: current.depth + 1 }); render(); } });
            }
        });

        crumbs.replaceChildren();
        const world = document.createElement('button');
        world.type = 'button'; world.textContent = 'World'; world.className = 'gdp-crumb';
        world.addEventListener('click', () => { path = []; render(); });
        crumbs.appendChild(world);
        path.forEach((entry, index) => {
            const sep = document.createElement('span'); sep.textContent = ' / '; sep.setAttribute('aria-hidden', 'true'); crumbs.appendChild(sep);
            const crumb = document.createElement('button'); crumb.type = 'button'; crumb.className = 'gdp-crumb'; crumb.textContent = entry.node.name;
            crumb.addEventListener('click', () => { path = path.slice(0, index + 1); render(); }); crumbs.appendChild(crumb);
        });
        status.textContent = `${current.node.name} · €$${formatter.format(sum)} total · ${items.length} ${items.length === 1 ? 'tile' : 'tiles'}`;
    }

    fetch('scrpts/country-gdp.txt').then(response => {
        if (!response.ok) throw new Error('GDP data could not be loaded.');
        return response.text();
    }).then(text => {
        root = { name: 'World', value: 0, children: parse(text) };
        if (!root.children.length) throw new Error('No GDP entries were found in the data file.');
        render();
    }).catch(() => { status.textContent = 'GDP data could not be loaded. Open this page through a local web server and check scrpts/country-gdp.txt.'; });
})();
