(function () {
    const PANEL_GROUP = 'data-categories';
    const categories = [
        { key: 'gdp', label: 'World GDP' },
        { key: 'market', label: 'Market' },
        { key: 'resources', label: 'Resources' }
    ];

    const host = document.querySelector('[data-data-buttons]');
    if (!host) return;

    const buttons = categories.map((cat, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = cat.label;
        button.dataset.panelGroup = PANEL_GROUP;
        button.dataset.panelTarget = 'data-' + cat.key;
        button.setAttribute('aria-pressed', String(index === 0));
        return button;
    });

    host.replaceChildren(...buttons);
})();
