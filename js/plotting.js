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
    // All group/legend/label/color logic is handled in app.js/data cleaning
    const {
        title = '',
        colorMap = {},
        categoryOrders = {},
        xaxisTitle = '',
        yaxisTitle = '',
        legendOrder = null,
        legendLabelsWithCounts = null
    } = options || {};

    const traces = window.buildTracesFromGroups(data, color, x, y, {
        colorMap,
        traceType: 'box',
        traceNameMap: legendLabelsWithCounts || {}
    });
    const xVals = [...new Set(data.map(row => row[x]))];
    const { tickvals: xTickVals, ticktext: xTickText } = window.getAxisTicks(xVals, FEATURE_LABELS);
    const { tickvals: yTickVals, ticktext: yTickText } = window.getLikertYAxisTicks();
    const layout = {
        title,
        boxmode: 'group',
        xaxis: {
            title: xaxisTitle,
            tickangle: 30,
            tickvals: xTickVals,
            ticktext: xTickText,
            categoryorder: 'array',
            categoryarray: categoryOrders[x] || xVals
        },
        yaxis: {
            title: yaxisTitle,
            tickmode: 'array',
            tickvals: yTickVals,
            ticktext: yTickText
        },
        margin: { r: 180 },
        legend: legendOrder ? { traceorder: 'normal' } : undefined
    };
    const filteredTraces = window.filterValidTraces(traces);
    if (filteredTraces.length === 0) return;
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
    // All group/legend/label/color logic is handled in app.js/data cleaning
    options = options || {};
    const title = options.title || '';
    const legendTitle = options.legendTitle || '';
    const safeMarkerSymbols = (typeof options.markerSymbols === 'object' && options.markerSymbols !== null) ? options.markerSymbols : {};
    const forceAIStyle = options.forceAIStyle || false;
    const forceFilledCircle = options.forceFilledCircle || false;
    const sharedLayout = options.sharedLayout || null;
    const traces = legendOrder.map(group => {
        const groupData = meanScoresDict.hasOwnProperty(group) ? meanScoresDict[group] : {};
        const xVals = featureOrder;
        const yVals = featureOrder.map(f => {
            const v = groupData && groupData.hasOwnProperty(f) ? groupData[f] : null;
            return (v !== null && v !== undefined && !Number.isNaN(v)) ? v : null;
        });
        let marker;
        if (
            forceAIStyle ||
            (typeof group === 'string' && group.toLowerCase().includes('ai') && !group.toLowerCase().includes('daily'))
        ) {
            // AI: outlined marker with white fill
            marker = {
                size: 10,
                symbol: safeMarkerSymbols[group] || 'circle',
                color: '#fff',
                line: { color: legendColors[group] || '#222', width: 3 }
            };
        } else if (safeMarkerSymbols[group]) {
            // Human: use group color as fill
            marker = {
                size: 10,
                symbol: safeMarkerSymbols[group],
                color: legendColors[group] || undefined,
                opacity: 1
            };
        } else {
            // Human default: filled circle with group color
            marker = {
                size: 10,
                symbol: 'circle',
                color: legendColors[group] || '#222',
                opacity: 1
            };
        }
        return {
            x: xVals,
            y: yVals,
            name: group,
            mode: 'lines+markers',
            line: { color: legendColors[group] || undefined, width: 2 },
            marker: marker,
            connectgaps: true
        };
    });
    const filteredTraces = window.filterValidTraces(traces);
    if (filteredTraces.length === 0) return;
    let layout;
    if (sharedLayout) {
        layout = Object.assign({}, sharedLayout, { title, legend: { title: { text: legendTitle } } });
    } else {
        const { tickvals: xTickVals, ticktext: xTickText } = window.getAxisTicks(featureOrder, FEATURE_LABELS);
        const { tickvals: yTickVals, ticktext: yTickText } = window.getLikertYAxisTicks();
        layout = {
            title,
            xaxis: {
                title: 'Type of Alteration',
                tickangle: 30,
                tickvals: xTickVals,
                ticktext: xTickText
            },
            yaxis: {
                title: 'Acceptability',
                tickmode: 'array',
                tickvals: yTickVals,
                ticktext: yTickText,
                range: [-0.5, 5.5]
            },
            legend: { title: { text: legendTitle } },
            height: 500,
            margin: { r: 180 }
        };
    }
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
