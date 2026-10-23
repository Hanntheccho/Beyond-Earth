// GDP hierarchy loading and fictional live-value simulation.
(function () {
    const host = document.querySelector('[data-treemap="gdp"]');
    if (!host) return;

    const panel = host && host.closest('.treemap-panel');
    const status = panel && panel.querySelector('.treemap-status');
    let root;
    let chart;
    let marketMood = 0;

    function parse(text) {
        const roots = [];
        const stack = [];
        text.split(/\r?\n/).forEach(line => {
            if (!line.trim()) return;
            const indent = (line.match(/^\s*/) || [''])[0].length;
            const match = line.trim().match(/^(.*?)\s+(?:\(([-\d,]+)\)|([-\d,]+))\s*$/);
            if (!match) return;
            const name = match[1].trim();
            const node = { name, label: name, value: Number((match[2] || match[3]).replace(/,/g, '')), change: 0, changePercent: 0, currency: '€$', unit: '', children: [] };
            while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
            if (stack.length) stack[stack.length - 1].node.children.push(node);
            else roots.push(node);
            stack.push({ indent, node });
        });
        return roots;
    }

    function prepare(node) {
        node.baseValue = node.value;
        node.change = 0;
        node.changePercent = 0;
        node.volatility = node.children.length ? 0 : Math.max(0.0035, Math.min(0.016, 0.014 / Math.sqrt(node.value / 100)));
        node.children.forEach(prepare);
    }

    function tick() {
        const previousValues = new Map();
        function save(node) { previousValues.set(node, node.value); node.children.forEach(save); }
        save(root);
        marketMood = Math.max(-0.02, Math.min(0.02, marketMood * 0.86 + (Math.random() - 0.5) * 0.006));

        function update(node) {
            if (node.children.length) {
                node.children.forEach(update);
                node.value = node.children.reduce((sum, child) => sum + child.value, 0);
            } else {
                const sectorDrift = (Math.random() - 0.5) * 0.0012;
                const shock = (Math.random() * 2 - 1) * node.volatility;
                node.value = Math.max(node.baseValue * 0.25, node.value * (1 + marketMood * 0.2 + sectorDrift + shock));
            }
            node.change = node.value - previousValues.get(node);
            node.changePercent = previousValues.get(node) ? node.change / previousValues.get(node) * 100 : 0;
        }

        root.children.forEach(update);
        root.value = root.children.reduce((sum, child) => sum + child.value, 0);
        root.change = root.value - previousValues.get(root);
        root.changePercent = previousValues.get(root) ? root.change / previousValues.get(root) * 100 : 0;
        chart.update();
    }

    fetch('scrpts/country-gdp.txt').then(response => {
        if (!response.ok) throw new Error('GDP data could not be loaded.');
        return response.text();
    }).then(text => {
        root = { name: 'World', label: 'World', value: 0, change: 0, changePercent: 0, currency: '€$', unit: '', children: parse(text) };
        if (!root.children.length) throw new Error('No GDP entries were found in the data file.');
        prepare(root);
        root.value = root.children.reduce((sum, child) => sum + child.value, 0);
        chart = window.defaultTreemap.mount(host, {
            root,
            rootLabel: 'World',
            breadcrumbs: panel && panel.querySelector('.treemap-breadcrumbs'),
            status,
            accessible: true
        });
        window.setInterval(tick, 2000);
    }).catch(() => { if (status) status.textContent = 'GDP data could not be loaded. Open this page through a local web server and check scrpts/country-gdp.txt.'; });
})();
