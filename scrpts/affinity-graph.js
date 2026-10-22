// Builds the affinity map before default.js binds the shared tooltip behavior.
(function () {
    const map = document.querySelector('.affinity-map');
    if (!map) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'affinity-map-lines');
    svg.setAttribute('viewBox', '0 0 600 520');
    svg.setAttribute('aria-hidden', 'true');

    const affinities = [
        { id: 'purity', name: 'Purity', icon: 'gfx/aff/purity.svg', description: 'affPUR-desc', color: '#ff0000', x: 300, y: 42 },
        { id: 'divinity', name: 'Divinity', icon: 'gfx/aff/divinity.svg', description: 'affDIV-desc', color: '#a200ff', x: 490, y: 152 },
        { id: 'harmony', name: 'Harmony', icon: 'gfx/aff/harmony.svg', description: 'affHAR-desc', color: '#00e1ff', x: 490, y: 368 },
        { id: 'synergy', name: 'Synergy', icon: 'gfx/aff/synergy.svg', description: 'affSYN-desc', color: '#09ff00', x: 300, y: 478 },
        { id: 'supremacy', name: 'Supremacy', icon: 'gfx/aff/supremacy.svg', description: 'affSUP-desc', color: '#fbff00', x: 110, y: 368 },
        { id: 'mastery', name: 'Mastery', icon: 'gfx/aff/mastery.svg', description: 'affMAS-desc', color: '#ffa600', x: 110, y: 152 },
        { id: 'neutrality', name: 'Neutral', symbol: '◉', description: 'affNEU-desc', color: '#ffffff', x: 300, y: 260 }
    ];

    // Emphasized perimeter links join neighbors; faint blended links meet at Neutrality.
    const ideologicalNodes = affinities.slice(0, 6);
    const neutrality = affinities[6];
    const definitions = document.createElementNS(svgNS, 'defs');

    function addGradient(id, from, to) {
        const gradient = document.createElementNS(svgNS, 'linearGradient');
        gradient.id = id;
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
        gradient.setAttribute('x1', from.x);
        gradient.setAttribute('y1', from.y);
        gradient.setAttribute('x2', to.x);
        gradient.setAttribute('y2', to.y);
        const start = document.createElementNS(svgNS, 'stop');
        start.setAttribute('stop-color', from.color);
        const end = document.createElementNS(svgNS, 'stop');
        end.setAttribute('offset', '1');
        end.setAttribute('stop-color', to.color);
        gradient.append(start, end);
        definitions.append(gradient);
        return `url(#${id})`;
    }

    ideologicalNodes.forEach((affinity, index) => {
        const neighbor = ideologicalNodes[(index + 1) % ideologicalNodes.length];
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', affinity.x);
        line.setAttribute('y1', affinity.y);
        line.setAttribute('x2', neighbor.x);
        line.setAttribute('y2', neighbor.y);
        line.setAttribute('class', 'affinity-link affinity-link--strong');
        line.setAttribute('stroke', addGradient(`affinity-neighbor-${affinity.id}-${neighbor.id}`, affinity, neighbor));
        svg.append(line);
    });

    ideologicalNodes.forEach(affinity => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', neutrality.x);
        line.setAttribute('y1', neutrality.y);
        line.setAttribute('x2', affinity.x);
        line.setAttribute('y2', affinity.y);
        line.setAttribute('class', 'affinity-link affinity-link--soft');
        line.setAttribute('stroke', addGradient(`affinity-neutrality-${affinity.id}`, neutrality, affinity));
        svg.append(line);
    });
    svg.insertBefore(definitions, svg.firstChild);
    affinities.forEach(affinity => {
        const size = 144;
        const buttonSize = affinity.id === 'neutrality' ? 76 : 84;
        const node = document.createElementNS(svgNS, 'foreignObject');
        node.setAttribute('x', affinity.x - size / 2);
        node.setAttribute('y', affinity.y - size / 2);
        node.setAttribute('width', size);
        node.setAttribute('height', size);

        const frame = document.createElement('div');
        frame.className = 'affinity-node-frame';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `affinity-node affinity-node--${affinity.id} has-tooltip`;
        button.dataset.tooltip = affinity.description;
        button.setAttribute('aria-label', affinity.name);
        button.style.setProperty('--affinity-color', affinity.color);
        button.style.setProperty('--affinity-node-size', `${buttonSize}px`);

        if (affinity.icon) {
            const icon = document.createElement('span');
            icon.className = 'affinity-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.style.setProperty('--affinity-icon', `url("${affinity.icon}")`);
            button.append(icon);
        } else {
            const symbol = document.createElement('span');
            symbol.setAttribute('aria-hidden', 'true');
            symbol.textContent = affinity.symbol || '';
            button.append(symbol);
        }
        frame.append(button);
        node.append(frame);
        svg.append(node);
    });
    map.append(svg);
})();
