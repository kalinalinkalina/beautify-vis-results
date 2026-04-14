// Utility for group counts, legend label mapping, and legend order for plotting

/**
 * Computes group counts, legend order, and legend labels with counts for a given group column.
 * @param {Array<Object>} data - The cleaned data array
 * @param {string} groupCol - The column to group by
 * @param {Object} [labelMap] - Optional mapping from raw group value to display label
 * @param {Array<string>} [order] - Optional legend order (array of group values)
 * @param {Function} [explodeDomains] - Optional function to explode domains if groupCol is 'Domains'
 * @returns {Object} { presentGroups, groupCounts, legendOrder, legendLabelsWithCounts, groupLabelMap }
 */
function computeGroupCountsAndLabels(data, groupCol, labelMap, order, explodeDomains) {
    let presentGroups = [];
    let groupCounts = {};
    let workingData = data;
    if (groupCol === 'Domains' && typeof explodeDomains === 'function') {
        workingData = explodeDomains(data, groupCol)
            .filter(row => row[groupCol] && typeof row[groupCol] === 'string' && row[groupCol].toLowerCase() !== 'nan');
        presentGroups = Array.from(new Set(workingData.map(row => row[groupCol])));
        presentGroups.forEach(g => {
            groupCounts[g] = workingData.filter(row => row[groupCol] === g).length;
        });
    } else {
        presentGroups = Array.from(new Set(data.map(row => row[groupCol]).filter(x => x !== undefined && x !== null && x !== '')));
        presentGroups.forEach(g => {
            groupCounts[g] = data.filter(row => (labelMap && labelMap[row[groupCol]] ? labelMap[row[groupCol]] : row[groupCol]) === g).length;
        });
    }
    // Legend order
    let legendOrder = order ? order.filter(g => presentGroups.includes(g)) : presentGroups;
    presentGroups.forEach(g => { if (!legendOrder.includes(g)) legendOrder.push(g); });
    // Legend labels with counts
    let legendLabelsWithCounts = legendOrder.map(g => `${g} (${groupCounts[g] || 0})`);
    // Map displayGroup to label with count
    let groupLabelMap = {};
    legendOrder.forEach((g, i) => { groupLabelMap[g] = legendLabelsWithCounts[i]; });
    return { presentGroups, groupCounts, legendOrder, legendLabelsWithCounts, groupLabelMap };
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.computeGroupCountsAndLabels = computeGroupCountsAndLabels;
}
