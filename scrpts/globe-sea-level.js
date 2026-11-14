// Year slider that drives the globe's sea level. Values come from
// scenarioChartData.seaLevel, so the slider and the chart always agree.
// globe.js listens for the 'sealevelchange' event.
(function () {
    const points = (window.scenarioChartData?.seaLevel || []).slice().sort((a, b) => a.year - b.year);
    const host = document.querySelector('.globe-preview');
    if (!points.length || !host) return;

    const first = points[0].year;
    const last = points.at(-1).year;

    function levelAt(year) {
        const i = points.findIndex(p => p.year >= year);
        if (i <= 0) return points[0].value;
        const a = points[i - 1], b = points[i];
        return a.value + (year - a.year) / (b.year - a.year) * (b.value - a.value);
    }

    const panel = document.createElement('div');
    panel.className = 'sea-level';
    panel.innerHTML = `
        <input type="range" min="${first}" max="${last}" step="1" value="${last}" aria-label="Year">
        <output class="sea-level-readout" aria-live="off"></output>`;
    host.append(panel);

    const slider = panel.querySelector('input');
    const readout = panel.querySelector('output');

    function apply() {
        const year = +slider.value;
        const meters = levelAt(year);
        window.__seaLevel = meters;
        window.dispatchEvent(new CustomEvent('sealevelchange', { detail: { meters } }));
        readout.textContent = `${year} · +${meters.toFixed(1)} m`;
    }

    slider.addEventListener('input', apply);
    apply();
})();
