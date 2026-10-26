(function () {
    const sources = [];
    let marketMood = 0;
    let timer = null;

    function itemKey(item) {
        return item.tag || item.name;
    }

    function walk(node, callback) {
        callback(node);
        node.children.forEach(child => walk(child, callback));
    }

    function prepareValues(node) {
        node.change = 0;
        node.changePercent = 0;
        node.baseValue = node.value;
        node.volatility = node.children.length
            ? 0
            : Math.max(0.0035, Math.min(0.016, 0.014 / Math.sqrt(Math.max(node.value, 1) / 100)));
        node.children.forEach(prepareValues);
    }

    function createMarket(key) {
        const market = {
            key,
            root: null,
            listeners: new Set(),
            getSnapshot() {
                return market.root ? market.root.children.map(item => ({ ...item })) : [];
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
            tick: advanceValues,
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

    function advanceValues() {
        const previous = new Map();
        sources.forEach(source => walk(source.root, node => previous.set(node, node.value)));
        marketMood = Math.max(-0.02, Math.min(0.02, marketMood * 0.86 + (Math.random() - 0.5) * 0.006));

        function update(node) {
            if (node.children.length) {
                node.children.forEach(update);
                node.value = node.children.reduce((sum, child) => sum + child.value, 0);
            } else {
                const drift = (Math.random() - 0.5) * 0.0012;
                const shock = (Math.random() * 2 - 1) * node.volatility;
                node.value = Math.max(node.baseValue * 0.25, node.value * (1 + marketMood * 0.2 + drift + shock));
            }
            const oldValue = previous.get(node) || 0;
            node.change = node.value - oldValue;
            node.changePercent = oldValue ? node.change / oldValue * 100 : 0;
        }

        sources.forEach(source => {
            update(source.root);
            source.update();
        });
        markets.forEach(market => market.publish());
    }

    function startTicker(options = {}) {
        if (timer) clearInterval(timer);
        timer = setInterval(advanceValues, Math.max(250, Number(options.intervalMs) || 2000));
    }

    function stopTicker() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    window.valueChanges = {
        getMarket,
        registerSource,
        tick: advanceValues,
        start: startTicker,
        stop: stopTicker
    };
})();
