// Data view toggle: inside <main>, swaps the scenario briefing article
// (#briefing-view) for the data article (#data-view) with the treemaps, data
// grids and relations graph. The title, ticker and layout of <main> are shared.
(function () {
    const dataViewToggle = document.getElementById('data-view-toggle');
    const briefingView = document.getElementById('briefing-view');
    const dataView = document.getElementById('data-view');
    const mainVisibilityToggle = document.querySelector('.main-visibility-toggle');
    if (!dataViewToggle || !briefingView || !dataView) return;

    dataViewToggle.addEventListener('click', () => {
        const isOpen = dataViewToggle.getAttribute('aria-pressed') !== 'true';
        dataViewToggle.setAttribute('aria-pressed', String(isOpen));
        dataViewToggle.setAttribute('aria-label', isOpen ? 'Hide data view' : 'Show data view');

        briefingView.hidden = isOpen;
        dataView.hidden = !isOpen;

        // aria-expanded="false" means <main> is hidden: bring it back.
        if (mainVisibilityToggle && mainVisibilityToggle.getAttribute('aria-expanded') === 'false') {
            mainVisibilityToggle.click();
        }
        window.scrollTo(0, 0);
    });
})();
