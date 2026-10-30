(function () {
    const valueFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const percentFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });

    function renderMarketGrid(host) {
        const marketId = host.dataset.marketGrid;
        if (!marketId) return;
        const status = Array.from(document.querySelectorAll('[data-market-status]'))
            .find(element => element.dataset.marketStatus === marketId);
        const market = window.valueChanges.getMarket(marketId);
        const rows = new Map();

        function render(current) {
            if (!current.length) return;
            const sorted = current.slice().sort((a, b) => b.value - a.value);
            const keys = sorted.map(item => item.tag || item.name);
            const rowsChanged = keys.length !== rows.size || keys.some(key => !rows.has(key));
            if (rowsChanged) {
                host.replaceChildren();
                rows.clear();
                sorted.forEach(item => {
                    const key = item.tag || item.name;
                    const row = document.createElement('div');
                    row.className = 'data-grid-row';
                    row.dataset.itemKey = key;
                    row.innerHTML = '<span class="data-grid-name"></span><span class="data-grid-unit">€$B</span><span class="data-grid-price"></span><span class="data-grid-change"></span>';
                    row.querySelector('.data-grid-name').textContent = item.name;
                    host.appendChild(row);
                    rows.set(key, row);
                });
            }

            sorted.forEach((item, index) => {
                const row = rows.get(item.tag || item.name);
                if (host.children[index] !== row) {
                    host.insertBefore(row, host.children[index] || null);
                }
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

    document.querySelectorAll('[data-market-grid]').forEach(renderMarketGrid);
})();
