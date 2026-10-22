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
        const svg = addSvg(host, 'svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${current.node.name} GDP treemap` });
        const rects = squarify(items, 0, 0, width, height);
        rects.forEach(({ node, x, y, w, h }) => {
            const group = addSvg(svg, 'g', { class: `gdp-tile${node.children.length ? ' has-children' : ''}`, tabindex: '0', role: node.children.length ? 'button' : 'img', 'aria-label': `${node.name}: €$${formatter.format(node.value)}${node.children.length ? ', open details' : ''}` });
            const hue = (node.name.split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 17 + (current.depth + 1) * 37) % 360;
            addSvg(group, 'rect', { x: x + 2, y: y + 2, width: Math.max(0, w - 4), height: Math.max(0, h - 4), rx: 3, fill: `hsl(${hue} 54% ${node.children.length ? 31 : 25}%)`, class: 'gdp-tile-bg' });
            const label = addSvg(group, 'text', { x: x + 12, y: y + 24, class: 'gdp-tile-name' }, node.name);
            const valueText = addSvg(group, 'text', { x: x + 12, y: y + 44, class: 'gdp-tile-value' }, `€$${formatter.format(node.value)}`);
            if (w < 100 || h < 43) { label.setAttribute('display', 'none'); valueText.setAttribute('display', 'none'); }
            else if (h < 64) valueText.setAttribute('display', 'none');
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
        status.textContent = `${current.node.name} · €$${formatter.format(sum)} total · ${items.length} ${items.length === 1 ? 'tile' : 'tiles'}${items.some(item => item.children.length) ? ' · Select a tile to explore' : ''}`;
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
