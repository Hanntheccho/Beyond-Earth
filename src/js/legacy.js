const legacyFiles = {
    beLegacy01: "data/legacy/be-legacy-victory-points.txt",
    beLegacy02: "data/legacy/be-legacy-strategic-regions.txt",
    beLegacy03: "data/legacy/be-legacy-states.txt",
    beLegacy04: "data/legacy/be-legacy-parties.txt"
};

// Combine legacy file fetches into one request
Promise.all(Object.values(legacyFiles).map(f => fetch(f).then(r => r.ok ? r.text() : null)))
.then(texts => {
  let i = 0;
  texts.forEach(text => {
    if (text) document.getElementById(Object.keys(legacyFiles)[i]).textContent = text;
    i++;
  });
})
.catch(error => console.error('Error loading legacy files:', error));
