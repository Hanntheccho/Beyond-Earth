$(document).ready(function() {
    var bgm = document.getElementById("music");
    bgm.volume = 0.0;

    var hso = document.getElementById("audio");
    hso.volume = 0.4;

    $(".poi").mouseenter(function() {
        hso.play();
    });
});

document.querySelectorAll('.div-desc').forEach(function(description, index) {
    const content = document.createElement('div');
    content.className = 'div-desc-content';

    while (description.firstChild) {
        content.appendChild(description.firstChild);
    }

    const toggle = document.createElement('button');
    toggle.className = 'div-desc-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', 'description-content-' + index);
    content.id = 'description-content-' + index;
    description.append(toggle, content);

    function setExpanded(expanded) {
        const wasExpanded = toggle.getAttribute('aria-expanded') === 'true';

        if (expanded !== wasExpanded) {
            content.style.maxHeight = content.getBoundingClientRect().height + 'px';
            content.getBoundingClientRect();
            description.classList.toggle('is-collapsed', !expanded);
            content.style.maxHeight = expanded ? content.scrollHeight + 'px' : '4.5em';
        }

        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', expanded ? 'Ocultar descripción' : 'Mostrar descripción completa');
        toggle.textContent = expanded ? '−' : '+';
    }

    content.addEventListener('transitionend', function(event) {
        if (event.propertyName === 'max-height' && toggle.getAttribute('aria-expanded') === 'true') {
            content.style.maxHeight = 'none';
        }
    });

    toggle.addEventListener('click', function() {
        setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
    });

    const initiallyExpanded = description.dataset.collapsed !== 'true';
    description.classList.toggle('is-collapsed', !initiallyExpanded);
    toggle.setAttribute('aria-expanded', String(initiallyExpanded));
    toggle.setAttribute('aria-label', initiallyExpanded ? 'Ocultar descripción' : 'Mostrar descripción completa');
    toggle.textContent = initiallyExpanded ? '−' : '+';
});

document.querySelectorAll('.div-desc-win.grid a[href^="#poi"]').forEach(function(link) {
    link.addEventListener('click', function() {
        const poi = document.getElementById(link.hash.slice(1));
        const toggle = poi && poi.querySelector('.div-desc-toggle');
        if (toggle && toggle.getAttribute('aria-expanded') !== 'true') {
            toggle.click();
        }
    });
});

function positionTooltips() {
    document.querySelectorAll('.has-tooltip').forEach(function(element) {
        const bounds = element.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;

        element.dataset.tooltipSide = bounds.top < 140 ? 'bottom' : 'top';
        if (bounds.left < 150) {
            element.dataset.tooltipAlign = 'left';
        } else if (bounds.right > viewportWidth - 150) {
            element.dataset.tooltipAlign = 'right';
        } else {
            element.dataset.tooltipAlign = 'center';
        }
    });
}

positionTooltips();
window.addEventListener('resize', positionTooltips);
window.addEventListener('scroll', positionTooltips, { passive: true });

let tooltipCloseTimer;
let tooltipSwitchTimer;
let activeTooltipPopup = null;
let activeTooltipTrigger = null;

function removeActiveTooltip() {
    clearTimeout(tooltipCloseTimer);
    clearTimeout(tooltipSwitchTimer);
    if (activeTooltipPopup) activeTooltipPopup.remove();
    if (activeTooltipTrigger) activeTooltipTrigger.removeAttribute('aria-describedby');
    activeTooltipPopup = null;
    activeTooltipTrigger = null;
}

function closeTooltip(popup, trigger) {
    clearTimeout(tooltipCloseTimer);
    tooltipCloseTimer = setTimeout(function() {
        const active = document.activeElement;
        if (trigger.matches(':hover') || popup.matches(':hover') || active === trigger || popup.contains(active)) {
            return;
        }
        if (activeTooltipPopup === popup) removeActiveTooltip();
    }, 500);
}

function positionTooltip(popup, trigger) {
    const bounds = trigger.getBoundingClientRect();
    const padding = 8;
    const gap = 10;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const aboveSpace = Math.max(0, bounds.top - gap - padding);
    const belowSpace = Math.max(0, viewportHeight - bounds.bottom - gap - padding);
    const preferredSide = trigger.dataset.tooltipSide === 'bottom' ? 'bottom' : 'top';
    const preferredSpace = preferredSide === 'top' ? aboveSpace : belowSpace;
    const side = preferredSpace >= Math.min(420, viewportHeight * 0.6)
        ? preferredSide
        : (aboveSpace >= belowSpace ? 'top' : 'bottom');
    const sideSpace = side === 'top' ? aboveSpace : belowSpace;

    popup.style.maxHeight = Math.min(420, viewportHeight * 0.6, sideSpace) + 'px';
    const popupBounds = popup.getBoundingClientRect();
    let left = bounds.left + (bounds.width - popupBounds.width) / 2;
    const top = side === 'top'
        ? bounds.top - popupBounds.height - gap
        : bounds.bottom + gap;

    left = Math.max(padding, Math.min(left, viewportWidth - popupBounds.width - padding));

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
}

document.querySelectorAll('.has-tooltip').forEach(function(trigger, index) {
    function showTooltip() {
        clearTimeout(tooltipCloseTimer);
        let popup = document.getElementById('tooltip-popup-' + index);
        if (activeTooltipPopup && activeTooltipPopup !== popup) {
            removeActiveTooltip();
            popup = null;
        }
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'tooltip-popup-' + index;
            popup.className = 'tooltip-popup';
            popup.textContent = trigger.dataset.tooltip || '';
            popup.setAttribute('role', 'tooltip');
            popup.addEventListener('pointerenter', function() {
                clearTimeout(tooltipCloseTimer);
                clearTimeout(tooltipSwitchTimer);
            });
            popup.addEventListener('pointerleave', function() {
                closeTooltip(popup, trigger);
            });
            document.body.appendChild(popup);
            trigger.setAttribute('aria-describedby', popup.id);
        }
        activeTooltipPopup = popup;
        activeTooltipTrigger = trigger;
        positionTooltip(popup, trigger);
    }

    trigger.addEventListener('pointerenter', function() {
        if (activeTooltipPopup && activeTooltipTrigger !== trigger) {
            clearTimeout(tooltipSwitchTimer);
            tooltipSwitchTimer = setTimeout(showTooltip, 250);
            return;
        }
        showTooltip();
    });
    trigger.addEventListener('pointerleave', function() {
        clearTimeout(tooltipSwitchTimer);
        const popup = document.getElementById('tooltip-popup-' + index);
        if (popup) closeTooltip(popup, trigger);
    });
    trigger.addEventListener('focusin', showTooltip);
    trigger.addEventListener('focusout', function() {
        const popup = document.getElementById('tooltip-popup-' + index);
        if (popup) closeTooltip(popup, trigger);
    });
});

function repositionOpenTooltips() {
    document.querySelectorAll('.has-tooltip').forEach(function(trigger, index) {
        const popup = document.getElementById('tooltip-popup-' + index);
        if (popup) positionTooltip(popup, trigger);
    });
}

window.addEventListener('resize', repositionOpenTooltips);
window.addEventListener('scroll', repositionOpenTooltips, { passive: true });

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion) {
    window.addEventListener('pointermove', function(event) {
        document.documentElement.style.setProperty('--cursor-x', event.clientX + 'px');
        document.documentElement.style.setProperty('--cursor-y', event.clientY + 'px');
    }, { passive: true });
}

if (!prefersReducedMotion) {
    let scrollUpdatePending = false;
    window.addEventListener('scroll', function() {
        if (scrollUpdatePending) return;
        scrollUpdatePending = true;
        window.requestAnimationFrame(function() {
            const scrollY = window.scrollY;
            document.documentElement.style.setProperty('--bg-scroll-large', (-scrollY * 0.08) + 'px');
            document.documentElement.style.setProperty('--bg-scroll-small', (-scrollY * 0.04) + 'px');
            scrollUpdatePending = false;
        });
    }, { passive: true });
}
