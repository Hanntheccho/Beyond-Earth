// panel-toggle.js - Tabbed panels. A button with data-panel-group and data-panel-target
// shows the element with that id and hides the other panels of the same group
// (elements with the same data-panel-group but no data-panel-target).
document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-panel-target][data-panel-group]');
    if (!button) return;

    const group = button.dataset.panelGroup;
    const activePanel = document.getElementById(button.dataset.panelTarget);
    if (!activePanel || activePanel.dataset.panelGroup !== group) return;

    document.querySelectorAll(`[data-panel-group="${CSS.escape(group)}"]`).forEach(element => {
        if (element.hasAttribute('data-panel-target')) {
            element.setAttribute('aria-pressed', String(element === button));
            return;
        }
        const isActive = element === activePanel;
        element.hidden = !isActive;
        element.setAttribute('aria-hidden', String(!isActive));
    });
});
