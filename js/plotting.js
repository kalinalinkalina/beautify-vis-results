// Plotting utilities for dashboard (using Plotly.js)

/**
 * Draws a box plot using Plotly.js
 * @param {Array<Object>} data - Melted data array
 * @param {string} x - X axis field (e.g., 'Feature_Name')
 * @param {string} y - Y axis field (e.g., 'Numerical_Score')
 * @param {string} color - Field for grouping (e.g., 'Type')
 * @param {Object} options - { title, colorMap, categoryOrders, xaxisTitle, yaxisTitle }
 * @param {string} containerId - DOM element id to render the plot
 */
function makeBoxPlot(data, x, y, color, options, containerId) {
    const {
        title = '',
        colorMap = {},
        categoryOrders = {},
        xaxisTitle = '',
        yaxisTitle = '',
        legendOrder = null // Pass legendOrder for consistent legend ordering
    } = options || {};

    // Get unique groups for color, but use legendOrder if provided
    const groups = legendOrder ? legendOrder : [...new Set(data.map(row => row[color]))];
    const traces = groups.map(group => {
        const groupData = data.filter(row => row[color] === group);
        return {
            y: groupData.map(row => row[y]),
            x: groupData.map(row => row[x]),
            name: group, // Always use plain group name
            type: 'box',
            marker: { color: colorMap[group] || undefined },
            boxpoints: 'outliers', // Show outliers as dots
            boxmean: false,
            line: { width: 2 }, // Median line thickness (default for box border)
            median: { line: { width: 4 } } // Median line 2x thicker
        };
    });

    // X tick labels
    const xVals = [...new Set(data.map(row => row[x]))];
    const xTickText = xVals.map(val => FEATURE_LABELS[val] || val);

    const layout = {
        title,
        boxmode: 'group',
        xaxis: {
            title: xaxisTitle,
            tickangle: 30,
            tickvals: xVals,
            ticktext: xTickText,
            categoryorder: 'array',
            categoryarray: categoryOrders[x] || xVals
        },
        yaxis: {
            title: yaxisTitle,
            tickmode: 'array',
            tickvals: [0, 1, 2, 3, 4, 5],
            ticktext: ["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"]
        },
        margin: { r: 180 },
        legend: legendOrder ? { traceorder: 'normal' } : undefined
    };
    // Remove any traces with falsy names or named 'trace' (should not appear in legend or plot)
    const filteredTraces = traces.filter(t => t.name && t.name.toLowerCase() !== 'trace');
    if (filteredTraces.length === 0) return; // Don't plot if nothing valid
    Plotly.newPlot(containerId, filteredTraces, layout, {responsive: true});
}

/**
 * Draws a line chart using Plotly.js
 * @param {Object} meanScoresDict - { group: { feature: mean, ... }, ... }
 * @param {Array<string>} featureOrder - Order of features for x-axis
 * @param {Object} legendColors - { group: color, ... }
 * @param {Array<string>} legendOrder - Order of groups in legend
 * @param {Object} options - { title, legendTitle, markerSymbols }
 * @param {string} containerId - DOM element id to render the plot
 */
function makeLineChart(meanScoresDict, featureOrder, legendColors, legendOrder, options, containerId) {
    // Defensive: ensure options is always an object
    options = options || {};
    const title = options.title || '';
    const legendTitle = options.legendTitle || '';
    const safeMarkerSymbols = (typeof options.markerSymbols === 'object' && options.markerSymbols !== null) ? options.markerSymbols : {};
    const forceAIStyle = options.forceAIStyle || false;
    const forceFilledCircle = options.forceFilledCircle || false;
    const sharedLayout = options.sharedLayout || null;
    const traces = legendOrder.map(group => {
        // Always use the full featureOrder for x, and set y to null for missing values or NaN
        const groupData = meanScoresDict.hasOwnProperty(group) ? meanScoresDict[group] : {};
        const xVals = featureOrder;
        const yVals = featureOrder.map(f => {
            const v = groupData && groupData.hasOwnProperty(f) ? groupData[f] : null;
            // Ignore NaN, undefined, or null
            return (v !== null && v !== undefined && !Number.isNaN(v)) ? v : null;
        });
        let marker;
        if (forceAIStyle || (typeof group === 'string' && group.toLowerCase().includes('ai'))) {
            marker = {
                size: 10,
                symbol: safeMarkerSymbols[group] || 'circle',
                color: '#fff',
                line: { color: legendColors[group] || '#222', width: 3 }
            };
        } else {
            marker = {
                size: 10,
                symbol: safeMarkerSymbols[group] || 'circle',
                opacity: 1
            };
            if (legendColors[group]) {
                marker.color = (typeof legendColors[group] === 'string') ? legendColors[group].trim() : legendColors[group];
            }
        }
        return {
            x: xVals,
            y: yVals,
            name: group, // Always use plain group name
            mode: 'lines+markers',
            line: { color: legendColors[group] || undefined, width: 2 },
            marker: marker,
            connectgaps: true // Connect gaps, but NaNs/nulls are still not plotted
        };
    });
    // Remove any traces with falsy names or named 'trace' (should not appear in legend or plot)
    const filteredTraces = traces.filter(t => t.name && t.name.toLowerCase() !== 'trace');
    // Plot all traces, even if all y are null (so legend is consistent)
    if (filteredTraces.length === 0) return; // Don't plot if nothing valid
    let layout;
    if (sharedLayout) {
        layout = Object.assign({}, sharedLayout, { title, legend: { title: { text: legendTitle } } });
    } else {
        const xTickText = featureOrder.map(val => FEATURE_LABELS[val] || val);
        layout = {
            title,
            xaxis: {
                title: 'Type of Alteration',
                tickangle: 30,
                tickvals: featureOrder,
                ticktext: xTickText
            },
            yaxis: {
                title: 'Acceptability',
                tickmode: 'array',
                tickvals: [0, 1, 2, 3, 4, 5],
                ticktext: ["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                range: [-0.5, 5.5]
            },
            legend: { title: { text: legendTitle } },
            height: 500,
            margin: { r: 180 }
        };
    }
    // If you want to display (N) in the legend, you can customize legend labels here using Plotly's legendgroup or custom hover/legend formatting.
    // But trace.name should always be plain group name.
    Plotly.newPlot(containerId, filteredTraces, layout, {responsive: true});
}

// Human-readable feature name mapping (should match Python FEATURE_LABELS)
const FEATURE_LABELS = {
    "CamPos": "Camera Position",
    "Smoothing": "Smoothing",
    "Lighting": "Lighting",
    "Color": "Color Remapping",
    "Errors": "Removing Errors",
    "Details": "Enhancing Details",
    "Textures": "Adding Textures",
    "BgImage": "Background Image",
    "Blur": "Camera Focus/Blur",
    "BgItems": "Background Items",
    "Gaps": "Filling in Gaps",
    "Position": "Changing Positions",
    "FeatureOmission": "Feature Omission",
    "FeatureAddition": "Feature Addition",
    "Shape": "Changing Shape"
};

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.makeBoxPlot = makeBoxPlot;
    window.makeLineChart = makeLineChart;
    window.FEATURE_LABELS = FEATURE_LABELS;
}
