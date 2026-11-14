document.addEventListener('click', function(event) {
    const button = event.target.closest && event.target.closest('[data-panel-target][data-panel-group]');
    if (!button) return;

    const group = button.getAttribute('data-panel-group');
    const targetId = button.getAttribute('data-panel-target');
    const activePanel = document.getElementById(targetId);
    if (!activePanel || activePanel.getAttribute('data-panel-group') !== group) return;

    document.querySelectorAll('[data-panel-target][data-panel-group]').forEach(function(candidate) {
        if (candidate.getAttribute('data-panel-group') !== group) return;
        candidate.setAttribute('aria-pressed', String(candidate === button));
    });
    document.querySelectorAll('[data-panel-group]:not([data-panel-target])').forEach(function(panel) {
        if (panel.getAttribute('data-panel-group') !== group) return;
        const isActive = panel === activePanel;
        panel.hidden = !isActive;
        panel.setAttribute('aria-hidden', String(!isActive));
    });
});
