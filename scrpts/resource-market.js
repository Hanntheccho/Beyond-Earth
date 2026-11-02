(function () {
    const ticker = document.querySelector('.market-text-txt');
    if (!ticker) return;

    const market = (typeof window.valueChanges === 'object' && window.valueChanges.getMarket)
        ? window.valueChanges.getMarket('resources')
        : null;

    function renderTicker(current) {
        if (!current || !current.length) return;
        const items = current.map(item => {
            const direction = item.change > 0 ? 'positive' : (item.change < 0 ? 'negative' : 'neutrale');
            const sign = item.changePercent > 0 ? '+' : '';
            return `<span class="${direction}">${sign}${(item.changePercent || 0).toFixed(1)}</span> ${item.name}`;
        });
        ticker.innerHTML = `MondayMarket ||| ${items.join(' | ')}`;
    }

    if (market) market.subscribe(renderTicker, { immediate: true });
})();
