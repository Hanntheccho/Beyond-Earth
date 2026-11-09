// Builds the affy map before default.js binds the shared tooltip behavior.
// The whole graph rotates in a loop, in quick one-vertex steps with a rest between
// them. The lines live in one <g> that is
// rotated with an SVG transform; the node buttons are foreignObjects that are
// moved along the same orbit, so they travel with the graph but their icons
// stay upright. A single angle drives both, so they can never drift apart.
(function () {
    const map = document.querySelector('.affy-map');
    if (!map) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'affy-map-lines');
    svg.setAttribute('viewBox', '0 0 600 520');
    svg.setAttribute('aria-hidden', 'true');

    const CENTER = { x: 300, y: 260 };
    // Stepped rotation: the ring turns one vertex (60 degrees) quickly, then rests.
    // 60 degrees maps the hexagon onto itself, so every stop lands exactly on a vertex.
    const STEP_ANGLE = 360 / 6;
    const MOVE_TIME = 0.8; // seconds spent turning between vertices
    const HOLD_TIME = 2.2; // seconds resting on each vertex
    const CYCLE_TIME = MOVE_TIME + HOLD_TIME;
    const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
    // Everything that rotates as a drawing (the links and their gradients) goes in here.
    const rotor = document.createElementNS(svgNS, 'g');
    rotor.setAttribute('class', 'affy-rotor');

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
        line.dataset.from = affy.id;
        line.dataset.to = neighbor.id;
        rotor.append(line);
    });

    ideologicalNodes.forEach(affy => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', neutrality.x);
        line.setAttribute('y1', neutrality.y);
        line.setAttribute('x2', affy.x);
        line.setAttribute('y2', affy.y);
        line.setAttribute('class', 'affy-link affy-link--soft');
        line.setAttribute('stroke', addGradient(`affy-neutrality-${affy.id}`, neutrality, affy));
        line.dataset.from = neutrality.id;
        line.dataset.to = affy.id;
        rotor.append(line);
    });
    svg.append(definitions, rotor);

    const placed = [];
    affinities.forEach(affy => {
        const size = 144;
        const buttonSize = 84;
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
        button.dataset.affy = affy.id;
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
        placed.push({ node, affy, size });
    });
    map.append(svg);

    // ---------------------------------------------------------------- rotation

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let angle = 0;
    let clock = 0; // seconds into the step loop
    let last = 0;
    let raf = 0;
    let inViewport = false;
    let hovered = 0; // nodes currently hovered or focused; the ring rests while > 0

    function applyRotation() {
        rotor.setAttribute('transform', `rotate(${angle.toFixed(3)} ${CENTER.x} ${CENTER.y})`);
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        placed.forEach(({ node, affy, size }) => {
            const dx = affy.x - CENTER.x, dy = affy.y - CENTER.y;
            node.setAttribute('x', (CENTER.x + dx * cos - dy * sin - size / 2).toFixed(2));
            node.setAttribute('y', (CENTER.y + dx * sin + dy * cos - size / 2).toFixed(2));
        });
    }

    function frame(now) {
        raf = 0;
        if (document.hidden || reducedMotion.matches) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        clock = (clock + dt) % (CYCLE_TIME * 6);
        if (hovered && clock % CYCLE_TIME > MOVE_TIME) {
            // Hovering: a turn already in progress finishes, then the ring keeps resting.
            clock = Math.floor(clock / CYCLE_TIME) * CYCLE_TIME + MOVE_TIME;
        }
        const step = Math.floor(clock / CYCLE_TIME);
        const t = Math.min(1, (clock % CYCLE_TIME) / MOVE_TIME);
        const next = (step + easeInOut(t)) * STEP_ANGLE;
        if (next !== angle) {
            angle = next;
            applyRotation();
        }
        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (raf || document.hidden || reducedMotion.matches || !inViewport) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function setViewportVisibility(isVisible) {
        if (inViewport === isVisible) return;
        inViewport = isVisible;
        map.classList.toggle('is-inview', inViewport);
        if (inViewport) {
            start();
        } else {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    }

    document.addEventListener('visibilitychange', start);
    window.viewportVisibility.observe(map, setViewportVisibility);
    reducedMotion.addEventListener('change', () => {
        if (reducedMotion.matches) {
            angle = 0;
            applyRotation();
        } else {
            start();
        }
    });

    // ------------------------------------------------------------- hover focus

    // Hovering or focusing a node holds the rotation (so the node and its tooltip
    // stay put) and dims every link that does not touch it.
    const links = svg.querySelectorAll('.affy-link');
    svg.querySelectorAll('.affy-node').forEach(node => {
        const id = node.dataset.affy;
        const enter = () => {
            hovered++;
            svg.classList.add('is-focusing');
            links.forEach(link => {
                link.classList.toggle('is-related', link.dataset.from === id || link.dataset.to === id);
            });
        };
        const leave = () => {
            hovered = Math.max(0, hovered - 1);
            if (hovered) return;
            svg.classList.remove('is-focusing');
            links.forEach(link => link.classList.remove('is-related'));
            start();
        };
        node.addEventListener('pointerenter', enter);
        node.addEventListener('pointerleave', leave);
        node.addEventListener('focusin', enter);
        node.addEventListener('focusout', leave);
    });
})();
