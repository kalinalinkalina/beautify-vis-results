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
        traceNameMap = null
    } = options || {};

    const traces = window.buildTracesFromGroups(data, color, x, y, {
        colorMap,
        traceType: 'box',
        traceNameMap: traceNameMap || {}
    });
    const xVals = [...new Set(data.map(row => row[x]))];
    const { tickvals: xTickVals, ticktext: xTickText } = window.getAxisTicks(xVals, FEATURE_LABELS);
    const { tickvals: yTickVals, ticktext: yTickText } = window.getLikertYAxisTicks();
    
    // Sort traces according to legendOrder if provided
    let sortedTraces = traces;
    if (legendOrder && legendOrder.length > 0) {
        sortedTraces = [];
        legendOrder.forEach(traceNameToFind => {
            const traceIndex = traces.findIndex(t => t.name === traceNameToFind);
            if (traceIndex !== -1) {
                sortedTraces.push(traces[traceIndex]);
            }
        });
        // Append any traces not in legendOrder (shouldn't happen but be safe)
        traces.forEach(trace => {
            if (!sortedTraces.includes(trace)) {
                sortedTraces.push(trace);
            }
        });
    }
    
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
        legend: legendOrder ? { 
            traceorder: 'normal'
        } : undefined
    };
    const filteredTraces = window.filterValidTraces(sortedTraces);
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
    // Force squares for scientist groups
    const scientistGroups = [
        'Scientist who creates vis',
        'Scientist who uses vis'
    ];
    // Special group for X marker
    const xMarkerGroups = [
        'Never'
    ];
    const forceAIStyle = options.forceAIStyle || false;
    const sharedLayout = options.sharedLayout || null;
    // Accept traceNameMap for legend labels with counts
    const traceNameMap = options.traceNameMap || {};
    // Accept groupOrder (short names for data lookup) separate from legendOrder (display names)
    const groupOrder = options.groupOrder || legendOrder;
    
    // Filter out nan/null/empty group names from groupOrder
    const validGroupOrder = groupOrder.filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
    const traces = validGroupOrder.map(group => {
        const groupData = meanScoresDict.hasOwnProperty(group) ? meanScoresDict[group] : {};
        const xVals = featureOrder;
        const yVals = featureOrder.map(f => {
            const v = groupData && groupData.hasOwnProperty(f) ? groupData[f] : null;
            return (v !== null && v !== undefined && !Number.isNaN(v)) ? v : null;
        });
        let markerSymbol = safeMarkerSymbols[group] || 'circle';
        // Force squares for scientist groups
        if (scientistGroups.includes(group)) {
            markerSymbol = 'square';
        }
        // Force X for Never group
        if (xMarkerGroups.includes(group)) {
            markerSymbol = 'x';
        }
        let marker;
        if (
            forceAIStyle ||
            (typeof group === 'string' && group.toLowerCase().includes('ai') && !group.toLowerCase().includes('daily'))
        ) {
            // AI: outlined marker with white fill
            marker = {
                size: 10,
                symbol: markerSymbol,
                color: '#fff',
                line: { color: legendColors[group] || '#222', width: 3 }
            };
        } else {
            // Human: filled marker with group color
            marker = {
                size: 10,
                symbol: markerSymbol,
                color: legendColors[group] || '#222',
                opacity: 1
            };
        }
        return {
            x: xVals,
            y: yVals,
            name: traceNameMap[group] || group,
            mode: 'lines+markers',
            line: { color: legendColors[group] || undefined, width: 2 },
            marker: marker,
            connectgaps: true
        };
    });
    const filteredTraces = window.filterValidTraces(traces);
    if (filteredTraces.length === 0) return;
    
    // Build the legend category array from actual trace names (which may have counts)
    const legendCategoryArray = filteredTraces.map(trace => trace.name);
    
    let layout;
    if (sharedLayout) {
        layout = Object.assign({}, sharedLayout, { 
            title,
            legend: Object.assign({}, sharedLayout.legend || {}, {
                orientation: 'v',
                x: 1,
                xanchor: 'left',
                y: 1,
                yanchor: 'top'
            })
        });
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
            legend: {
                orientation: 'v',
                x: 1,
                xanchor: 'left',
                y: 1,
                yanchor: 'top'
            },
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
