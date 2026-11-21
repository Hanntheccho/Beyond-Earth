// data-calc.js - the "MondayMarket" simulation engine.
//
// OVERVIEW
// The market data modules load and register the treemap datasets (GDP, market,
// resources). This file then
// simulates a live market on top of those trees: every tick (10 s by default)
// each leaf value moves randomly, linked entities push each other around, and
// parent values are re-summed. Afterwards every subscriber (treemaps, data
// grids, the ticker) is notified so it can animate to the new numbers.
//
// DATA SHAPE (after data-loader.js normalizes it)
//   node = { name, tag?, value, children: [...] }
// Leaves carry a value; parents are always the sum of their children.
// prepareValues() adds these simulation fields to every node:
//   change, changePercent : movement during the last tick
//   baseValue             : the starting value, used to clamp runaway moves
//   volatility            : max random shock per tick (leaves only)
//   momentum              : smoothed recent % change (leaves only)
//
// PUBLIC API: import { valueChanges } from './data-calc.js'
//   getMarket(id)  -> market object with getSnapshot/getQuote/subscribe/...
//   registerSource(id, root)          register a tree to simulate
//   setRelations(data)                load data/relations.json
//   start / stop / tick / render      control the ticker manually
export const valueChanges = (function () {
    // All registered trees used by the market simulation and derived views.
    const sources = [];
    const influenceListeners = new Set();
    // Global sentiment that drifts slowly and nudges every leaf in the same direction.
    let marketMood = 0;
    // Relations from relations.json: a source's movement pushes a target
    // (e.g. oil price -> an energy company).
    let relations = [];
    let timer = null;
    // Relations resolved against the registered trees, plus the same list grouped
    // by target. Trees never change shape after registration (only their values
    // move), so this is rebuilt only when a tree or the relations change.
    let resolved = null;

    // Safety rails so a value can never collapse to zero or explode.
    // Values stay within 5% to 1000% of their starting value.
    const MIN_VALUE_RATIO = 0.05;
    const MAX_VALUE_RATIO = 100;
    // Momentum is a smoothed % change, capped at +/-5 (percent).
    const MAX_MOMENTUM = 5;
    // The momentum boost applied to a value per tick is capped at +/-0.5%.
    const MAX_MOMENTUM_BOOST = 0.005;

    // Items are identified by tag when they have one, otherwise by name.
    // This is the key used by relations, treemaps, grids and the ticker.
    function itemKey(item) {
        return item.tag || item.name;
    }

    // Depth-first visit of a node and all its descendants.
    function walk(node, callback) {
        callback(node);
        node.children.forEach(child => walk(child, callback));
    }

    // Keep a value inside [5%, 1000%] of the node's starting value.
    function clampValue(node, value) {
        return Math.max(
            node.baseValue * MIN_VALUE_RATIO,
            Math.min(node.baseValue * MAX_VALUE_RATIO, value)
        );
    }

    // One-time setup of a freshly loaded tree. Children are prepared first so a
    // parent's starting value can be the sum of its children.
    function prepareValues(node) {
        node.children.forEach(prepareValues);
        if (node.children.length) {
            node.value = node.children.reduce((sum, child) => sum + child.value, 0);
        }
        node.change = 0;
        node.changePercent = 0;
        node.baseValue = node.value;
        // Volatility only applies to leaves. Bigger items move less:
        // roughly 0.014 / sqrt(value / 100), limited to the range 0.35% to 1.6%.
        node.volatility = node.children.length
            ? 0
            : Math.max(0.0035, Math.min(0.016, 0.014 / Math.sqrt(Math.max(node.value, 1) / 100)));
        node.momentum = 0;  // Initialize momentum tracking
    }

    // A "market" is a named view onto one registered tree (for example
    // "gdp", "market" or "resources"). Other scripts subscribe to it to get
    // a snapshot of the top-level items after every tick.
    function createMarket(key) {
        const market = {
            key,
            root: null,
            listeners: new Set(),
            // Shallow copies of the root's direct children, with the root's unit
            // supplied when an item does not have one of its own.
            getSnapshot() {
                return market.root ? market.root.children.map(item => ({ ...item, unit: item.unit || market.root.unit })) : [];
            },
            // Copy of one top-level item by tag/name, or null.
            getQuote(tag) {
                const item = market.root && market.root.children.find(child => itemKey(child) === tag);
                return item ? { ...item } : null;
            },
            // Register a listener. By default it is called once immediately with
            // the current snapshot. Returns an unsubscribe function.
            subscribe(listener, options = {}) {
                if (typeof listener !== 'function') throw new TypeError('Market subscriber must be a function');
                market.listeners.add(listener);
                if (options.immediate !== false) listener(market.getSnapshot());
                return () => market.listeners.delete(listener);
            },
            // Send the current snapshot to every listener.
            publish() {
                if (!market.root) return;
                const current = market.getSnapshot();
                market.listeners.forEach(listener => listener(current));
            },
            // Shortcuts to the shared engine (all markets tick together).
            tick: computeValues,
            start(options) { startTicker(options); return market; },
            stop() { stopTicker(); return market; }
        };
        return market;
    }

    // All markets by id, created lazily on first request.
    const markets = new Map();

    function getMarket(key) {
        if (typeof key !== 'string' || !key.trim()) {
            throw new TypeError('Market ID must be a non-empty string');
        }
        const id = key.trim();
        if (!markets.has(id)) markets.set(id, createMarket(id));
        return markets.get(id);
    }

    // Called by the market data loader once per normalized source tree.
    function registerSource(key, root) {
        prepareValues(root);
        sources.push({ root });
        resolved = null;

        if (key) {
            const market = getMarket(key);
            market.root = root;
            market.publish();
        }
    }

    // Store the relations loaded from data/relations.json.
    function setRelations(data) {
        relations = data.relations || [];
        resolved = null;
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

    function getResolvedRelations() {
        if (resolved) return resolved;
        const nodeIndex = createNodeIndex();
        const list = relations.map(relation => {
            const source = findNodeByKey(relation.sourceKey, nodeIndex);
            const target = findNodeByKey(relation.targetKey, nodeIndex);
            return {
                ...relation,
                sourceKey: source ? itemKey(source) : relation.sourceKey,
                targetKey: target ? itemKey(target) : relation.targetKey
            };
        });
        const byTarget = new Map();
        list.forEach(relation => {
            if (!byTarget.has(relation.targetKey)) byTarget.set(relation.targetKey, []);
            byTarget.get(relation.targetKey).push(relation);
        });
        resolved = { list, byTarget };
        return resolved;
    }

    function getInfluenceData() {
        // Copies, so a subscriber can never alter the cached relations.
        const graphRelations = getResolvedRelations().list.map(relation => ({ ...relation }));
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
            const key = itemKey(node);
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

    // Publish current influence data to interested view subscribers.
    function publishInfluenceData() {
        if (!influenceListeners.size) return;
        const data = getInfluenceData();
        influenceListeners.forEach(listener => listener(data));
    }

    function subscribeInfluence(listener, options = {}) {
        if (typeof listener !== 'function') throw new TypeError('Influence subscriber must be a function');
        influenceListeners.add(listener);
        if (options.immediate !== false) listener(getInfluenceData());
        return () => influenceListeners.delete(listener);
    }

    // One simulation step. Runs in four passes over all registered trees:
    //   1. random movement of every leaf
    //   2. incoming relations push their targets
    //   3. momentum: recent movement slightly extends itself
    //   4. roll parent values up from their children and record change/changePercent
    // Incoming relations are measured by how much the SOURCE changed during pass 1,
    // so they react to the random move, not to other relations.
    function computeValues() {
        // Snapshot of every value before this tick, by node and by key.
        // Used to measure change and to compute each relation's source movement.
        const previous = new Map();
        const previousKeyMap = new Map();
        const relationsByTarget = getResolvedRelations().byTarget;

        sources.forEach(source => walk(source.root, node => {
            previous.set(node, node.value);
            previousKeyMap.set(itemKey(node), node.value);
        }));

        // Market mood: decays 14% per tick toward 0 and gets a small random kick,
        // limited to +/-2%. It is applied (at 20% strength) to every leaf below.
        marketMood = Math.max(-0.02, Math.min(0.02, marketMood * 0.86 + (Math.random() - 0.5) * 0.006));

        // Pass 1: apply normal stochastic movement to every leaf.
        // Each leaf changes by mood + a tiny random drift + a random shock whose
        // size is limited by the leaf's volatility. Parents are re-summed as the
        // recursion unwinds.
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

        // Pass 2: sum all incoming relation effects per target before applying them.
        if (relationsByTarget.size) {
            // Snapshot the freshly updated values so relations can compare against the last tick.
            const currentKeyMap = new Map();
            sources.forEach(source => walk(source.root, node => {
                currentKeyMap.set(itemKey(node), node.value);
            }));

            sources.forEach(source => walk(source.root, node => {
                const relevantRelations = relationsByTarget.get(itemKey(node));
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
        // Momentum is an exponential moving average of the leaf's % change so far
        // this tick (90% old momentum, 10% new change). The leaf then gets a small
        // extra push in the same direction, so trends tend to continue briefly.
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
        // change / changePercent compare the final value with the value at the
        // START of the tick, so they include all four passes above. These are the
        // numbers the UI shows (and uses to colour things green/red).
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

    // Publish the latest numbers to market subscribers, then refresh the graph.
    function publishMarkets() {
        markets.forEach(market => market.publish());
        publishInfluenceData();
    }

    // Start the simulation. Ticks once immediately (so the page has movement
    // data right away), then every intervalMs (default 10000, minimum 250).
    // Restarting replaces any running timer. Keep UI tween durations well below
    // this interval so animations finish before the next tick.
    function startTicker(options = {}) {
        if (timer) clearInterval(timer);
        computeValues();
        publishMarkets();
        timer = setInterval(() => {
            computeValues();
            publishMarkets();
        }, Math.max(250, Number(options.intervalMs) || 2000));
    }

    function stopTicker() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    // Panels that are hidden skip their redraws to save work. When one of the
    // plain panels (those with data-panel-group but no data-panel-target, i.e.
    // not the buttons) is shown or hidden, republish so a newly visible panel
    // immediately gets current data instead of waiting for the next tick.
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
    // Catch up when the browser tab becomes visible again.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) publishMarkets();
    });

    // Public API used by the market data loader and view components.
    return {
        getMarket,
        registerSource,
        setRelations,
        getInfluenceData,
        subscribeInfluence,
        tick: computeValues,
        render: publishMarkets,
        start: startTicker,
        stop: stopTicker
    };
})();
