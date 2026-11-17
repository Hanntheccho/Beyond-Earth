(function () {
    const sources = [];
    let marketMood = 0;
    let relations = [];
    let timer = null;
    const MIN_VALUE_RATIO = 0.05;
    const MAX_VALUE_RATIO = 10;
    const MAX_MOMENTUM = 5;
    const MAX_MOMENTUM_BOOST = 0.005;

    function itemKey(item) {
        return item.tag || item.name;
    }

    function walk(node, callback) {
        callback(node);
        node.children.forEach(child => walk(child, callback));
    }

    function clampValue(node, value) {
        return Math.max(
            node.baseValue * MIN_VALUE_RATIO,
            Math.min(node.baseValue * MAX_VALUE_RATIO, value)
        );
    }

    function prepareValues(node) {
        node.children.forEach(prepareValues);
        if (node.children.length) {
            node.value = node.children.reduce((sum, child) => sum + child.value, 0);
        }
        node.change = 0;
        node.changePercent = 0;
        node.baseValue = node.value;
        node.volatility = node.children.length
            ? 0
            : Math.max(0.0035, Math.min(0.016, 0.014 / Math.sqrt(Math.max(node.value, 1) / 100)));
        node.momentum = 0;  // Initialize momentum tracking
    }

    function createMarket(key) {
        const market = {
            key,
            root: null,
            listeners: new Set(),
            getSnapshot() {
                return market.root ? market.root.children.map(item => ({ ...item, unit: item.unit || market.root.unit })) : [];
            },
            getQuote(tag) {
                const item = market.root && market.root.children.find(child => itemKey(child) === tag);
                return item ? { ...item } : null;
            },
            subscribe(listener, options = {}) {
                if (typeof listener !== 'function') throw new TypeError('Market subscriber must be a function');
                market.listeners.add(listener);
                if (options.immediate !== false) listener(market.getSnapshot());
                return () => market.listeners.delete(listener);
            },
            publish() {
                if (!market.root) return;
                const current = market.getSnapshot();
                market.listeners.forEach(listener => listener(current));
            },
            tick: computeValues,
            start(options) { startTicker(options); return market; },
            stop() { stopTicker(); return market; }
        };
        return market;
    }

    const markets = new Map();

    function getMarket(key) {
        if (typeof key !== 'string' || !key.trim()) {
            throw new TypeError('Market ID must be a non-empty string');
        }
        const id = key.trim();
        if (!markets.has(id)) markets.set(id, createMarket(id));
        return markets.get(id);
    }

    function registerSource(key, root, update) {
        prepareValues(root);
        sources.push({ root, update });

        if (key) {
            const market = getMarket(key);
            market.root = root;
            market.publish();
        }
    }

    function setRelations(data) {
        relations = data.relations || [];
    }

    function createNodeIndex() {
        const byTag = new Map();
        const byName = new Map();
        sources.forEach(source => walk(source.root, node => {
            if (node.tag && !byTag.has(node.tag)) byTag.set(node.tag, node);
            if (node.name && !byName.has(node.name)) byName.set(node.name, node);
        }));
        return { byTag, byName };
    }

    function findNodeByKey(targetKey, nodeIndex) {
        return nodeIndex.byTag.get(targetKey) || nodeIndex.byName.get(targetKey) || null;
    }

    function resolveRelations(nodeIndex) {
        return relations.map(relation => {
            const source = findNodeByKey(relation.sourceKey, nodeIndex);
            const target = findNodeByKey(relation.targetKey, nodeIndex);
            return {
                ...relation,
                sourceKey: source ? itemKey(source) : relation.sourceKey,
                targetKey: target ? itemKey(target) : relation.targetKey
            };
        });
    }

    function getInfluenceData() {
        const nodeIndex = createNodeIndex();
        const graphRelations = resolveRelations(nodeIndex);
        const nodes = new Map();
        graphRelations.forEach(relation => {
            [relation.sourceKey, relation.targetKey].forEach(key => {
                if (typeof key !== 'string' || !key) return;
                nodes.set(key, {
                    id: key,
                    name: key,
                    label: key,
                    value: 0,
                    changePercent: 0,
                    hasData: false
                });
            });
        });

        sources.forEach(source => walk(source.root, node => {
            const key = node.tag || node.name;
            if (!nodes.has(key)) return;
            nodes.set(key, {
                id: key,
                name: node.name,
                label: node.tag || node.name,
                value: node.value,
                changePercent: node.changePercent,
                hasData: true
            });
        }));

        return {
            nodes: Array.from(nodes.values()),
            relations: graphRelations
        };
    }

    function renderInfluenceDebug() {
        const container = document.querySelector('.debug-influence');
        if (!container) return;

        if (window.influenceGraph && window.influenceGraph.update) {
            window.influenceGraph.update(getInfluenceData());
        }

        container.replaceChildren();

        if (!relations.length) {
            const empty = document.createElement('p');
            empty.className = 'debug-influence-empty';
            empty.textContent = 'No relations configured.';
            container.append(empty);
            return;
        }

        const nodeIndex = createNodeIndex();
        const tableWrap = document.createElement('div');
        tableWrap.className = 'debug-influence-table-wrap';
        const table = document.createElement('table');
        table.className = 'debug-influence-table';
        const header = document.createElement('tr');

        ['sourceKey', 'targetKey', 'weight'].forEach(label => {
            const cell = document.createElement('th');
            cell.scope = 'col';
            cell.textContent = label;
            header.append(cell);
        });

        const thead = document.createElement('thead');
        thead.append(header);
        table.append(thead);

        const tbody = document.createElement('tbody');
        const sortedItems = relations.slice().sort((left, right) =>
            left.sourceKey.localeCompare(right.sourceKey) ||
            left.targetKey.localeCompare(right.targetKey)
        );

        sortedItems.forEach(item => {
            const row = document.createElement('tr');

            [item.sourceKey, item.targetKey].forEach(key => {
                const cell = document.createElement('td');
                const entity = document.createElement('div');
                entity.className = 'debug-influence-entity';
                const name = document.createElement('span');
                name.className = 'debug-influence-name';
                const node = findNodeByKey(key, nodeIndex);
                name.textContent = node ? node.name : 'Waiting for data';
                entity.append(name);

                const value = document.createElement('span');
                if (node) {
                    value.className = `data-grid-change debug-influence-value ${node.changePercent >= 0 ? 'is-up' : 'is-down'}`;
                    value.textContent = `${node.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} · ${node.changePercent >= 0 ? '+' : ''}${node.changePercent.toFixed(2)}`;
                } else {
                    value.className = 'debug-influence-value';
                    value.textContent = 'Waiting for data';
                }
                entity.append(value);
                cell.append(entity);
                row.append(cell);
            });

            const weight = document.createElement('td');
            weight.className = 'debug-influence-weight';
            weight.textContent = Number(item.weight).toLocaleString(undefined, { maximumFractionDigits: 2 });
            row.append(weight);
            tbody.append(row);
        });

        table.append(tbody);
        tableWrap.append(table);
        container.append(tableWrap);
    }

    function computeValues() {
        const previous = new Map();
        const previousKeyMap = new Map();
        const resolvedRelations = resolveRelations(createNodeIndex());

        sources.forEach(source => walk(source.root, node => {
            previous.set(node, node.value);
            previousKeyMap.set(node.tag || node.name, node.value);
        }));

        marketMood = Math.max(-0.02, Math.min(0.02, marketMood * 0.86 + (Math.random() - 0.5) * 0.006));

        // Pass 1: apply normal stochastic movement to every leaf.
        function updateLeaf(node) {
            if (node.children.length) {
                node.children.forEach(updateLeaf);
                node.value = node.children.reduce((sum, child) => sum + child.value, 0);
            } else {
                const drift = (Math.random() - 0.5) * 0.0012;
                const shock = (Math.random() * 2 - 1) * node.volatility;
                node.value = clampValue(node, node.value * (1 + marketMood * 0.2 + drift + shock));
            }
        }
        sources.forEach(source => updateLeaf(source.root));

        // Snapshot the freshly updated values so relations can compare against the last tick.
        const currentKeyMap = new Map();
        sources.forEach(source => walk(source.root, node => {
            currentKeyMap.set(node.tag || node.name, node.value);
        }));

        // Pass 2: sum all incoming relation effects per target before applying them.
        if (resolvedRelations.length) {
            const relationsByTarget = new Map();
            resolvedRelations.forEach(relation => {
                if (!relationsByTarget.has(relation.targetKey)) relationsByTarget.set(relation.targetKey, []);
                relationsByTarget.get(relation.targetKey).push(relation);
            });

            sources.forEach(source => walk(source.root, node => {
                const nodeKey = node.tag || node.name;
                const relevantRelations = relationsByTarget.get(nodeKey);
                if (!relevantRelations) return;

                const applyToLeaf = (leaf) => {
                    let impact = 0;
                    relevantRelations.forEach(rel => {
                        const prevSourceVal = previousKeyMap.get(rel.sourceKey);
                        const currentSourceVal = currentKeyMap.get(rel.sourceKey);
                        if (prevSourceVal && currentSourceVal) {
                            const sourceChange = (currentSourceVal - prevSourceVal) / prevSourceVal;
                            impact += sourceChange * rel.weight * leaf.value;
                        }
                    });
                    leaf.value = clampValue(leaf, leaf.value + impact);
                };

                const applyToNode = (n) => {
                    if (n.children.length) n.children.forEach(applyToNode);
                    else applyToLeaf(n);
                };

                if (node.children.length) {
                    // Parent-level relation: cascade down to every leaf descendant.
                    applyToNode(node);
                } else {
                    applyToLeaf(node);
                }
            }));
        }

        // Pass 3: speculative momentum (leaves only; parents are re-aggregated in finalize)
        sources.forEach(source => walk(source.root, node => {
            if (node.children.length) return;
            const oldValue = previous.get(node) || 0;
            const rawChange = node.value - oldValue;
            const rawChangePercent = oldValue ? rawChange / oldValue * 100 : 0;
            const prevMomentum = node.momentum || 0;
            node.momentum = Math.max(
                -MAX_MOMENTUM,
                Math.min(MAX_MOMENTUM, 0.9 * prevMomentum + 0.1 * rawChangePercent)
            );
            const momentumBoost = Math.max(
                -MAX_MOMENTUM_BOOST,
                Math.min(MAX_MOMENTUM_BOOST, node.momentum / 1000)
            );
            node.value = clampValue(node, node.value * (1 + momentumBoost));
        }));

        // Pass 4: roll parent values upward and record changes for every node.
        function finalize(node) {
            if (node.children.length) {
                node.children.forEach(finalize);
                node.value = node.children.reduce((sum, child) => sum + child.value, 0);
            }
            const oldValue = previous.get(node) || 0;
            node.change = node.value - oldValue;
            node.changePercent = oldValue ? node.change / oldValue * 100 : 0;
        }
        sources.forEach(source => finalize(source.root));
    }

    function publishMarkets() {
        sources.forEach(source => source.update());
        markets.forEach(market => market.publish());
        renderInfluenceDebug();
    }

    function startTicker(options = {}) {
        if (timer) clearInterval(timer);
        computeValues();
        publishMarkets();
        timer = setInterval(() => {
            computeValues();
            publishMarkets();
        }, Math.max(250, Number(options.intervalMs) || 10000));
    }

    function stopTicker() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    window.valueChanges = {
        getMarket,
        registerSource,
        setRelations,
        getInfluenceData,
        renderInfluenceDebug,
        tick: computeValues,
        render: publishMarkets,
        start: startTicker,
        stop: stopTicker
    };

    const panelObserver = new MutationObserver(records => {
        if (records.some(record => record.target.matches('[data-panel-group]:not([data-panel-target])'))) {
            publishMarkets();
        }
    });
    panelObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['hidden'],
        subtree: true
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) publishMarkets();
    });
})();
