// Reads and normalizes the static data files behind the live data views.
// Simulation and presentation stay in simulation.js and the view components.
export async function loadTree(path, useTags = false) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Treemap data could not be loaded: ${path} (${response.status})`);
    const raw = await response.json();
    const parentValues = findParentValues(raw);
    return {
        root: normalizeNode(raw, useTags),
        parentValues
    };
}

export async function loadRelations() {
    const response = await fetch('data/relations.json');
    if (!response.ok) throw new Error(`Relations data could not be loaded (${response.status})`);
    return response.json();
}

function normalizeNode(raw, useTags) {
    const node = { ...raw };
    node.name = String(raw.name || raw.tag || 'Unnamed');
    node.label = useTags && raw.tag ? String(raw.tag) : node.name;
    node.value = Number(raw.value) || 0;
    node.children = Array.isArray(raw.children)
        ? raw.children.map(child => normalizeNode(child, useTags))
        : [];
    return node;
}

function findParentValues(node, path = []) {
    const name = String(node.name || node.tag || 'Unnamed');
    const currentPath = path.concat(name);
    const children = Array.isArray(node.children) ? node.children : [];
    const warnings = children.length && Object.prototype.hasOwnProperty.call(node, 'value')
        ? [currentPath.join(' > ')]
        : [];
    children.forEach(child => warnings.push(...findParentValues(child, currentPath)));
    return warnings;
}

