const mainVisibilityToggle = document.querySelector('.main-visibility-toggle');
const mainContent = document.getElementById('main-content');
const globeCanvas = document.getElementById('map');
const globeMarkerLayer = document.getElementById('globe-markers');
mainVisibilityToggle.addEventListener('click', function() {
    const isExpanded = mainVisibilityToggle.getAttribute('aria-expanded') === 'true';
    mainContent.hidden = isExpanded;
    globeCanvas.classList.toggle('is-emphasized', isExpanded);
    if (globeMarkerLayer) {
        globeMarkerLayer.classList.toggle('is-emphasized', isExpanded);
        globeMarkerLayer.inert = !isExpanded;
        globeMarkerLayer.setAttribute('aria-hidden', String(!isExpanded));
    }
    mainVisibilityToggle.setAttribute('aria-expanded', String(!isExpanded));
    mainVisibilityToggle.setAttribute('aria-label', isExpanded ? 'Show content' : 'Hide content');
});
