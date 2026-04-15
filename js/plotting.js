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
 * Draws a line chart using Plotly.js with optional confidence bands
 * @param {Object} meanScoresDict - { group: { feature: mean, ... }, ... }
 * @param {Array<string>} featureOrder - Order of features for x-axis
 * @param {Object} legendColors - { group: color, ... }
 * @param {Array<string>} legendOrder - Order of groups in legend
 * @param {Object} options - { title, legendTitle, markerSymbols, stdDevDict }
 * @param {string} containerId - DOM element id to render the plot
 */
function makeLineChart(meanScoresDict, featureOrder, legendColors, legendOrder, options, containerId) {
    // All group/legend/label/color logic is handled in app.js/data cleaning
    options = options || {};
    const title = options.title || '';
    const legendTitle = options.legendTitle || '';
    const safeMarkerSymbols = (typeof options.markerSymbols === 'object' && options.markerSymbols !== null) ? options.markerSymbols : {};
    const stdDevDict = options.stdDevDict || null; // { group: { feature: stdDev, ... }, ... }
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
    
    function colorToRgba(color, alpha) {
        if (!color) {
            return `rgba(153, 153, 153, ${alpha})`;
        }
        // If it's already an rgba from hexToRgba, return as is (already has alpha)
        if (color.startsWith('rgba')) {
            return color;
        }
        try {
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.fillStyle = color;
            const computed = ctx.fillStyle;
            if (computed.startsWith('#')) {
                return hexToRgba(computed, alpha);
            }
            if (computed.startsWith('rgb')) {
                const rgba = computed.replace(/rgba?\(([^)]+)\)/, `rgba($1, ${alpha})`);
                return rgba;
            }
        } catch (err) {
            // Fallback to default gray if parsing fails
        }
        return `rgba(153, 153, 153, ${alpha})`;
    }
    
    // Filter out nan/null/empty group names from groupOrder
    const validGroupOrder = groupOrder.filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
     const lineTraces = [];
     const bandTraces = [];
    
    validGroupOrder.forEach(group => {
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
        
        // Add confidence band as a filled area
        if (stdDevDict && stdDevDict[group]) {
            const groupStdDev = stdDevDict[group];
            const upperVals = featureOrder.map((f, idx) => {
                const mean = yVals[idx];
                const std = groupStdDev && groupStdDev.hasOwnProperty(f) ? groupStdDev[f] : null;
                if (mean !== null && std !== null && !Number.isNaN(std)) {
                    return mean + std;
                }
                return null;
            });
            const lowerVals = featureOrder.map((f, idx) => {
                const mean = yVals[idx];
                const std = groupStdDev && groupStdDev.hasOwnProperty(f) ? groupStdDev[f] : null;
                if (mean !== null && std !== null && !Number.isNaN(std)) {
                    return mean - std;
                }
                return null;
            });

            // Use the same X values as the line chart to ensure perfect alignment for 'tonexty'
            const bandX = featureOrder;
            const bandUpper = featureOrder.map((_, idx) => upperVals[idx] !== null ? upperVals[idx] : null);
            const bandLower = featureOrder.map((_, idx) => lowerVals[idx] !== null ? lowerVals[idx] : null);

            const lowerTrace = {
                type: 'scatter',
                x: bandX,
                y: bandLower,
                mode: 'lines',
                line: { color: 'rgba(0,0,0,0.1)', width: 0.5 }, // Faint line instead of transparent
                showlegend: false,
                hoverinfo: 'none',
                connectgaps: true,
                legendgroup: group // Link visibility to the group
            };
            const upperTrace = {
                type: 'scatter',
                x: bandX,
                y: bandUpper,
                fill: 'tonexty',
                fillcolor: colorToRgba(legendColors[group] || '#999', 0.10), // Set opacity to 10%
                line: { color: 'rgba(0,0,0,0.1)', width: 0.5 },
                mode: 'lines',
                showlegend: false,
                hoverinfo: 'none',
                connectgaps: true,
                legendgroup: group // Link visibility to the group
            };
            bandTraces.push(lowerTrace, upperTrace);
        }
        
        const lineTrace = {
            x: xVals,
            y: yVals,
            name: traceNameMap[group] || group,
            mode: 'lines+markers',
            line: { color: legendColors[group] || undefined, width: 2 },
            marker: marker,
            connectgaps: true,
            legendgroup: group // Link visibility to the group
        };
        lineTraces.push(lineTrace);
    });

    const traces = [...bandTraces, ...lineTraces];
    if (bandTraces.length > 0) {
        console.log(`makeLineChart: created ${bandTraces.length / 2} band traces`);
    } else {
        console.log('makeLineChart: no band traces created');
    }
    
    // Temporarily bypass filterValidTraces to ensure all traces are passed to Plotly
    const filteredTraces = traces; // Bypass filtering
    console.log('makeLineChart: bypassed filtering, all traces passed to Plotly', filteredTraces);

    if (filteredTraces.length === 0) {
        console.error('makeLineChart: No valid traces to plot. Check data and filtering logic.');
        return;
    }
    
    // Build the legend category array from actual trace names (which may have counts)
    const legendCategoryArray = filteredTraces.filter(trace => trace.showlegend !== false).map(trace => trace.name);
    
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
        const xTickVals = featureOrder;
        const xTickText = featureOrder.map(f => FEATURE_LABELS[f] || f);
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

/**
 * Draws a slope chart using Plotly.js
 * Shows Human vs AI comparisons with connecting lines and separate markers
 * For grouped comparisons (role, experience, etc.), shows separate slopes for each group
 * @param {Object} meanScoresDict - { group: { feature: mean, ... }, ... } for both human and AI
 * @param {Object} meanScoresDictAI - AI means (same structure)
 * @param {Array<string>} featureOrder - Order of features for x-axis
 * @param {Object} legendColors - { group: color, ... }
 * @param {Array<string>} legendOrder - Order of groups in legend
 * @param {Object} options - { title, legendTitle, markerSymbols, isGrouped, traceNameMap }
 * @param {string} containerId - DOM element id to render the plot
 */
function makeSlopeChart(meanScoresDict, meanScoresDictAI, featureOrder, legendColors, legendOrder, options, containerId) {
    options = options || {};
    const title = options.title || '';
    const safeMarkerSymbols = (typeof options.markerSymbols === 'object' && options.markerSymbols !== null) ? options.markerSymbols : {};
    const isGrouped = options.isGrouped || false;
    const groupOrder = options.groupOrder || legendOrder;
    const traceNameMap = options.traceNameMap || {};
    const pairedData = options.pairedData || []; // Individual responses
    
    // Force squares for scientist groups
    const scientistGroups = [
        'Scientist who creates vis',
        'Scientist who uses vis'
    ];
    // Special group for X marker
    const xMarkerGroups = [
        'Never'
    ];
    
    const traces = [];
    
    // 1. Draw individual response lines (ONLY for non-grouped Human vs AI)
    if (!isGrouped && pairedData.length > 0) {
        pairedData.forEach(pair => {
            featureOrder.forEach((feature, featureIdx) => {
                const hVal = pair.human[feature];
                const aVal = pair.ai[feature];
                if (hVal !== undefined && aVal !== undefined) {
                    const humanX = featureIdx - 0.1;
                    const aiX = featureIdx + 0.1;
                    traces.push({
                        x: [humanX, aiX],
                        y: [hVal, aVal],
                        mode: 'lines',
                        line: { color: 'rgba(200, 200, 200, 0.3)', width: 1 },
                        showlegend: false,
                        hoverinfo: 'skip'
                    });
                }
            });
        });
    }

    const featureXPositions = {}; // Map feature to x-axis position
    
    // 2. Draw mean slopes (connected markers)
    featureOrder.forEach((feature, featureIdx) => {
        const featureX = featureIdx;
        featureXPositions[feature] = featureX;
        
        if (isGrouped) {
            // For grouped comparisons: create separate slopes for each group
            const validGroupOrder = groupOrder.filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
            
            validGroupOrder.forEach((group, groupIdx) => {
                const humanMean = meanScoresDict[group] && meanScoresDict[group][feature] ? meanScoresDict[group][feature] : null;
                const aiMean = meanScoresDictAI[group] && meanScoresDictAI[group][feature] ? meanScoresDictAI[group][feature] : null;
                
                if (humanMean === null || aiMean === null) return;
                
                // Add connecting line
                traces.push({
                    x: [featureX - 0.1, featureX + 0.1],
                    y: [humanMean, aiMean],
                    mode: 'lines',
                    line: { color: legendColors[group] || 'peru', width: 2 }, // Use human color or default to 'peru'
                    showlegend: false,
                    hoverinfo: 'skip',
                    legendgroup: group // Link visibility to the group
                });

                // Add human marker (filled)
                let markerSymbol = safeMarkerSymbols[group] || 'circle';
                if (scientistGroups.includes(group)) {
                    markerSymbol = 'square';
                }
                if (xMarkerGroups.includes(group)) {
                    markerSymbol = 'x';
                }

                traces.push({
                    x: [featureX - 0.1],
                    y: [humanMean],
                    mode: 'markers',
                    marker: {
                        size: 12,
                        symbol: markerSymbol,
                        color: legendColors[group] || '#222',
                        opacity: 1
                    },
                    showlegend: featureIdx === 0, // Show legend only for the first feature
                    legendgroup: group, // Group legend entries by group
                    hovertemplate: `<b>${group}</b><br>Human: ${humanMean.toFixed(2)}<extra></extra>`,
                    name: traceNameMap[group] || group
                });

                // Add AI marker (outlined)
                traces.push({
                    x: [featureX + 0.1],
                    y: [aiMean],
                    mode: 'markers',
                    marker: {
                        size: 12,
                        symbol: markerSymbol,
                        color: '#fff',
                        line: { color: legendColors[group] || '#222', width: 3 }
                    },
                    showlegend: false, // Do not show AI markers in the legend
                    legendgroup: group, // Link visibility to the group
                    hovertemplate: `<b>${group}</b><br>AI: ${aiMean.toFixed(2)}<extra></extra>`,
                    name: ''
                });
            });
        } else {
            // For human_ai comparison: single slope per feature
            const humanMean = meanScoresDict['Human'] && meanScoresDict['Human'][feature] ? meanScoresDict['Human'][feature] : null;
            const aiMean = meanScoresDictAI['AI'] && meanScoresDictAI['AI'][feature] ? meanScoresDictAI['AI'][feature] : null;
            
            if (humanMean === null || aiMean === null) return;
            
            // Use fixed offsets so all groups for a given feature share the same start/end x positions
            const humanX = featureX - 0.15;
            const aiX = featureX + 0.15;
            
            // Add connecting line
            traces.push({
                x: [humanX, aiX],
                y: [humanMean, aiMean],
                mode: 'lines',
                line: { color: legendColors['Human'] || 'peru', width: 2 }, // Use human color or default to 'peru'
                showlegend: false,
                hoverinfo: 'skip',
                legendgroup: 'human' // Link visibility to the group
            });
            
            // Add human marker (filled)
            traces.push({
                x: [humanX],
                y: [humanMean],
                mode: 'markers',
                marker: {
                    size: 12,
                    symbol: 'circle',
                    color: legendColors['Human'] || 'peru',
                    opacity: 1
                },
                showlegend: feature === featureOrder[0],
                legendgroup: 'human',
                hovertemplate: `Human: ${humanMean.toFixed(2)}<extra></extra>`,
                name: 'Human'
            });
            
            // Add AI marker (outlined)
            traces.push({
                x: [aiX],
                y: [aiMean],
                mode: 'markers',
                marker: {
                    size: 12,
                    symbol: 'circle',
                    color: '#fff',
                    line: { color: legendColors['AI'] || 'gray', width: 3 }
                },
                showlegend: feature === featureOrder[0],
                legendgroup: 'ai',
                hovertemplate: `AI: ${aiMean.toFixed(2)}<extra></extra>`,
                name: 'AI'
            });
        }
    });
    
    const { tickvals: xTickVals, ticktext: xTickText } = window.getAxisTicks(featureOrder, FEATURE_LABELS);
    const { tickvals: yTickVals, ticktext: yTickText } = window.getLikertYAxisTicks();
    
    const layout = {
        title,
        xaxis: {
            title: 'Type of Alteration',
            type: 'linear',
            tickangle: 30,
            tickvals: featureOrder.map((_, i) => i),
            ticktext: xTickText,
            range: [-0.5, featureOrder.length - 0.5]
        },
        yaxis: {
            title: 'Acceptability',
            tickmode: 'array',
            tickvals: yTickVals,
            ticktext: yTickText,
            range: [-0.5, 5.5],
            scaleanchor: 'x',
            scaleratio: 1
        },
        legend: {
            orientation: 'v',
            x: 1,
            xanchor: 'left',
            y: 1,
            yanchor: 'top'
        },
        height: 500,
        margin: { r: 180 },
        hovermode: 'closest'
    };
    
    Plotly.newPlot(containerId, traces, layout, {responsive: true});
}

/**
 * Draws a scatter-based swarm plot using Plotly.js
 * @param {Array<Object>} data - Data array
 * @param {string} x - X axis field (e.g., 'Feature_Name')
 * @param {string} y - Y axis field (e.g., 'Numerical_Score')
 * @param {string} group - Field for grouping (e.g., 'Type')
 * @param {Object} options - { title, colorMap, categoryOrders, xaxisTitle, yaxisTitle }
 * @param {string} containerId - DOM element id to render the plot
 */
function makeSwarmPlot(data, x, y, group, options, containerId) {
    options = options || {};
    const {
        title = '',
        colorMap = {},
        categoryOrders = {},
        xaxisTitle = '',
        yaxisTitle = '',
        traceNameMap = {},
        jitterAmplitude = 0.54,
        markerSize = 7,
        markerOpacity = 0.65
    } = options;

    const featureOrder = categoryOrders[x] || [...new Set(data.map(row => row[x]))];
    const groupOrder = categoryOrders[group] || [...new Set(data.map(row => row[group]))];

    const validGroupOrder = groupOrder.filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
    let drawOrder = validGroupOrder;
    let legendTraceOrder = 'normal';
    if (group === 'Type' && validGroupOrder.includes('Human') && validGroupOrder.includes('AI')) {
        drawOrder = validGroupOrder.filter(g => g !== 'Human');
        drawOrder.push('Human');
        legendTraceOrder = 'reversed';
    }
    const traces = [];

    drawOrder.forEach((groupName, index) => {
        const groupData = data.filter(row => row[group] === groupName);
        if (!groupData.length) return;

        const xVals = groupData.map(row => {
            const idx = featureOrder.indexOf(row[x]);
            const jitter = (Math.random() - 0.5) * jitterAmplitude;
            return idx + jitter;
        });
        const yVals = groupData.map(row => {
            const jitterY = (Math.random() - 0.5) * jitterAmplitude;
            return row[y] + jitterY;
        });
        const textLabels = groupData.map(row => FEATURE_LABELS[row[x]] || row[x]);
        const traceName = traceNameMap[groupName] || groupName;

        traces.push({
            x: xVals,
            y: yVals,
            mode: 'markers',
            type: 'scatter',
            name: traceName,
            marker: {
                size: markerSize,
                color: colorMap[groupName] || undefined,
                opacity: markerOpacity,
                line: { width: 1, color: '#333' }
            },
            text: textLabels,
            hovertemplate: `<b>${traceName}</b><br>%{text}<br>Acceptability: %{y}<extra></extra>`,
            legendgroup: traceName,
            showlegend: true
        });
    });

    const xTickText = featureOrder.map(f => FEATURE_LABELS[f] || f);
    const { tickvals: yTickVals, ticktext: yTickText } = window.getLikertYAxisTicks();
    const layout = {
        title,
        xaxis: {
            title: xaxisTitle,
            type: 'linear',
            tickmode: 'array',
            tickvals: featureOrder.map((_, i) => i),
            ticktext: xTickText,
            tickangle: 30,
            range: [-0.5, featureOrder.length - 0.5]
        },
        yaxis: {
            title: yaxisTitle,
            tickmode: 'array',
            tickvals: yTickVals,
            ticktext: yTickText,
            range: [-0.5, 5.5],
            scaleanchor: 'x',
            scaleratio: 1
        },
        legend: {
            orientation: 'v',
            x: 1,
            xanchor: 'left',
            y: 1,
            yanchor: 'top',
            traceorder: legendTraceOrder
        },
        margin: { r: 180 },
        hovermode: 'closest'
    };
    Plotly.newPlot(containerId, traces, layout, { responsive: true });
}

// Human-readable feature name mapping (should match Python FEATURE_LABELS)
// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha) {
    // Remove '#' if present
    hex = hex.replace('#', '');
    // Parse hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
    window.makeSlopeChart = makeSlopeChart;
    window.makeSwarmPlot = makeSwarmPlot;
    window.FEATURE_LABELS = FEATURE_LABELS;
}
