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
