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
        { id: 'purity', name: 'Purity', symbol: '⬡', description: 'affPRT-desc', color: '#ff0000', x: 300, y: 42 },
        { id: 'divinity', name: 'Divinity', symbol: '✦', description: 'affDVN-desc', color: '#a200ff', x: 490, y: 152 },
        { id: 'harmony', name: 'Harmony', symbol: '❋', description: 'affHRM-desc', color: '#00e1ff', x: 490, y: 368 },
        { id: 'synergy', name: 'Synergy', symbol: '⟳', description: 'affSYN-desc', color: '#09ff00', x: 300, y: 478 },
        { id: 'supremacy', name: 'Supremacy', symbol: '⌘', description: 'affSPR-desc', color: '#fbff00', x: 110, y: 368 },
        { id: 'mastery', name: 'Mastery', symbol: '◈', description: 'affMST-desc', color: '#ffa600', x: 110, y: 152 },
        { id: 'neutral', name: 'Neutral', symbol: '◉', description: 'affNTR-desc', color: '#ffffff', x: 300, y: 260 }
    ];

    // Use one coordinate source for both line endpoints and node centers.
    // Every pair connects; the six edges around the perimeter are emphasized.
    const definitions = document.createElementNS(svgNS, 'defs');
    const ideologicalNodes = affinities.slice(0, 6);
    for (let firstIndex = 0; firstIndex < ideologicalNodes.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < ideologicalNodes.length; secondIndex++) {
            const first = ideologicalNodes[firstIndex];
            const second = ideologicalNodes[secondIndex];
            const gradient = document.createElementNS(svgNS, 'linearGradient');
            gradient.id = `affinity-link-${first.id}-${second.id}`;
            gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
            gradient.setAttribute('x1', first.x);
            gradient.setAttribute('y1', first.y);
            gradient.setAttribute('x2', second.x);
            gradient.setAttribute('y2', second.y);
            const start = document.createElementNS(svgNS, 'stop');
            start.setAttribute('stop-color', first.color);
            const end = document.createElementNS(svgNS, 'stop');
            end.setAttribute('offset', '1');
            end.setAttribute('stop-color', second.color);
            gradient.append(start, end);
            definitions.append(gradient);

            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', first.x);
            line.setAttribute('y1', first.y);
            line.setAttribute('x2', second.x);
            line.setAttribute('y2', second.y);
            const neighbors = secondIndex === firstIndex + 1 || (firstIndex === 0 && secondIndex === 5);
            line.setAttribute('class', `affinity-link${neighbors ? ' affinity-link--strong' : ' affinity-link--soft'}`);
            line.setAttribute('stroke', `url(#${gradient.id})`);
            svg.append(line);
        }
    }
    // Neutral stays central and connects lightly to each affinity.
    const neutral = affinities[6];
    ideologicalNodes.forEach(affinity => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', neutral.x);
        line.setAttribute('y1', neutral.y);
        line.setAttribute('x2', affinity.x);
        line.setAttribute('y2', affinity.y);
        line.setAttribute('class', 'affinity-link affinity-link--soft');
        line.setAttribute('stroke', '#dedede');
        svg.append(line);
    });
    svg.insertBefore(definitions, svg.firstChild);
    affinities.forEach(affinity => {
        const size = 144;
        const buttonSize = affinity.id === 'neutral' ? 76 : 84;
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

        const symbol = document.createElement('span');
        symbol.setAttribute('aria-hidden', 'true');
        symbol.textContent = affinity.symbol;
        button.append(symbol);
        frame.append(button);
        node.append(frame);
        svg.append(node);
    });
    map.append(svg);
})();
