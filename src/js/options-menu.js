// options-menu.js - Opens and closes the options panel (theme and music controls).
document.addEventListener('DOMContentLoaded', () => {
    const optionsToggle = document.getElementById('options-toggle');
    const optionsMenu = document.getElementById('options-menu');
    if (!optionsToggle || !optionsMenu) return;

    function setOpen(open) {
        optionsMenu.hidden = !open;
        optionsToggle.setAttribute('aria-expanded', String(open));
        optionsToggle.setAttribute('aria-label', open ? 'Close options' : 'Open options');
    }

    optionsToggle.addEventListener('click', () => {
        setOpen(optionsMenu.hidden);
    });

    // Close when clicking anywhere outside the menu and its toggle.
    document.addEventListener('click', (event) => {
        if (optionsMenu.hidden) return;
        if (optionsMenu.contains(event.target) || optionsToggle.contains(event.target)) return;
        setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || optionsMenu.hidden) return;
        setOpen(false);
        optionsToggle.focus();
    });
});
