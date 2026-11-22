// simulation.js - the live data simulation engine.
//
// OVERVIEW
// feed-loader.js loads and registers the treemap datasets (blocs, corps, goods).
// This file then simulates live movement on top of those trees: on every tick
// (interval set in startClock) each leaf value moves randomly and is pulled gently
// back toward its resting value (its starting value, shifted by how far its linked
// items are from theirs), linked entities push each other around, and
// parent values are re-summed. Afterwards every subscriber (treemaps, data grids,
// the ticker) is notified so it can animate to the new numbers.
//
// DATA SHAPE (after data-loader.js normalizes it)
//   node = { name, tag?, value, volatility?, children: [...] }
// Leaves carry a value and may carry their own volatility; parents are always the
// sum of their children.
// prepareValues() adds these simulation fields to every node:
//   change, changePercent : movement during the last tick
//   baseValue             : the starting value; leaves are pulled back toward it
//                           (shifted by their relations, see restingShifts()),
//                           and runaway moves are clamped around it
//   volatility            : max random shock per tick, as a fraction of the value
//                           (leaves only): the leaf's own volatility from its data
//                           file, otherwise the size rule in leafVolatility()
//   momentum              : smoothed recent % change (leaves only)
//   history               : the last HISTORY_LENGTH values, oldest first (read-only
//                           for subscribers; snapshots share the array)
//   trendPercent          : % change over the last TREND_TICKS ticks; the views
//                           color by this, since a single tick is mostly noise
//
// PUBLIC API: import { simulation } from './simulation.js'
//   getFeed(id)    -> feed object with getSnapshot/subscribe/publish
//   registerTree(id, root)            register a tree to simulate
//   setRelations(data)                load data/relations.json
//   subscribeRelations(listener)      relations graph data after every tick
//   start / stop / tick / render      control the clock manually
export const simulation = (function () {
    // All registered trees used by the simulation and derived views.
    const trees = [];
    const relationsListeners = new Set();
    // Global sentiment that drifts slowly and nudges every leaf in the same direction.
    let sentiment = 0;
    // Relations from relations.json: the "from" item's movement pushes the "to" item
    // (e.g. oil price -> an energy company).
    let relations = [];
    let timer = null;
    // Relations resolved against the registered trees, plus the nodes they link
    // grouped by target node. Trees never change shape after registration (only
    // their values move), so this is rebuilt only when a tree or the relations change.
    let resolved = null;
    // How far each relation target was pushed by its relations during the last tick
    // (a fraction of its value). Relations that start from it pass that push on
    // during the next tick, so effects travel one link per tick.
    let lastPushes = new Map();

    // Safety rails so a value can never collapse to zero or explode: values stay
    // between MIN_VALUE_RATIO and MAX_VALUE_RATIO times their starting value. The
    // pull toward the resting value (REVERSION_RATE) normally keeps them far from both.
    const MIN_VALUE_RATIO = 0.05;
    const MAX_VALUE_RATIO = 100;
    // Share of a leaf's distance from its resting value that is pulled back every
    // tick. It keeps long runs close to the data files without changing how far a
    // single tick moves.
    const REVERSION_RATE = 0.003;
    // Values kept per node for the history charts, and the ticks the trend change
    // spans. Before the first tick the clock runs a silent warm-up long enough to
    // fill the history, so the charts open with a past instead of a flat line.
    const HISTORY_LENGTH = 300;
    const TREND_TICKS = 30;
    let warmedUp = false;
    // Momentum is a smoothed % change, capped at +/-MAX_MOMENTUM (in percent).
    const MAX_MOMENTUM = 5;
    // Cap on the momentum boost applied to a value per tick (a fraction, not a percent).
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

    // Keep a value within the MIN_VALUE_RATIO..MAX_VALUE_RATIO range of the node's starting value.
    function clampValue(node, value) {
        return Math.max(
            node.baseValue * MIN_VALUE_RATIO,
            Math.min(node.baseValue * MAX_VALUE_RATIO, value)
        );
    }

    // How far a node is from its starting value, in log terms: 0 at the start,
    // positive above it and negative below it, with doubling and halving the same size.
    function distanceFromStart(node) {
        return node.baseValue > 0 && node.value > 0 ? Math.log(node.value / node.baseValue) : 0;
    }

    // Where each relation target rests, as a log distance from its starting value:
    // the sum of weight x each FROM item's distance from its own start. While cobalt
    // stays high, an item that earns from it rests higher too, so the pull back keeps
    // the effect instead of undoing it. Measured on the values at the start of a tick.
    function restingShifts() {
        const shifts = new Map();
        getResolvedRelations().byTarget.forEach((incoming, target) => {
            shifts.set(target, incoming.reduce((sum, { from, weight }) => sum + weight * distanceFromStart(from), 0));
        });
        return shifts;
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
        // Volatility only applies to leaves.
        node.volatility = node.children.length ? 0 : leafVolatility(node);
        node.momentum = 0;  // Initialize momentum tracking
        node.history = [node.value];
        node.trendPercent = 0;
    }

    // Append the node's new value to its history and update its trend change.
    function recordHistory(node) {
        node.history.push(node.value);
        if (node.history.length > HISTORY_LENGTH) node.history.shift();
        const start = node.history[Math.max(0, node.history.length - 1 - TREND_TICKS)];
        node.trendPercent = start ? (node.value - start) / start * 100 : 0;
    }

    // A leaf's own "volatility" from its data file wins (tools/validate.mjs checks it).
    // Otherwise the size rule applies: bigger items move less (it scales with
    // 1 / sqrt(value)), kept between a fixed minimum and maximum. That suits blocs
    // and corps; goods set their own, because their values are prices in different units.
    function leafVolatility(node) {
        if (typeof node.volatility === 'number' && Number.isFinite(node.volatility) && node.volatility >= 0) {
            return node.volatility;
        }
        return Math.max(0.0035, Math.min(0.016, 0.014 / Math.sqrt(Math.max(node.value, 1) / 100)));
    }

    // A "feed" is a named view onto one registered tree (for example
    // "blocs", "corps" or "goods"). Other scripts subscribe to it to get
    // a snapshot of the top-level items after every tick.
    function createFeed(key) {
        const feed = {
            key,
            root: null,
            listeners: new Set(),
            // Shallow copies of the root's direct children, with the root's unit
            // supplied when an item does not have one of its own.
            getSnapshot() {
                return feed.root ? feed.root.children.map(item => ({ ...item, unit: item.unit || feed.root.unit })) : [];
            },
            // Register a listener. By default it is called once immediately with
            // the current snapshot. Returns an unsubscribe function.
            subscribe(listener, options = {}) {
                if (typeof listener !== 'function') throw new TypeError('Feed subscriber must be a function');
                feed.listeners.add(listener);
                if (options.immediate !== false) listener(feed.getSnapshot());
                return () => feed.listeners.delete(listener);
            },
            // Send the current snapshot to every listener.
            publish() {
                if (!feed.root) return;
                const current = feed.getSnapshot();
                feed.listeners.forEach(listener => listener(current));
            }
        };
        return feed;
    }

    // All feeds by id, created lazily on first request.
    const feeds = new Map();

    function getFeed(key) {
        if (typeof key !== 'string' || !key.trim()) {
            throw new TypeError('Feed ID must be a non-empty string');
        }
        const id = key.trim();
        if (!feeds.has(id)) feeds.set(id, createFeed(id));
        return feeds.get(id);
    }

    // Called by feed-loader.js once per normalized tree.
    function registerTree(key, root) {
        prepareValues(root);
        trees.push({ root });
        resolved = null;

        if (key) {
            const feed = getFeed(key);
            feed.root = root;
            feed.publish();
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
        trees.forEach(tree => walk(tree.root, node => {
            if (node.tag && !byTag.has(node.tag)) byTag.set(node.tag, node);
            if (node.name && !byName.has(node.name)) byName.set(node.name, node);
        }));
        return { byTag, byName };
    }

    function findNodeByKey(toKey, nodeIndex) {
        return nodeIndex.byTag.get(toKey) || nodeIndex.byName.get(toKey) || null;
    }

    function getResolvedRelations() {
        if (resolved) return resolved;
        const nodeIndex = createNodeIndex();
        // Target node -> its incoming relations as { from: node, weight }. A relation
        // whose key matches no node is left out here and only shows in the graph.
        const byTarget = new Map();
        const list = relations.map(relation => {
            const from = findNodeByKey(relation.fromKey, nodeIndex);
            const to = findNodeByKey(relation.toKey, nodeIndex);
            if (from && to) {
                if (!byTarget.has(to)) byTarget.set(to, []);
                byTarget.get(to).push({ from, weight: Number(relation.weight) || 0 });
            }
            return {
                ...relation,
                fromKey: from ? itemKey(from) : relation.fromKey,
                toKey: to ? itemKey(to) : relation.toKey
            };
        });
        resolved = { list, byTarget };
        return resolved;
    }

    function getRelationsData() {
        // Copies, so a subscriber can never alter the cached relations.
        const graphRelations = getResolvedRelations().list.map(relation => ({ ...relation }));
        const nodes = new Map();
        graphRelations.forEach(relation => {
            [relation.fromKey, relation.toKey].forEach(key => {
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

        trees.forEach(tree => walk(tree.root, node => {
            const key = itemKey(node);
            if (!nodes.has(key)) return;
            nodes.set(key, {
                id: key,
                name: node.name,
                label: node.tag || node.name,
                value: node.value,
                changePercent: node.changePercent,
                trendPercent: node.trendPercent,
                hasData: true
            });
        }));

        return {
            nodes: Array.from(nodes.values()),
            relations: graphRelations
        };
    }

    // Publish current relations data to the graph's subscribers.
    function publishRelationsData() {
        if (!relationsListeners.size) return;
        const data = getRelationsData();
        relationsListeners.forEach(listener => listener(data));
    }

    function subscribeRelations(listener, options = {}) {
        if (typeof listener !== 'function') throw new TypeError('Relations subscriber must be a function');
        relationsListeners.add(listener);
        if (options.immediate !== false) listener(getRelationsData());
        return () => relationsListeners.delete(listener);
    }

    // One simulation step. Runs in four passes over all registered trees:
    //   1. random movement of every leaf, and a pull back toward its resting value
    //   2. incoming relations push their targets
    //   3. momentum: recent movement slightly extends itself
    //   4. roll parent values up from their children and record change/changePercent
    // A relation carries how much its FROM item moved during pass 1, plus how far the
    // FROM item was itself pushed by relations during the previous tick. So a push
    // travels one link per tick (a good, then the bloc it moves, then that bloc's
    // rivals) and shrinks at every link, instead of feeding back within one tick.
    function computeValues() {
        // Snapshot of every value before this tick. Used to measure change and to
        // compute each relation's "from" movement.
        const previous = new Map();
        trees.forEach(tree => walk(tree.root, node => previous.set(node, node.value)));

        // Sentiment: decays toward 0 every tick and gets a small random kick, within
        // a fixed limit. A fraction of it is applied to every leaf below.
        sentiment = Math.max(-0.02, Math.min(0.02, sentiment * 0.86 + (Math.random() - 0.5) * 0.006));

        // Pass 1: apply normal stochastic movement to every leaf.
        // Each leaf changes by sentiment + a tiny random drift + a random shock whose
        // size is limited by the leaf's volatility, and is pulled back by
        // REVERSION_RATE of its distance from its resting value. A shift on a parent
        // applies to every leaf below it. Parents are re-summed as the recursion unwinds.
        const shifts = restingShifts();
        function updateLeaf(node, inheritedShift) {
            const shift = inheritedShift + (shifts.get(node) || 0);
            if (node.children.length) {
                node.children.forEach(child => updateLeaf(child, shift));
                node.value = node.children.reduce((sum, child) => sum + child.value, 0);
            } else {
                const drift = (Math.random() - 0.5) * 0.0012;
                const shock = (Math.random() * 2 - 1) * node.volatility;
                const pull = -REVERSION_RATE * (distanceFromStart(node) - shift);
                node.value = clampValue(node, node.value * (1 + sentiment * 0.2 + drift + shock + pull));
            }
        }
        trees.forEach(tree => updateLeaf(tree.root, 0));

        // Pass 2: work out every target's push from the values pass 1 left, then apply
        // them all, so no push is measured on top of another push from this tick.
        // A push on a parent cascades down to every leaf descendant.
        const pushes = new Map();
        getResolvedRelations().byTarget.forEach((incoming, target) => {
            pushes.set(target, incoming.reduce((sum, { from, weight }) => {
                const start = previous.get(from);
                if (!start) return sum;
                const fromChange = (from.value - start) / start + (lastPushes.get(from) || 0);
                return sum + fromChange * weight;
            }, 0));
        });
        const applyPush = (node, push) => {
            if (node.children.length) node.children.forEach(child => applyPush(child, push));
            else node.value = clampValue(node, node.value * (1 + push));
        };
        pushes.forEach((push, target) => applyPush(target, push));
        lastPushes = pushes;

        // Pass 3: speculative momentum (leaves only; parents are re-aggregated in finalize)
        // Momentum is an exponential moving average of the leaf's % change so far
        // this tick, weighted mostly toward the old momentum. The leaf then gets a small
        // extra push in the same direction, so trends tend to continue briefly.
        trees.forEach(tree => walk(tree.root, node => {
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
            recordHistory(node);
        }
        trees.forEach(tree => finalize(tree.root));
    }

    // Publish the latest numbers to feed subscribers, then refresh the graph.
    function publishFeeds() {
        feeds.forEach(feed => feed.publish());
        publishRelationsData();
    }

    // Start the simulation. The first start runs the silent warm-up that fills the
    // history, then it ticks once immediately (so the page has movement data right
    // away) and every intervalMs; the default and the minimum are in the
    // setInterval call below.
    // Restarting replaces any running timer. Keep UI tween durations well below
    // this interval so animations finish before the next tick.
    function startClock(options = {}) {
        if (timer) clearInterval(timer);
        if (!warmedUp) {
            warmedUp = true;
            for (let i = 0; i < HISTORY_LENGTH; i++) computeValues();
        }
        computeValues();
        publishFeeds();
        timer = setInterval(() => {
            computeValues();
            publishFeeds();
        }, Math.max(250, Number(options.intervalMs) || 2000));
    }

    function stopClock() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    // Panels that are hidden skip their redraws to save work. When one of the
    // plain panels (those with data-panel-group but no data-panel-target, i.e.
    // not the buttons) is shown or hidden, republish so a newly visible panel
    // immediately gets current data instead of waiting for the next tick.
    const panelObserver = new MutationObserver(records => {
        if (records.some(record => record.target.matches('[data-panel-group]:not([data-panel-target])'))) {
            publishFeeds();
        }
    });
    panelObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['hidden'],
        subtree: true
    });
    // Catch up when the browser tab becomes visible again.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) publishFeeds();
    });

    // Public API used by feed-loader.js and view components.
    return {
        getFeed,
        registerTree,
        setRelations,
        getRelationsData,
        subscribeRelations,
        tick: computeValues,
        render: publishFeeds,
        start: startClock,
        stop: stopClock
    };
})();

