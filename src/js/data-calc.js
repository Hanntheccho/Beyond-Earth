(function () {
    const sources = [];
    let marketMood = 0;
    let relations = [];
    let influences = [];
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
        relations = data.dependencies || [];
        influences = data.influences || [];
    }

    function getInfluenceMap() {
        return influences;
    }

    // Debug renderer: dumps active dependencies + influences as live plain text into .debug-influence
    function renderInfluenceDebug() {
        const container = document.querySelector('.debug-influence');
        if (!container) return;
        const lines = [];
        lines.push('=== DEPENDENCIES (source -> target) ===');
        relations.forEach(rel => {
            const source = findNodeByTag(rel.sourceKey);
            const target = findNodeByTag(rel.targetKey);
            const srcInfo = source ? `${source.name} ${source.value.toFixed(0)} (${source.changePercent >= 0 ? '+' : ''}${source.changePercent.toFixed(2)}%)` : rel.sourceKey;
            const tgtInfo = target ? `${target.name} ${target.value.toFixed(0)} (${target.changePercent >= 0 ? '+' : ''}${target.changePercent.toFixed(2)}%)` : rel.targetKey;
            lines.push(`${srcInfo} -> ${tgtInfo} [${rel.weight}]`);
        });
        lines.push('');
        lines.push('=== INFLUENCES (company <-> country) ===');
        influences.forEach(link => {
            const source = findNodeByTag(link.sourceKey);
            const target = findNodeByTag(link.targetKey);
            const srcInfo = source ? `${source.name} ${source.value.toFixed(0)} (${source.changePercent >= 0 ? '+' : ''}${source.changePercent.toFixed(2)}%)` : link.sourceKey;
            const tgtInfo = target ? `${target.name} ${target.value.toFixed(0)} (${target.changePercent >= 0 ? '+' : ''}${target.changePercent.toFixed(2)}%)` : link.targetKey;
            lines.push(`${srcInfo} -> ${tgtInfo} [${link.weight}]`);
        });
        container.textContent = lines.join('\n');
    }

    function findNodeByTag(targetKey) {
        let found = null;
        sources.forEach(source => walk(source.root, node => { if ((node.tag || node.name) === targetKey) found = node; }));
        return found;
    }

    function computeValues() {
        const previous = new Map();
        const previousKeyMap = new Map();

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

        // Pass 2: propagate resource movement to linked targets.
        if (relations.length) {
            sources.forEach(source => walk(source.root, node => {
                const nodeKey = node.tag || node.name;
                const relevantRelations = relations.filter(rel => rel.targetKey === nodeKey);
                if (!relevantRelations.length) return;

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

        // Pass 3: propagate company/country influences (cascade parents to leaves)
        if (influences.length) {
            influences.forEach(link => {
                const sourceVal = currentKeyMap.get(link.sourceKey);
                const prevSourceVal = previousKeyMap.get(link.sourceKey);
                if (!sourceVal || !prevSourceVal) return;

                let targetNode = null;
                sources.forEach(s => {
                    walk(s.root, n => { if ((n.tag || n.name) === link.targetKey) targetNode = n; });
                });
                if (!targetNode) return;

                const sourceChange = (sourceVal - prevSourceVal) / prevSourceVal;
                const applyImpact = (leaf) => {
                    const impact = sourceChange * link.weight * leaf.value;
                    leaf.value = clampValue(leaf, leaf.value + impact);
                };
                const applyToNode = (n) => {
                    if (n.children.length) n.children.forEach(applyToNode);
                    else applyImpact(n);
                };
                applyToNode(targetNode);
            });
        }

        // Pass 4: speculative momentum (leaves only; parents are re-aggregated in finalize)
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

        // Pass 5: roll parent values upward and record changes for every node.
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
        getInfluenceMap,
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
