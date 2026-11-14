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
    const preferredSide = bounds.top < 140 ? 'bottom' : 'top';
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

    popup.style.left = (left + window.scrollX) + 'px';
    popup.style.top = (top + window.scrollY) + 'px';
}

function localizeTooltipContent(popup) {
    if (!window.localizationData) return;

    popup.querySelectorAll('[class]').forEach(function(element) {
        const localizationKey = Array.from(element.classList)
            .find(className => Object.prototype.hasOwnProperty.call(window.localizationData, className));
        if (!localizationKey) return;

        element.innerHTML = window.localizationData[localizationKey];
        window.formatLocalizationValue(localizationKey).then(function(value) {
            if (element.isConnected) element.innerHTML = value;
        }).catch(function(error) {
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
    const localizationKey = window.localizationData &&
        Object.prototype.hasOwnProperty.call(window.localizationData, tooltipValue)
        ? tooltipValue
        : null;
    popup.innerHTML = localizationKey
        ? window.localizationData[localizationKey]
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
    positionTooltip(popup, trigger);

    function finishTooltipContent() {
        if (!popup.isConnected) return;
        localizeTooltipContent(popup);
        popup.querySelectorAll('.has-tooltip').forEach(bindTooltip);
        positionTooltip(popup, trigger);
    }

    if (localizationKey) {
        window.formatLocalizationValue(localizationKey).then(function(value) {
            if (popup.isConnected) popup.innerHTML = value;
            finishTooltipContent();
        }).catch(function(error) {
            console.error('Error formatting tooltip localization:', error);
        });
    } else {
        finishTooltipContent();
    }
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

const tooltipObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches('.has-tooltip')) bindTooltip(node);
            node.querySelectorAll('.has-tooltip').forEach(bindTooltip);
        });
    });
});

tooltipObserver.observe(document.body, { childList: true, subtree: true });
