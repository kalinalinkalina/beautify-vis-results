// Shared frontend plotting utilities for use by chart builder modules

/**
 * Filters out traces with falsy names or named 'trace'.
 * @param {Array<Object>} traces
 * @returns {Array<Object>} filtered traces
 */
function filterValidTraces(traces) {
    return traces.filter(t => {
        if (t.showlegend === false) return true;
        return t.name && String(t.name).toLowerCase() !== 'trace';
    });
}

/**
 * Generates axis tick values and text from a mapping.
 * @param {Array<string>} values - The values for the axis
 * @param {Object} labelMap - Mapping from value to label
 * @returns {{tickvals: Array<string>, ticktext: Array<string>}}
 */
function getAxisTicks(values, labelMap) {
    return {
        tickvals: values,
        ticktext: values.map(val => labelMap[val] || val)
    };
}

function getResponseScale(scaleKey = 'acceptability') {
    const scales = (typeof window !== 'undefined' && window.RESPONSE_SCALES) ? window.RESPONSE_SCALES : {};
    return scales[scaleKey] || scales.acceptability || {
        title: 'Acceptability',
        tickvals: [0, 1, 2, 3, 4, 5],
        ticktext: ["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
        range: [-0.5, 5.5]
    };
}

/**
 * Returns y-axis ticks and labels for the requested response scale.
 * @param {string} scaleKey
 * @returns {{tickvals: Array<number>, ticktext: Array<string>, range: Array<number>|null, title: string}}
 */
function getLikertYAxisTicks(scaleKey = 'acceptability') {
    const scale = getResponseScale(scaleKey);
    return {
        tickvals: scale.tickvals || [],
        ticktext: scale.ticktext || [],
        range: scale.range || null,
        title: scale.title || ''
    };
}

/**
 * Builds Plotly traces from grouped data.
 * @param {Array<Object>} data - Data array
 * @param {string} groupCol - Column to group by
 * @param {string} x - X axis field
 * @param {string} y - Y axis field
 * @param {Object} options - { colorMap, traceType, markerOptions, traceNameMap }
 * @returns {Array<Object>} traces
 */
function buildTracesFromGroups(data, groupCol, x, y, options = {}) {
    const {
        colorMap = {},
        traceType = 'box',
        markerOptions = {},
        traceNameMap = {},
        showLegend = true
    } = options;
    const groups = [...new Set(data.map(row => row[groupCol]))];
    return groups.map(group => {
        const groupData = data.filter(row => row[groupCol] === group);
        const traceName = traceNameMap[group] || group;
        const marker = markerOptions[group] || { color: colorMap[group] || undefined };
        if (traceType === 'box') {
            return {
                y: groupData.map(row => row[y]),
                x: groupData.map(row => row[x]),
                name: traceName,
                type: 'box',
                marker: marker,
                boxpoints: 'outliers',
                boxmean: false,
                line: { width: 2 },
                median: { line: { width: 6 } },
                offsetgroup: traceName,
                legendgroup: traceName,
                showlegend: showLegend
            };
        } else if (traceType === 'line') {
            return {
                x: groupData.map(row => row[x]),
                y: groupData.map(row => row[y]),
                name: traceName,
                mode: 'lines+markers',
                marker: marker,
                line: { color: colorMap[group] || undefined, width: 2 },
                connectgaps: true,
                showlegend: showLegend
            };
        }
        return null;
    }).filter(Boolean);
}

// Export for use by chart builder modules
if (typeof window !== 'undefined') {
    window.getResponseScale = getResponseScale;
    window.filterValidTraces = filterValidTraces;
    window.getAxisTicks = getAxisTicks;
    window.getLikertYAxisTicks = getLikertYAxisTicks;
    window.buildTracesFromGroups = buildTracesFromGroups;
}
