/**
 * influence-graph.js - Force-directed graph visualization for data dependencies.
 */
(function () {
    const container = document.getElementById('influence-graph-container');
    if (!container) return;

    let simulation, svg;
    const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

    function initGraph() {
        container.style.display = 'block';
        const width = container.clientWidth;
        const height = container.clientHeight;

        svg = d3.select('#influence-graph-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const markers = svg.append('defs');
        [
            { id: 'relationship-arrow-positive', className: 'relationship-arrow-positive' },
            { id: 'relationship-arrow-negative', className: 'relationship-arrow-negative' }
        ].forEach(marker => {
            markers.append('marker')
                .attr('id', marker.id)
                .attr('class', marker.className)
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 9)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .attr('markerUnits', 'strokeWidth')
                .append('path')
                .attr('d', 'M0,-5L10,0L0,5');
        });

        simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(60))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('collide', d3.forceCollide().strength(0.85).iterations(2))
            .force('center', d3.forceCenter(width / 2, height / 2 + 24));
    }

    function update(data) {
        if (!simulation) initGraph();

        const maxLogValue = Math.max(
            0.001,
            ...data.nodes
                .filter(node => node.hasData !== false)
                .map(node => Math.log10(Math.max(0, Number(node.value) || 0) + 1))
        );
        const exponentialScale = Math.exp(3) - 1;

        const nodes = data.nodes.map(n => {
            const radius = n.hasData === false
                ? 5
                : 5 + 51 * (
                    Math.exp(3 * Math.log10(Math.max(0, Number(n.value) || 0) + 1) / maxLogValue) - 1
                ) / exponentialScale;
            const availableWidth = Math.max(0, radius * 2 - 8);
            const widthBasedFontSize = availableWidth / (String(n.name || '').length * 0.65);
            const labelFontSize = Math.min(radius * 0.5, widthBasedFontSize);

            return {
                ...n,
                radius,
                labelFontSize
            };
        });

        const links = [
            ...data.dependencies.map(d => ({
                ...d,
                source: d.sourceKey,
                target: d.targetKey,
                type: 'dep',
                weight: Number(d.weight) || 0
            })),
            ...data.influences.map(d => ({
                ...d,
                source: d.sourceKey,
                target: d.targetKey,
                type: 'inf',
                weight: Number(d.weight) || 0
            }))
        ];

        const linksByPair = new Map();
        links.forEach(link => {
            const pairKey = JSON.stringify([link.sourceKey, link.targetKey].sort());
            if (!linksByPair.has(pairKey)) linksByPair.set(pairKey, []);
            linksByPair.get(pairKey).push(link);
        });
        linksByPair.forEach(group => {
            group.forEach((link, index) => {
                const sideOffset = (index - (group.length - 1) / 2) * 24;
                const direction = link.sourceKey.localeCompare(link.targetKey) <= 0 ? 1 : -1;
                link.curveOffset = sideOffset * direction;
            });
        });

        simulation.nodes(nodes);
        simulation.force('link').links(links);
        simulation.force('collide').radius(node => node.radius + 8);

        const link = svg.selectAll('.link').data(
            links,
            d => JSON.stringify([d.sourceKey, d.targetKey, d.type])
        );
        link.exit().remove();
        const linkEnter = link.enter().append('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('marker-end', d => `url(#relationship-arrow-${d.weight < 0 ? 'negative' : 'positive'})`);
        linkEnter.append('title');

        const node = svg.selectAll('.node-group').data(nodes, d => d.id);
        node.exit().remove();
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node-group')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        nodeEnter.append('circle');

        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central');
        nodeEnter.append('title');

        const nodeMerge = nodeEnter.merge(node);
        const linkMerge = linkEnter.merge(link);
        nodeMerge
            .classed('is-unavailable', d => d.hasData === false)
            .classed('is-down', d => d.hasData !== false && d.changePercent < 0)
            .classed('is-up', d => d.hasData !== false && d.changePercent >= 0);
        nodeMerge.select('circle')
            .attr('r', d => d.radius);
        nodeMerge.select('text')
            .text(d => d.name)
            .attr('font-size', d => d.labelFontSize)
            .attr('visibility', d => d.labelFontSize >= 1 ? 'visible' : 'hidden');
        nodeMerge.select('title').text(d => {
            if (d.hasData === false) return `${d.name}: data unavailable`;
            const change = Number(d.changePercent) || 0;
            return `${d.name}\nValue: ${numberFormat.format(d.value)}\nChange: ${change >= 0 ? '+' : ''}${numberFormat.format(change)}%`;
        });
        const nodesById = new Map(nodes.map(nodeData => [nodeData.id, nodeData]));
        linkMerge
            .attr('stroke-width', d => Math.min(4, 0.75 + Math.abs(d.weight) * 12))
            .classed('is-positive', d => d.weight >= 0)
            .classed('is-negative', d => d.weight < 0)
            .classed('is-dependency', d => d.type === 'dep')
            .classed('is-influence', d => d.type === 'inf')
            .attr('marker-end', d => `url(#relationship-arrow-${d.weight < 0 ? 'negative' : 'positive'})`);
        linkMerge.select('title').text(d => {
            const source = nodesById.get(d.sourceKey);
            const target = nodesById.get(d.targetKey);
            const type = d.type === 'dep' ? 'Dependency' : 'Influence';
            return `${source.name} -> ${target.name}\n${type} weight: ${numberFormat.format(d.weight)}`;
        });

        simulation.alpha(0.3).restart();

        simulation.on('tick', () => {
            linkMerge
                .attr('d', d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const startX = d.source.x + dx / distance * d.source.radius;
                    const startY = d.source.y + dy / distance * d.source.radius;
                    const endX = d.target.x - dx / distance * d.target.radius;
                    const endY = d.target.y - dy / distance * d.target.radius;
                    const controlX = (startX + endX) / 2 - dy / distance * d.curveOffset;
                    const controlY = (startY + endY) / 2 + dx / distance * d.curveOffset;
                    return `M${startX},${startY} Q${controlX},${controlY} ${endX},${endY}`;
                });

            nodeMerge.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }

    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    window.influenceGraph = { update };
})();
