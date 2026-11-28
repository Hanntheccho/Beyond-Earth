// panel-toggle.js - Tabbed panels. A button with data-panel-group and data-panel-target
// shows the element with that id and hides the other panels of the same group
// (elements with the same data-panel-group but no data-panel-target). A tab (a button
// with aria-pressed) is pressed while its panel is on screen, whichever button showed
// it; a button that only leads to a panel, such as the [❯❯❯] key in a treemap's nav
// bar, has no aria-pressed and gets none. When the button pressed sat in a panel it
// hid, the focus goes on to the first button of the same group in the panel shown, so
// the keyboard can keep going.
document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-panel-target][data-panel-group]');
    if (!button) return;

    const group = button.dataset.panelGroup;
    const activePanel = document.getElementById(button.dataset.panelTarget);
    if (!activePanel || activePanel.dataset.panelGroup !== group) return;

    const inGroup = `[data-panel-group="${CSS.escape(group)}"]`;
    document.querySelectorAll(inGroup).forEach(element => {
        if (element.hasAttribute('data-panel-target')) {
            if (element.hasAttribute('aria-pressed')) {
                element.setAttribute('aria-pressed', String(element.dataset.panelTarget === activePanel.id));
            }
            return;
        }
        const isActive = element === activePanel;
        element.hidden = !isActive;
        element.setAttribute('aria-hidden', String(!isActive));
    });

    if (button.closest(`${inGroup}:not([data-panel-target])`)?.hidden) {
        activePanel.querySelector(`${inGroup}[data-panel-target]`)?.focus();
    }
});

