// Fictional, local-only commodity market. Prices are simulated, not live quotes.
(function () {
    const definitions = [
        { id: 'src01', name: 'Crude Oil', unit: 'bbl', base: 82, supply: 0.56, demand: 0.72, volatility: 0.010 },
        { id: 'src02', name: 'Natural Gas', unit: 'MWh', base: 34, supply: 0.60, demand: 0.68, volatility: 0.016 },
        { id: 'src03', name: 'Uranium', unit: 'lb U₃O₈', base: 96, supply: 0.48, demand: 0.73, volatility: 0.012 },
        { id: 'src04', name: 'Iron', unit: 'tonne', base: 118, supply: 0.72, demand: 0.70, volatility: 0.008 },
        { id: 'src05', name: 'Copper', unit: 'tonne', base: 9400, supply: 0.56, demand: 0.75, volatility: 0.009 },
        { id: 'src06', name: 'Lithium', unit: 'tonne', base: 14200, supply: 0.50, demand: 0.78, volatility: 0.018 },
        { id: 'src07', name: 'Phosphate', unit: 'tonne', base: 162, supply: 0.66, demand: 0.65, volatility: 0.010 },
        { id: 'src08', name: 'Sulfur', unit: 'tonne', base: 118, supply: 0.65, demand: 0.62, volatility: 0.012 },
        { id: 'src09', name: 'Bauxite', unit: 'tonne', base: 68, supply: 0.70, demand: 0.68, volatility: 0.009 },
        { id: 'src10', name: 'Nickel', unit: 'tonne', base: 16800, supply: 0.55, demand: 0.69, volatility: 0.012 },
        { id: 'src11', name: 'Manganese', unit: 'tonne', base: 2100, supply: 0.61, demand: 0.67, volatility: 0.011 },
        { id: 'src12', name: 'Cobalt', unit: 'tonne', base: 28500, supply: 0.48, demand: 0.70, volatility: 0.014 },
        { id: 'src13', name: 'REE', unit: 'tonne', base: 52000, supply: 0.43, demand: 0.72, volatility: 0.016 },
        { id: 'src14', name: 'Graphite', unit: 'tonne', base: 780, supply: 0.58, demand: 0.70, volatility: 0.012 },
        { id: 'src15', name: 'Titanium', unit: 'tonne', base: 9200, supply: 0.61, demand: 0.67, volatility: 0.010 },
        { id: 'src16', name: 'Chromium', unit: 'tonne', base: 10400, supply: 0.61, demand: 0.66, volatility: 0.010 },
        { id: 'src17', name: 'Tungsten', unit: 'tonne', base: 33500, supply: 0.43, demand: 0.68, volatility: 0.013 },
        { id: 'src18', name: 'Silica', unit: 'tonne', base: 32, supply: 0.75, demand: 0.68, volatility: 0.007 },
        { id: 'src19', name: 'Helium', unit: 'm³', base: 48, supply: 0.47, demand: 0.65, volatility: 0.014 },
        { id: 'src20', name: 'Coal', unit: 'tonne', base: 138, supply: 0.69, demand: 0.64, volatility: 0.010 }
    ];
    const listeners = new Set();
    const quotes = Object.create(null);
    let timer = null;
    let marketMood = 0;

    definitions.forEach(item => {
        quotes[item.id] = { ...item, price: item.base, previousPrice: item.base, change: 0, changePercent: 0, updatedAt: Date.now() };
    });

    function snapshot() {
        return Object.fromEntries(definitions.map(item => [item.id, { ...quotes[item.id] }]));
    }

    function publish() {
        const current = snapshot();
        listeners.forEach(listener => listener(current));
    }

    function tick() {
        marketMood = Math.max(-0.025, Math.min(0.025, marketMood * 0.86 + (Math.random() - 0.5) * 0.008));
        const now = Date.now();
        definitions.forEach(item => {
            const quote = quotes[item.id];
            const imbalance = item.demand - item.supply;
            const drift = imbalance * 0.0012 + marketMood * 0.22;
            const shock = (Math.random() * 2 - 1) * item.volatility;
            quote.previousPrice = quote.price;
            quote.price = Math.max(item.base * 0.25, quote.price * (1 + drift + shock));
            quote.change = quote.price - quote.previousPrice;
            quote.changePercent = (quote.change / quote.previousPrice) * 100;
            quote.updatedAt = now;
        });
        publish();
    }

    function start(options = {}) {
        const intervalMs = Math.max(250, Number(options.intervalMs) || 2000);
        if (timer) clearInterval(timer);
        timer = setInterval(tick, intervalMs);
        return api;
    }

    function stop() {
        if (timer) clearInterval(timer);
        timer = null;
        return api;
    }

    const api = {
        currency: '€$',
        isFictional: true,
        getSnapshot: snapshot,
        getQuote(id) { return quotes[id] ? { ...quotes[id] } : null; },
        subscribe(listener, options = {}) {
            if (typeof listener !== 'function') throw new TypeError('Market subscriber must be a function');
            listeners.add(listener);
            if (options.immediate !== false) listener(snapshot());
            return () => listeners.delete(listener);
        },
        tick,
        start,
        stop
    };
    window.resourceMarket = api;

    const host = document.querySelector('[data-resource-market]');
    if (!host) return;
    const status = document.querySelector('[data-market-status]');
    const rows = new Map();
    const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    const percentFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    definitions.forEach(item => {
        const row = document.createElement('div');
        row.className = 'resource-market-row';
        row.dataset.resourceId = item.id;
        row.innerHTML = '<span class="resource-market-name"></span><span class="resource-market-unit"></span><span class="resource-market-price"></span><span class="resource-market-change"></span>';
        row.querySelector('.resource-market-name').textContent = item.name;
        row.querySelector('.resource-market-unit').textContent = `per ${item.unit}`;
        host.append(row);
        rows.set(item.id, row);
    });

    api.subscribe(current => {
        definitions.forEach(item => {
            const quote = current[item.id];
            const row = rows.get(item.id);
            row.querySelector('.resource-market-price').textContent = `${api.currency}${formatter.format(quote.price)}`;
            const change = row.querySelector('.resource-market-change');
            change.textContent = `${percentFormatter.format(quote.changePercent)}%`;
            change.classList.toggle('is-up', quote.change >= 0);
            change.classList.toggle('is-down', quote.change < 0);
            row.dataset.direction = quote.change >= 0 ? 'up' : 'down';
        });
        if (status) status.textContent = `SIMULATED MARKET · updated ${new Date().toLocaleTimeString()}`;
    });
    api.start();
})();
