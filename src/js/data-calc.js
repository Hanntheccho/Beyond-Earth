(function () {
    const sources = [];
    let marketMood = 0;
    let relations = [];
    let timer = null;

    function itemKey(item) {
        return item.tag || item.name;
    }

    function walk(node, callback) {
        callback(node);
        node.children.forEach(child => walk(child, callback));
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

    function setRelations(newRelations) {
        relations = newRelations;
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
                node.value = Math.max(node.baseValue * 0.25, node.value * (1 + marketMood * 0.2 + drift + shock));
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
                            impact += sourceChange * rel.impactFactor * leaf.value;
                        }
                    });
                    leaf.value = Math.max(leaf.baseValue * 0.25, leaf.value + impact);
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

        // Pass 3: roll parent values upward and record changes for every node.
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
