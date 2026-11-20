// Reads and normalizes the static data files used by the market visualizations.
// Simulation and presentation stay in data-calc.js and the view components.
export async function loadTreemapSource(path, useTags = false) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Treemap data could not be loaded: ${path} (${response.status})`);
    const source = await response.json();
    const parentValues = findParentValues(source);
    return {
        root: normalizeNode(source, useTags),
        parentValues
    };
}

export async function loadRelations() {
    const response = await fetch('data/relations.json');
    if (!response.ok) throw new Error(`Relations data could not be loaded (${response.status})`);
    return response.json();
}

function normalizeNode(source, useTags) {
    const node = { ...source };
    node.name = String(source.name || source.tag || 'Unnamed');
    node.label = useTags && source.tag ? String(source.tag) : node.name;
    node.value = Number(source.value) || 0;
    node.children = Array.isArray(source.children)
        ? source.children.map(child => normalizeNode(child, useTags))
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

