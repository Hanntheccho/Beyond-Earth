(function () {
    const valueFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const percentFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    function renderMarketGrid(market) {
        const host = document.querySelector(`[data-${market.key}-market]`);
        if (!host) return;
        const status = document.querySelector(`[data-${market.key}-market-status]`);
        const rows = new Map();

        function render(current) {
            if (!current.length) return;
            const keys = current.map(item => item.tag || item.name);
            const existingKeys = Array.from(rows.keys());
            const rowsChanged = keys.length !== rows.size || keys.some((key, index) => existingKeys[index] !== key);
            if (rowsChanged) {
                host.replaceChildren();
                rows.clear();
                current.forEach(item => {
                    const key = item.tag || item.name;
                    const row = document.createElement('div');
                    row.className = 'data-grid-row';
                    row.dataset[`${market.key}Tag`] = key;
                    row.innerHTML = '<span class="data-grid-name"></span><span class="data-grid-unit">€$B</span><span class="data-grid-price"></span><span class="data-grid-change"></span>';
                    row.querySelector('.data-grid-name').textContent = item.name;
                    host.appendChild(row);
                    rows.set(key, row);
                });
            }

            current.forEach(item => {
                const row = rows.get(item.tag || item.name);
                row.querySelector('.data-grid-price').textContent = valueFormat.format(item.value);
                const change = row.querySelector('.data-grid-change');
                change.textContent = percentFormat.format(item.changePercent);
                change.classList.toggle('is-up', item.change >= 0);
                change.classList.toggle('is-down', item.change < 0);
                row.dataset.direction = item.change >= 0 ? 'up' : 'down';
            });
            if (status) status.textContent = `MONDAYMARKET · updated ${new Date().toLocaleTimeString()}`;
        }

        market.subscribe(render);
    }

    renderMarketGrid(window.companyMarket);
    renderMarketGrid(window.countryMarket);
})();
