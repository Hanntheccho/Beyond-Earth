// Fictional market capitalizations in billions of eurodollars (€$).
window.marketData = [
    { name: "ARC International", tag: "ARC", value: 12223 },
    { name: "PLENFOR Armor & Steel", tag: "PLEN", value: 620 },
    { name: "Lithiumaniac", tag: "LITH", value: 260 },
    { name: "Sub-Orbital Contractors", tag: "SOC", value: 910 },
    { name: "NADL Industries", tag: "NADL", value: 470 },
    { name: "INCOM International", tag: "INCOM", value: 180 },
    { name: "Pavlov Energy", tag: "PAVL", value: 940 },
    { name: "AutoFarm International", tag: "AFI", value: 1090 },
    { name: "BioTechnica", tag: "BIOT", value: 450 },
    { name: "INTRCD", tag: "INTR", value: 290 },
    { name: "Trauma Medical", tag: "TMED", value: 1120 },
    { name: "LOW Artillery Foundries", tag: "LOW", value: 980 },
    { name: "Global Concord", tag: "GLBL", value: 1920 },
    { name: "CivMil", tag: "CVML", value: 2040 },
    { name: "Compact Corporation", tag: "COM", value: 1240 },
    { name: "ChemMax", tag: "MAX", value: 2040 },
    { name: "Ark Initiative", tag: "ARK", value: 460 },
    { name: "Meridian Continental", tag: "MECON", value: 480 },
    { name: "Vostok Heavy Industries", tag: "VHI", value: 780 },
    { name: "Aegis Security Group", tag: "AEG", value: 310 },
    { name: "Verdant Covenant", tag: "VERCO", value: 50 },
    { name: "Arakawa-Sun", tag: "ARAK", value: 830 },
    { name: "Militarch", tag: "MILI", value: 580 },
    { name: "Vanguard Terraform", tag: "VAN", value: 270 },
    { name: "Pioneer Habitat Works", tag: "PHW", value: 180 },
    { name: "Antarctica Trust", tag: "ANTT", value: 2840 },
    { name: "Atlas Medical Network", tag: "AMN", value: 930 },
    { name: "Apex Executive Trust", tag: "AET", value: 810 },
    { name: "New Dawn Robotics", tag: "NDR", value: 690 },
    { name: "Petrochem", tag: "PCHEM", value: 560 },
    { name: "Ternion Materials", tag: "TRN", value: 470 },
    { name: "Parasol Biomedical", tag: "PABIO", value: 390 },
    { name: "Aurora Biotech", tag: "AUR", value: 315 },
    { name: "Cooperativa Minera de Lima", tag: "COOP", value: 6380 },
    { name: "Lumen Education", tag: "LUM", value: 175 },
    { name: "Tundra Ridge Industrial", tag: "TUN", value: 120 },
    { name: "Obsidian Plateau", tag: "OBS", value: 82 },
    { name: "Netwarden", tag: "NETW", value: 46 }
];

// Fictional, local-only company market caps in billions of eurodollars (€$).
(function () {
    const companies = window.marketData;
    const listeners = new Set();
    let marketMood = 0;
    let timer = null;

    companies.forEach(company => {
        company.baseValue = company.value;
        // Larger firms tend to move less than smaller, more speculative firms.
        company.volatility = Math.max(0.0035, Math.min(0.016, 0.014 / Math.sqrt(company.value / 100)));
        company.change = 0;
        company.changePercent = 0;
        company.updatedAt = Date.now();
    });

    function snapshot() {
        return companies.map(company => ({ ...company }));
    }

    function publish() {
        const current = snapshot();
        listeners.forEach(listener => listener(current));
    }

    function tick() {
        marketMood = Math.max(-0.02, Math.min(0.02, marketMood * 0.86 + (Math.random() - 0.5) * 0.006));
        const now = Date.now();
        companies.forEach(company => {
            const sectorDrift = (Math.random() - 0.5) * 0.0012;
            const shock = (Math.random() * 2 - 1) * company.volatility;
            const previousValue = company.value;
            company.value = Math.max(company.baseValue * 0.25,
                company.value * (1 + marketMood * 0.2 + sectorDrift + shock));
            company.change = company.value - previousValue;
            company.changePercent = (company.change / previousValue) * 100;
            company.updatedAt = now;
        });
        publish();
    }

    const api = {
        currency: '€$',
        unit: 'billions',
        isFictional: true,
        getSnapshot: snapshot,
        getQuote(tag) {
            const company = companies.find(item => item.tag === tag);
            return company ? { ...company } : null;
        },
        subscribe(listener, options = {}) {
            if (typeof listener !== 'function') throw new TypeError('Market subscriber must be a function');
            listeners.add(listener);
            if (options.immediate !== false) listener(snapshot());
            return () => listeners.delete(listener);
        },
        tick,
        start(options = {}) {
            const intervalMs = Math.max(250, Number(options.intervalMs) || 2000);
            if (timer) clearInterval(timer);
            timer = setInterval(tick, intervalMs);
            return api;
        },
        stop() {
            if (timer) clearInterval(timer);
            timer = null;
            return api;
        }
    };

    window.companyMarket = api;

    const marketChartHost = document.querySelector('[data-treemap="market"]');
    if (marketChartHost && window.defaultTreemap) {
        const marketChartPanel = marketChartHost.closest('.treemap-panel');
        const marketChart = window.defaultTreemap.mount(marketChartHost, {
            root: { name: 'Market', children: companies },
            rootLabel: 'Market',
            breadcrumbs: marketChartPanel && marketChartPanel.querySelector('.treemap-breadcrumbs'),
            status: marketChartPanel && marketChartPanel.querySelector('.treemap-status'),
            accessible: true,
            getName: company => company.tag,
            getTitleName: company => company.name,
            getValue: company => company.value,
            getChange: company => company.change,
            getChangePercent: company => company.changePercent,
            formatValue: company => `€$${new Intl.NumberFormat('en-US').format(company.value)}B`,
            formatTotal: value => `€$${new Intl.NumberFormat('en-US').format(value)}B`
        });
        api.subscribe(() => marketChart.update(), { immediate: false });
    }

    const host = document.querySelector('[data-company-market]');
    if (host) {
        const status = document.querySelector('[data-company-market-status]');
        const rows = new Map();
        const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
        const percentFormatter = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always'
        });

        companies.forEach(company => {
            const row = document.createElement('div');
            row.className = 'resource-market-row';
            row.dataset.companyTag = company.tag;
            row.innerHTML = '<span class="resource-market-name"></span><span class="resource-market-unit">market cap</span><span class="resource-market-price"></span><span class="resource-market-change"></span>';
            row.querySelector('.resource-market-name').textContent = company.name;
            host.append(row);
            rows.set(company.tag, row);
        });

        api.subscribe(current => {
            current.forEach(company => {
                const row = rows.get(company.tag);
                row.querySelector('.resource-market-price').textContent = `${api.currency}${formatter.format(company.value)}B`;
                const change = row.querySelector('.resource-market-change');
                change.textContent = `${percentFormatter.format(company.changePercent)}%`;
                change.classList.toggle('is-up', company.change >= 0);
                change.classList.toggle('is-down', company.change < 0);
                row.dataset.direction = company.change >= 0 ? 'up' : 'down';
            });
            if (status) status.textContent = `MONDAYMARKET · updated ${new Date().toLocaleTimeString()}`;
        });
    }

    api.start();
})();
