$(document).ready(function() {
    var bgm = document.getElementById("music");
    bgm.volume = 0.0;

    var hso = document.getElementById("audio");
    hso.volume = 0.4;

    $(".poi").mouseenter(function() {
        hso.play();
    });
});

document.querySelectorAll('.top-btns [data-panel]').forEach(function(button) {
    button.addEventListener('click', function() {
        const panelId = button.dataset.panel;
        const panel = document.getElementById(panelId);
        if (!panel) return;

        document.querySelectorAll('.div-h2 .content-panel').forEach(function(candidate) {
            const isActive = candidate === panel;
            candidate.hidden = !isActive;
            candidate.setAttribute('aria-hidden', String(!isActive));
        });

        document.querySelectorAll('.top-btns [data-panel]').forEach(function(candidate) {
            candidate.setAttribute('aria-pressed', String(candidate === button));
        });
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

let tooltipEntries = [];
let tooltipEntryId = 0;
let tooltipSwitchTimer;
let tooltipSwitchTrigger = null;
const tooltipBoundElements = new WeakSet();

function tooltipParentFor(trigger) {
    for (let index = tooltipEntries.length - 1; index >= 0; index--) {
        if (tooltipEntries[index].popup.contains(trigger)) return tooltipEntries[index];
    }
    return null;
}

function tooltipEntryFor(trigger) {
    return tooltipEntries.find(entry => entry.trigger === trigger);
}

function tooltipHasDescendant(entry) {
    return tooltipEntries.some(candidate => {
        let parent = candidate.parent;
        while (parent) {
            if (parent === entry) return true;
            parent = parent.parent;
        }
        return false;
    });
}

function removeTooltipEntry(entry, rescheduleParent) {
    tooltipEntries
        .filter(candidate => {
            let parent = candidate.parent;
            while (parent) {
                if (parent === entry) return true;
                parent = parent.parent;
            }
            return false;
        })
        .reverse()
        .forEach(child => removeTooltipEntry(child, false));

    clearTimeout(entry.closeTimer);
    entry.popup.remove();
    entry.trigger.removeAttribute('aria-describedby');
    tooltipEntries = tooltipEntries.filter(candidate => candidate !== entry);

    if (rescheduleParent && entry.parent && tooltipEntries.includes(entry.parent)) {
        closeTooltip(entry.parent);
    }
}

function closeTooltip(entry) {
    clearTimeout(entry.closeTimer);
    entry.closeTimer = setTimeout(function() {
        const active = document.activeElement;
        if (entry.trigger.matches(':hover') || entry.popup.matches(':hover') ||
            active === entry.trigger || entry.popup.contains(active) || tooltipHasDescendant(entry)) {
            return;
        }
        if (tooltipEntries.includes(entry)) removeTooltipEntry(entry, true);
    }, 250);
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

function localizeTooltipContent(popup) {
    if (!window.localizationData) return;

    popup.querySelectorAll('[class]').forEach(function(element) {
        const localizationKey = Array.from(element.classList)
            .find(className => Object.prototype.hasOwnProperty.call(window.localizationData, className));
        if (localizationKey) element.innerHTML = window.localizationData[localizationKey];
    });
}

function showTooltip(trigger) {
    clearTimeout(tooltipSwitchTimer);
    const existing = tooltipEntryFor(trigger);
    if (existing) {
        clearTimeout(existing.closeTimer);
        positionTooltip(existing.popup, trigger);
        return;
    }

    const parent = tooltipParentFor(trigger);
    if (parent) {
        tooltipEntries
            .filter(entry => {
                let ancestor = entry.parent;
                while (ancestor) {
                    if (ancestor === parent) return true;
                    ancestor = ancestor.parent;
                }
                return false;
            })
            .reverse()
            .forEach(entry => removeTooltipEntry(entry, false));
    } else {
        tooltipEntries.slice().reverse().forEach(entry => removeTooltipEntry(entry, false));
    }

    const popup = document.createElement('div');
    popup.id = 'tooltip-popup-' + (++tooltipEntryId);
    popup.className = 'tooltip-popup';
    const tooltipValue = trigger.dataset.tooltip || '';
    popup.innerHTML = window.localizationData &&
        Object.prototype.hasOwnProperty.call(window.localizationData, tooltipValue)
        ? window.localizationData[tooltipValue]
        : tooltipValue;
    popup.setAttribute('role', 'tooltip');
    popup.style.zIndex = String(1100 + tooltipEntries.length * 20);

    const entry = { trigger, popup, parent, closeTimer: null };
    popup.addEventListener('pointerenter', function() {
        clearTimeout(entry.closeTimer);
        clearTimeout(tooltipSwitchTimer);
    });
    popup.addEventListener('pointerleave', function() {
        closeTooltip(entry);
    });

    document.body.appendChild(popup);
    trigger.setAttribute('aria-describedby', popup.id);
    tooltipEntries.push(entry);
    localizeTooltipContent(popup);
    positionTooltip(popup, trigger);
    popup.querySelectorAll('.has-tooltip').forEach(bindTooltip);
}

function bindTooltip(trigger) {
    if (tooltipBoundElements.has(trigger)) return;
    tooltipBoundElements.add(trigger);

    trigger.addEventListener('pointerenter', function() {
        const existing = tooltipEntryFor(trigger);
        if (existing) {
            clearTimeout(existing.closeTimer);
            return;
        }

        if (tooltipEntries.length) {
            clearTimeout(tooltipSwitchTimer);
            tooltipSwitchTrigger = trigger;
            tooltipSwitchTimer = setTimeout(function() {
                if (trigger.matches(':hover')) showTooltip(trigger);
            }, 150);
        } else {
            showTooltip(trigger);
        }
    });
    trigger.addEventListener('pointerleave', function() {
        if (tooltipSwitchTrigger === trigger) {
            clearTimeout(tooltipSwitchTimer);
            tooltipSwitchTrigger = null;
        }
        const entry = tooltipEntryFor(trigger);
        if (entry) closeTooltip(entry);
    });
    trigger.addEventListener('focusin', function() {
        showTooltip(trigger);
    });
    trigger.addEventListener('focusout', function() {
        const entry = tooltipEntryFor(trigger);
        if (entry) closeTooltip(entry);
    });
}

document.querySelectorAll('.has-tooltip').forEach(bindTooltip);

function repositionOpenTooltips() {
    tooltipEntries.forEach(entry => positionTooltip(entry.popup, entry.trigger));
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
