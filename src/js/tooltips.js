// tooltips.js - Tooltips for elements with class "has-tooltip". data-tooltip holds a
// localization key (or the text itself). Tooltips nest: a trigger inside an open
// tooltip opens a child tooltip, and a tooltip stays open while one of its children is.
// Uses event delegation, so triggers added later (POI panels, tooltip content) work
// without being bound one by one.
import { formatLocalizationValue, localizationData } from './loc.js';

const TRIGGER_SELECTOR = '.has-tooltip';
const CLOSE_DELAY = 250;  // ms after the pointer or focus leaves before a tooltip closes
const SWITCH_DELAY = 150; // ms of hover before another trigger replaces an open tooltip

let tooltipEntries = [];
let tooltipEntryId = 0;
let tooltipSwitchTimer;
let tooltipSwitchTrigger = null;

// True when entry is a child, grandchild... of ancestor.
function isDescendantOf(entry, ancestor) {
    for (let parent = entry.parent; parent; parent = parent.parent) {
        if (parent === ancestor) return true;
    }
    return false;
}

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
    return tooltipEntries.some(candidate => isDescendantOf(candidate, entry));
}

// Removes the descendants of entry, deepest first.
function removeDescendants(entry) {
    tooltipEntries
        .filter(candidate => isDescendantOf(candidate, entry))
        .reverse()
        .forEach(child => removeTooltipEntry(child, false));
}

function removeTooltipEntry(entry, rescheduleParent) {
    removeDescendants(entry);

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
    entry.closeTimer = setTimeout(() => {
        const active = document.activeElement;
        if (entry.trigger.matches(':hover') || entry.popup.matches(':hover') ||
            active === entry.trigger || entry.popup.contains(active) || tooltipHasDescendant(entry)) {
            return;
        }
        if (tooltipEntries.includes(entry)) removeTooltipEntry(entry, true);
    }, CLOSE_DELAY);
}

function positionTooltip(popup, trigger) {
    const bounds = trigger.getBoundingClientRect();
    const padding = 8;
    const gap = 10;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const aboveSpace = Math.max(0, bounds.top - gap - padding);
    const belowSpace = Math.max(0, viewportHeight - bounds.bottom - gap - padding);
    const preferredSide = bounds.top < 140 ? 'bottom' : 'top';
    const preferredSpace = preferredSide === 'top' ? aboveSpace : belowSpace;
    const side = preferredSpace >= Math.min(420, viewportHeight * 0.6)
        ? preferredSide
        : (aboveSpace >= belowSpace ? 'top' : 'bottom');
    const sideSpace = side === 'top' ? aboveSpace : belowSpace;

    popup.style.maxHeight = `${Math.min(420, viewportHeight * 0.6, sideSpace)}px`;
    const popupBounds = popup.getBoundingClientRect();
    let left = bounds.left + (bounds.width - popupBounds.width) / 2;
    const top = side === 'top'
        ? bounds.top - popupBounds.height - gap
        : bounds.bottom + gap;

    left = Math.max(padding, Math.min(left, viewportWidth - popupBounds.width - padding));

    popup.style.left = `${left + window.scrollX}px`;
    popup.style.top = `${top + window.scrollY}px`;
}

// Fills elements inside the tooltip whose class is a localization key (nested POI titles).
function localizeTooltipContent(popup) {
    if (!localizationData) return;

    popup.querySelectorAll('[class]').forEach(element => {
        const localizationKey = Array.from(element.classList)
            .find(className => Object.hasOwn(localizationData, className));
        if (!localizationKey) return;

        element.innerHTML = localizationData[localizationKey];
        formatLocalizationValue(localizationKey).then(value => {
            if (element.isConnected) element.innerHTML = value;
        }).catch(error => {
            console.error('Error formatting tooltip localization:', error);
        });
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

    // A trigger inside an open tooltip replaces that tooltip's children; any other
    // trigger replaces every open tooltip.
    const parent = tooltipParentFor(trigger);
    if (parent) {
        removeDescendants(parent);
    } else {
        tooltipEntries.slice().reverse().forEach(entry => removeTooltipEntry(entry, false));
    }

    const popup = document.createElement('div');
    popup.id = `tooltip-popup-${++tooltipEntryId}`;
    popup.className = 'tooltip-popup';
    const tooltipValue = trigger.dataset.tooltip || '';
    const localizationKey = localizationData && Object.hasOwn(localizationData, tooltipValue)
        ? tooltipValue
        : null;
    popup.innerHTML = localizationKey ? localizationData[localizationKey] : tooltipValue;
    popup.setAttribute('role', 'tooltip');
    popup.style.zIndex = String(1100 + tooltipEntries.length * 20);

    const entry = { trigger, popup, parent, closeTimer: null };
    popup.addEventListener('pointerenter', () => {
        clearTimeout(entry.closeTimer);
        clearTimeout(tooltipSwitchTimer);
    });
    popup.addEventListener('pointerleave', () => closeTooltip(entry));

    document.body.appendChild(popup);
    trigger.setAttribute('aria-describedby', popup.id);
    tooltipEntries.push(entry);
    positionTooltip(popup, trigger);

    function finishTooltipContent() {
        if (!popup.isConnected) return;
        localizeTooltipContent(popup);
        positionTooltip(popup, trigger);
    }

    if (localizationKey) {
        formatLocalizationValue(localizationKey).then(value => {
            if (popup.isConnected) popup.innerHTML = value;
            finishTooltipContent();
        }).catch(error => {
            console.error('Error formatting tooltip localization:', error);
        });
    } else {
        finishTooltipContent();
    }
}

function onTriggerEnter(trigger) {
    const existing = tooltipEntryFor(trigger);
    if (existing) {
        clearTimeout(existing.closeTimer);
        return;
    }

    if (tooltipEntries.length) {
        clearTimeout(tooltipSwitchTimer);
        tooltipSwitchTrigger = trigger;
        tooltipSwitchTimer = setTimeout(() => {
            if (trigger.matches(':hover')) showTooltip(trigger);
        }, SWITCH_DELAY);
    } else {
        showTooltip(trigger);
    }
}

function onTriggerLeave(trigger) {
    if (tooltipSwitchTrigger === trigger) {
        clearTimeout(tooltipSwitchTimer);
        tooltipSwitchTrigger = null;
    }
    const entry = tooltipEntryFor(trigger);
    if (entry) closeTooltip(entry);
}

function triggerFrom(node) {
    return node instanceof Element ? node.closest(TRIGGER_SELECTOR) : null;
}

// pointerover/pointerout bubble, unlike pointerenter/pointerleave. Moves between a
// trigger and its own children are ignored, so each fires once per trigger.
document.addEventListener('pointerover', event => {
    const trigger = triggerFrom(event.target);
    if (trigger && !trigger.contains(event.relatedTarget)) onTriggerEnter(trigger);
});
document.addEventListener('pointerout', event => {
    const trigger = triggerFrom(event.target);
    if (trigger && !trigger.contains(event.relatedTarget)) onTriggerLeave(trigger);
});
document.addEventListener('focusin', event => {
    const trigger = triggerFrom(event.target);
    if (trigger) showTooltip(trigger);
});
document.addEventListener('focusout', event => {
    const trigger = triggerFrom(event.target);
    const entry = trigger && tooltipEntryFor(trigger);
    if (entry) closeTooltip(entry);
});
