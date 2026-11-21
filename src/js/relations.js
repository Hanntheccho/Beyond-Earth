/**
 * relations.js - Force-directed graph visualization for weighted relations.
 */
(function () {
    const container = document.getElementById('influence-graph-container');
    if (!container) return;

    let simulation, svg;
    let simulationNodes = new Map();
    const draggedNodeIds = new Set();
    let selectedNodeId = null;
    let dragSimulationActive = false;
    let layoutInitialized = false;
    let inViewport = false;
    let latestData = null;
    let graphWidth = 0;
    let graphHeight = 0;
    const NODE_TRANSITION_DURATION = 400;
    const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

    function initGraph() {
        graphWidth = container.clientWidth;
        graphHeight = container.clientHeight;

        svg = d3.select('#influence-graph-container')
            .append('svg')
            .attr('width', graphWidth)
            .attr('height', graphHeight);

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
            .force('center', d3.forceCenter(graphWidth / 2, graphHeight / 2))
            .force('bounds', () => constrainNodesToBounds(simulation.nodes()))
            .stop();

        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => {
                graphWidth = container.clientWidth;
                graphHeight = container.clientHeight;
                svg.attr('width', graphWidth).attr('height', graphHeight);
                simulation.force('center')
                    .x(graphWidth / 2)
                    .y(graphHeight / 2);
                constrainNodesToBounds(simulation.nodes());
                simulation.alpha(0.1).restart();
            }).observe(container);
        }
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function clampNodeToBounds(node) {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
        const radius = Number(node.radius) || 0;
        node.x = clamp(node.x, radius, Math.max(radius, graphWidth - radius));
        node.y = clamp(node.y, radius, Math.max(radius, graphHeight - radius));

        if (Number.isFinite(node.fx)) {
            node.fx = clamp(node.fx, radius, Math.max(radius, graphWidth - radius));
        }
        if (Number.isFinite(node.fy)) {
            node.fy = clamp(node.fy, radius, Math.max(radius, graphHeight - radius));
        }
    }

    function constrainNodesToBounds(nodes) {
        nodes.forEach(clampNodeToBounds);
    }

    function render(data) {
        if (!simulation) initGraph();

        let maxLogValue = 0.001;
        data.nodes.forEach(node => {
            if (node.hasData === false) return;
            const logValue = Math.log10(Math.max(0, Number(node.value) || 0) + 1);
            if (logValue > maxLogValue) maxLogValue = logValue;
        });
        const exponentialScale = Math.exp(3) - 1;
        const nodesById = new Map();

        const nodes = data.nodes.map(n => {
            const radius = n.hasData === false
                ? 5
                : 5 + 51 * (
                    Math.exp(3 * Math.log10(Math.max(0, Number(n.value) || 0) + 1) / maxLogValue) - 1
                ) / exponentialScale;
            const availableWidth = Math.max(0, radius * 2 - 8);
            const label = n.label || n.name;
            const widthBasedFontSize = availableWidth / (String(label || '').length * 0.65);
            const labelFontSize = Math.min(radius * 0.5, widthBasedFontSize);

            const node = simulationNodes.get(n.id) || {};
            Object.assign(node, n, {
                radius,
                labelFontSize
            });
            nodesById.set(node.id, node);
            return node;
        });
        simulationNodes = new Map(nodes.map(node => [node.id, node]));

        const links = data.relations.map(relation => ({
            ...relation,
            source: relation.sourceKey,
            target: relation.targetKey,
            weight: Number(relation.weight) || 0
        }));

        const linksByPair = new Map();
        links.forEach(link => {
            const pairKey = link.sourceKey <= link.targetKey
                ? JSON.stringify([link.sourceKey, link.targetKey])
                : JSON.stringify([link.targetKey, link.sourceKey]);
            if (!linksByPair.has(pairKey)) linksByPair.set(pairKey, []);
            linksByPair.get(pairKey).push(link);
        });
        linksByPair.forEach(group => {
            group.forEach((link, index) => {
                const sideOffset = (index - (group.length - 1) / 2) * 24;
                const direction = link.sourceKey <= link.targetKey ? 1 : -1;
                link.curveOffset = sideOffset * direction;
            });
        });

        simulation.nodes(nodes);
        simulation.force('link').links(links);
        simulation.force('collide').radius(node => node.radius + 8);

        const link = svg.selectAll('.link').data(
            links,
            d => JSON.stringify([d.sourceKey, d.targetKey])
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
            .attr('role', 'button')
            .attr('tabindex', 0)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended))
            .on('click', (event, d) => {
                event.stopPropagation();
                toggleSelection(d);
            })
            .on('keydown', (event, d) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleSelection(d);
            });

        nodeEnter.append('circle')
            .attr('r', d => d.radius);

        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', d => d.labelFontSize);
        nodeEnter.append('title');

        const nodeMerge = nodeEnter.merge(node);
        const linkMerge = linkEnter.merge(link);
        nodeMerge
            .classed('is-unavailable', d => d.hasData === false)
            .classed('is-down', d => d.hasData !== false && d.changePercent < 0)
            .classed('is-up', d => d.hasData !== false && d.changePercent >= 0)
            .classed('is-selected', d => selectedNodeId === d.id)
            .attr('aria-label', d => d.label || d.name)
            .attr('aria-pressed', d => String(selectedNodeId === d.id));
        nodeMerge.select('circle')
            .interrupt()
            .transition()
            .duration(NODE_TRANSITION_DURATION)
            .attr('r', d => d.radius);
        nodeMerge.select('text')
            .text(d => d.label || d.name)
            .interrupt()
            .transition()
            .duration(NODE_TRANSITION_DURATION)
            .attr('font-size', d => d.labelFontSize)
            .attr('visibility', d => d.labelFontSize >= 1 ? 'visible' : 'hidden');
        nodeMerge.select('title').text(d => {
            if (d.hasData === false) return `${d.name}: data unavailable`;
            const change = Number(d.changePercent) || 0;
            const label = d.label === d.name ? d.name : `${d.name} (${d.label})`;
            return `${label}\n${numberFormat.format(d.value)}\n${change >= 0 ? '+' : ''}${numberFormat.format(change)}`;
        });
        linkMerge
            .attr('stroke-width', d => Math.min(4, 0.75 + Math.abs(d.weight) * 12))
            .classed('is-positive', d => d.weight >= 0)
            .classed('is-negative', d => d.weight < 0)
            .attr('marker-end', d => `url(#relationship-arrow-${d.weight < 0 ? 'negative' : 'positive'})`);
        updateDraggedLinks();
        updateDraggedNodes();
        linkMerge.select('title').text(d => {
            const source = nodesById.get(d.sourceKey);
            const target = nodesById.get(d.targetKey);
            return `${source.label || source.name} -> ${target.label || target.name}\nWeight: ${numberFormat.format(d.weight)}`;
        });

        function getLinkPath(d) {
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
        }

        function updatePositions(animateLinks = false) {
            nodes.forEach(clampNodeToBounds);
            const linkPosition = animateLinks
                ? linkMerge.interrupt().transition().duration(NODE_TRANSITION_DURATION)
                : linkMerge;
            linkPosition.attr('d', getLinkPath);
            nodeMerge.attr('transform', d => `translate(${d.x},${d.y})`);
        }

        simulation.on('tick', updatePositions);
        if (!layoutInitialized && nodes.length) {
            simulation.tick(300);
            layoutInitialized = true;
            updatePositions();
        } else {
            updatePositions(layoutInitialized);
        }
    }

    function update(data) {
        latestData = data;
        if (!inViewport || document.hidden || container.closest('[hidden]')) return;
        render(data);
    }

    function updateDraggedLinks() {
        const activeNodeIds = new Set(draggedNodeIds);
        if (selectedNodeId !== null) activeNodeIds.add(selectedNodeId);
        svg.selectAll('.link')
            .classed('is-node-dragged-related', d =>
                activeNodeIds.has(d.sourceKey) || activeNodeIds.has(d.targetKey)
            );
    }

    function updateDraggedNodes() {
        const activeNodeIds = new Set(draggedNodeIds);
        if (selectedNodeId !== null) activeNodeIds.add(selectedNodeId);
        const relatedNodeIds = new Set(activeNodeIds);
        svg.selectAll('.link').each(d => {
            if (activeNodeIds.has(d.sourceKey)) relatedNodeIds.add(d.targetKey);
            if (activeNodeIds.has(d.targetKey)) relatedNodeIds.add(d.sourceKey);
        });
        svg.selectAll('.node-group')
            .classed('is-dragging', d => draggedNodeIds.has(d.id))
            .classed('is-selected', d => selectedNodeId === d.id)
            .attr('aria-pressed', d => String(selectedNodeId === d.id))
            .classed('is-unrelated-to-dragged-node', d =>
                activeNodeIds.size > 0 && !relatedNodeIds.has(d.id)
            );
    }

    function toggleSelection(node) {
        selectedNodeId = selectedNodeId === node.id ? null : node.id;
        updateDraggedLinks();
        updateDraggedNodes();
    }

    document.addEventListener('click', event => {
        if (selectedNodeId === null || event.target.closest?.('#influence-graph-container .node-group')) return;
        selectedNodeId = null;
        updateDraggedLinks();
        updateDraggedNodes();
    });

    window.viewportVisibility.observe(container, isVisible => {
        inViewport = isVisible;
        if (inViewport && !document.hidden && !container.closest('[hidden]') && latestData) {
            render(latestData);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && inViewport && !container.closest('[hidden]') && latestData) {
            render(latestData);
        }
    });

    function dragstarted(event) {
        draggedNodeIds.add(event.subject.id);
        updateDraggedNodes();
        updateDraggedLinks();
        clampNodeToBounds(event.subject);
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        if (!dragSimulationActive) {
            simulation.alphaTarget(0.3).restart();
            dragSimulationActive = true;
        }
        const radius = Number(event.subject.radius) || 0;
        event.subject.fx = clamp(event.x, radius, Math.max(radius, graphWidth - radius));
        event.subject.fy = clamp(event.y, radius, Math.max(radius, graphHeight - radius));
    }

    function dragended(event) {
        draggedNodeIds.delete(event.subject.id);
        if (dragSimulationActive && draggedNodeIds.size === 0) {
            simulation.alphaTarget(0);
            dragSimulationActive = false;
        }
        updateDraggedNodes();
        updateDraggedLinks();
        event.subject.fx = null;
        event.subject.fy = null;
    }

    window.valueChanges.subscribeInfluence(update);
})();
