// Builds the affy map before default.js binds the shared tooltip behavior.
(function () {
    const map = document.querySelector('.affy-map');
    if (!map) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'affy-map-lines');
    svg.setAttribute('viewBox', '0 0 600 520');
    svg.setAttribute('aria-hidden', 'true');

    const affinities = [
        { id: 'purity', name: 'Purity', icon: 'gfx/affy/purity.svg', description: 'affyPUR-desc', color: '#ff0000', x: 300, y: 42 },
        { id: 'divinity', name: 'Divinity', icon: 'gfx/affy/divinity.svg', description: 'affyDIV-desc', color: '#a200ff', x: 490, y: 152 },
        { id: 'harmony', name: 'Harmony', icon: 'gfx/affy/harmony.svg', description: 'affyHAR-desc', color: '#00e1ff', x: 490, y: 368 },
        { id: 'synergy', name: 'Synergy', icon: 'gfx/affy/synergy.svg', description: 'affySYN-desc', color: '#09ff00', x: 300, y: 478 },
        { id: 'supremacy', name: 'Supremacy', icon: 'gfx/affy/supremacy.svg', description: 'affySUP-desc', color: '#fbff00', x: 110, y: 368 },
        { id: 'mastery', name: 'Mastery', icon: 'gfx/affy/mastery.svg', description: 'affyMAS-desc', color: '#ffa600', x: 110, y: 152 },
        { id: 'neutrality', name: 'Neutral', icon: 'gfx/affy/neutrality.svg', description: 'affyNEU-desc', color: '#ffffff', x: 300, y: 260 }
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

    ideologicalNodes.forEach((affy, index) => {
        const neighbor = ideologicalNodes[(index + 1) % ideologicalNodes.length];
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', affy.x);
        line.setAttribute('y1', affy.y);
        line.setAttribute('x2', neighbor.x);
        line.setAttribute('y2', neighbor.y);
        line.setAttribute('class', 'affy-link affy-link--strong');
        line.setAttribute('stroke', addGradient(`affy-neighbor-${affy.id}-${neighbor.id}`, affy, neighbor));
        svg.append(line);
    });

    ideologicalNodes.forEach(affy => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', neutrality.x);
        line.setAttribute('y1', neutrality.y);
        line.setAttribute('x2', affy.x);
        line.setAttribute('y2', affy.y);
        line.setAttribute('class', 'affy-link affy-link--soft');
        line.setAttribute('stroke', addGradient(`affy-neutrality-${affy.id}`, neutrality, affy));
        svg.append(line);
    });
    svg.insertBefore(definitions, svg.firstChild);
    affinities.forEach(affy => {
        const size = 144;
        const buttonSize = affy.id === 'neutrality' ? 76 : 84;
        const node = document.createElementNS(svgNS, 'foreignObject');
        node.setAttribute('x', affy.x - size / 2);
        node.setAttribute('y', affy.y - size / 2);
        node.setAttribute('width', size);
        node.setAttribute('height', size);

        const frame = document.createElement('div');
        frame.className = 'affy-node-frame';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `affy-node affy-node--${affy.id} has-tooltip`;
        button.dataset.tooltip = affy.description;
        button.setAttribute('aria-label', affy.name);
        button.style.setProperty('--affy-color', affy.color);
        button.style.setProperty('--affy-node-size', `${buttonSize}px`);

        const icon = document.createElement('span');
        icon.className = 'affy-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.style.setProperty('--affy-icon', `url("${affy.icon}")`);
        button.append(icon);

        frame.append(button);
        node.append(frame);
        svg.append(node);
    });
    map.append(svg);
})();
