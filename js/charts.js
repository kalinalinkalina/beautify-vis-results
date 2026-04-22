// Chart builder functions for Plotly visualizations

function isScientistGroup(group) {
    if (typeof group !== 'string') return false;
    const normalized = group.trim().toLowerCase();
    return [
        'scientist who creates vis',
        'scientist who uses vis',
        'i create visualizations to help me in my primary role, which is not visualization-related',
        'i work with visualizations created by others, but i do not create or research visualization myself'
    ].includes(normalized);
}

function resolvePlotContainer(container) {
    const plotContainer = typeof container === 'string' ? document.getElementById(container) : container;
    if (!plotContainer || typeof plotContainer.getAttribute !== 'function') {
        return null;
    }
    return plotContainer;
}

function orderTracesByLegend(traces, legendOrder) {
    if (!Array.isArray(legendOrder) || legendOrder.length === 0) return traces;
    const fallback = [];
    const ordered = [];

    traces.forEach(trace => {
        if (trace.name && legendOrder.includes(trace.name)) return;
        fallback.push(trace);
    });

    legendOrder.forEach(name => {
        traces.filter(t => t.name === name).forEach(trace => ordered.push(trace));
    });

    return [...fallback, ...ordered];
}

function getPlotlyLegendConfig(legendOptions = {}) {
    return Object.assign({
        orientation: 'v',
        x: 1,
        xanchor: 'left',
        y: 1,
        yanchor: 'top'
    }, legendOptions);
}

function getFeatureLabel(feature) {
    return (window.FEATURE_LABELS && window.FEATURE_LABELS[feature]) || feature;
}

function getMarkerSymbol(group) {
    if (isScientistGroup(group)) return 'square';
    if (typeof group === 'string' && group.trim().toLowerCase() === 'never') return 'x';
    return 'circle';
}

function getResponseMetricLabel(scaleKey = 'acceptability', prefix = '') {
    const scale = (window.getResponseScale && window.getResponseScale(scaleKey)) || {};
    const baseLabel = scale.title || 'Value';
    return prefix ? `${prefix} ${baseLabel}` : baseLabel;
}

function buildYAxisConfig(title, yTickVals, yTickText, anchorToX = false) {
    const config = {
        title,
        tickmode: 'array',
        tickvals: yTickVals,
        ticktext: yTickText,
        range: [-0.5, 5.5]
    };
    if (anchorToX) {
        config.scaleanchor = 'x';
        config.scaleratio = 1;
    }
    return config;
}

function buildXAxisConfig(title, tickvals, ticktext, tickangle = 30, type = 'linear', range = null) {
    const config = {
        title,
        type,
        tickmode: 'array',
        tickvals,
        ticktext,
        tickangle
    };
    if (range) {
        config.range = range;
    }
    return config;
}

function getDefaultStackColors(count) {
    if (count === 5) {
        return ['#b2182b', '#ef8a62', '#fddbc7', '#a6dba0', '#1b7837'];
    }
    if (count === 6) {
        return ['#b2182b', '#d6604d', '#f4a582', '#d9f0d3', '#7fbf7b', '#1b7837'];
    }
    const fallback = ['#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#d9f0d3', '#7fbf7b', '#1b7837'];
    return Array.from({ length: count }, (_, index) => fallback[index % fallback.length]);
}

function getResponseCategories(responseScale = 'acceptability') {
    const scale = window.getResponseScale(responseScale);
    const values = Array.isArray(scale.tickvals) ? scale.tickvals : [];
    const labels = Array.isArray(scale.ticktext) ? scale.ticktext : values.map(value => String(value));
    const colors = Array.isArray(scale.colors) && scale.colors.length === values.length
        ? scale.colors
        : getDefaultStackColors(values.length);

    return values.map((value, index) => ({
        value,
        label: labels[index] || String(value),
        color: colors[index]
    }));
}

function abbreviateTopAxisLabel(label) {
    if (typeof label !== 'string') return label;

    const normalized = label.trim();
    const exactMap = {
        'Scientist who creates vis': 'Creates vis',
        'Scientist who uses vis': 'Uses vis',
        'Viz Practitioner': 'Viz pract.',
        'Vis Researcher': 'Vis research',
        'Less than 1 year': '<1 year',
        '1-3 years': '1-3 yrs',
        '3-5 years': '3-5 yrs',
        '5-10 years': '5-10 yrs',
        '10-20 years': '10-20 yrs',
        'More than 20 years': '20+ yrs',
        'Less than once a year': '<1/yr',
        'This is a primary part of my work': 'Primary work',
        'Would use an AI tool for beautification': 'AI tool use'
    };

    if (exactMap[normalized]) {
        return exactMap[normalized];
    }

    if (normalized.length <= 16) {
        return normalized;
    }

    return `${normalized.slice(0, 13).trim()}...`;
}

function makeBoxPlot(data, x, y, color, options, containerId) {
    const {
        title = '',
        colorMap = {},
        categoryOrders = {},
        xaxisTitle = '',
        yaxisTitle = '',
        xTickAngle = 30,
        responseScale = 'acceptability',
        legendTitle = '',
        legendOrder = null,
        traceNameMap = null,
        hoverNameMap = {},
        hoverLabel = legendTitle || 'Group',
        showLegend = true
    } = options || {};

    const traces = window.buildTracesFromGroups(data, color, x, y, {
        colorMap,
        traceType: 'box',
        traceNameMap: traceNameMap || {},
        hoverNameMap,
        hoverLabel,
        responseScale,
        showLegend
    });
    const hoverTraces = window.buildBoxHoverTraces ? window.buildBoxHoverTraces(data, color, x, y, {
        traceNameMap: traceNameMap || {},
        hoverNameMap,
        hoverLabel,
        responseScale
    }) : [];
    const xVals = [...new Set(data.map(row => row[x]))];
    const { tickvals: xTickVals, ticktext: xTickText } = window.getAxisTicks(xVals, window.FEATURE_LABELS || {});
    const { tickvals: yTickVals, ticktext: yTickText, range: yRange, title: defaultYTitle } = window.getLikertYAxisTicks(responseScale);

    let sortedTraces = traces;
    if (legendOrder && legendOrder.length > 0) {
        sortedTraces = [];
        legendOrder.forEach(traceNameToFind => {
            const traceIndex = traces.findIndex(t => t.name === traceNameToFind);
            if (traceIndex !== -1) {
                sortedTraces.push(traces[traceIndex]);
            }
        });
        traces.forEach(trace => {
            if (!sortedTraces.includes(trace)) {
                sortedTraces.push(trace);
            }
        });
    }

    const layout = buildDefaultPlotLayout({
        title,
        xaxis: {
            title: xaxisTitle,
            tickangle: xTickAngle,
            tickvals: xTickVals,
            ticktext: xTickText,
            categoryorder: 'array',
            categoryarray: categoryOrders[x] || xVals
        },
        yaxis: {
            title: yaxisTitle || defaultYTitle,
            tickmode: 'array',
            tickvals: yTickVals,
            ticktext: yTickText,
            range: yRange
        },
        legendOptions: Object.assign(
            {},
            legendOrder ? { traceorder: 'normal' } : {},
            legendTitle ? { title: { text: legendTitle } } : {}
        ),
        showLegend,
        margin: { r: 180 }
    });
    layout.boxmode = 'group';
    layout.boxgap = 0.3;
    layout.boxgroupgap = 0.2;

    const filteredTraces = window.filterValidTraces([...sortedTraces, ...hoverTraces]);
    if (filteredTraces.length === 0) return;
    const plotContainer = resolvePlotContainer(containerId);
    if (!plotContainer) return;
    Plotly.newPlot(plotContainer, filteredTraces, layout, { responsive: true });
}

function makeStackedBarChart(data, x, score, group, options, containerId) {
    options = options || {};
    const {
        title = '',
        categoryOrders = {},
        xaxisTitle = '',
        yaxisTitle = '',
        responseScale = 'acceptability',
        traceNameMap = {},
        groupLabelMap = {},
        groupHoverLabel = 'Group',
        xTickAngle = 30,
        showLegend = true
    } = options;

    const rawFeatureOrder = categoryOrders[x] || [...new Set(data.map(row => row[x]))];
    const featureOrder = Array.isArray(rawFeatureOrder)
        ? rawFeatureOrder
        : (rawFeatureOrder && typeof rawFeatureOrder === 'object' ? Object.values(rawFeatureOrder) : [rawFeatureOrder]);
    const rawGroupOrder = categoryOrders[group] || [...new Set(data.map(row => row[group]))];
    const groupOrder = (Array.isArray(rawGroupOrder)
        ? rawGroupOrder
        : (rawGroupOrder && typeof rawGroupOrder === 'object' ? Object.values(rawGroupOrder) : [rawGroupOrder]))
        .filter(groupName => groupName !== undefined && groupName !== null && String(groupName).trim().toLowerCase() !== 'nan' && String(groupName).trim() !== '');
    const scale = window.getResponseScale(responseScale);

    const categories = getResponseCategories(responseScale);
    if (featureOrder.length === 0 || groupOrder.length === 0 || categories.length === 0) return;

    const scoreLookup = new Map(categories.map(category => [category.value, category]));
    const distributions = {};

    featureOrder.forEach(feature => {
        distributions[feature] = {};
        groupOrder.forEach(groupName => {
            const counts = {};
            categories.forEach(category => {
                counts[category.value] = 0;
            });
            distributions[feature][groupName] = { counts, total: 0 };
        });
    });

    data.forEach(row => {
        const feature = row[x];
        const groupName = row[group];
        const responseCategory = scoreLookup.get(row[score]);
        if (!distributions[feature] || !distributions[feature][groupName] || !responseCategory) return;
        distributions[feature][groupName].counts[responseCategory.value] += 1;
        distributions[feature][groupName].total += 1;
    });

    const xPositions = [];
    const groupLabels = [];
    const bottomTickVals = [];
    const bottomTickText = [];
    const intraGroupStep = 0.82;
    const interFeatureGap = 1.15;

    featureOrder.forEach((feature, featureIndex) => {
        const featureStart = featureIndex * ((groupOrder.length - 1) * intraGroupStep + interFeatureGap);
        const featureCenter = featureStart + (((groupOrder.length - 1) * intraGroupStep) / 2);
        bottomTickVals.push(featureCenter);
        bottomTickText.push(getFeatureLabel(feature));
        groupOrder.forEach((groupName, groupIndex) => {
            xPositions.push(featureStart + (groupIndex * intraGroupStep));
            groupLabels.push(groupLabelMap[groupName] || groupName);
        });
    });
    const xMin = xPositions.length ? xPositions[0] - 0.5 : -0.5;
    const xMax = xPositions.length ? xPositions[xPositions.length - 1] + 0.5 : 0.5;

    const traces = categories.map(category => {
        const yVals = [];
        const customdata = [];
        const includeGroupLine = groupOrder.length > 1;

        featureOrder.forEach(feature => {
            groupOrder.forEach(groupName => {
                const entry = distributions[feature][groupName];
                const count = entry.counts[category.value] || 0;
                const total = entry.total || 0;
                const percent = total > 0 ? (count / total) * 100 : 0;

                yVals.push(percent);
                customdata.push([
                    getFeatureLabel(feature),
                    groupLabelMap[groupName] || groupName,
                    category.label,
                    count,
                    total
                ]);
            });
        });

        return {
            type: 'bar',
            x: xPositions,
            y: yVals,
            name: category.label,
            marker: {
                color: category.color,
                line: { color: '#ffffff', width: 0.6 }
            },
            customdata,
            hovertemplate: includeGroupLine
                ? `<b>%{customdata[0]}</b><br>${groupHoverLabel}: %{customdata[1]}<br>${scale.title || 'Response'}: %{customdata[2]}<br>Share: %{y:.1f}%<br>Responses: %{customdata[3]} of %{customdata[4]}<extra></extra>`
                : `<b>%{customdata[0]}</b><br>${scale.title || 'Response'}: %{customdata[2]}<br>Share: %{y:.1f}%<br>Responses: %{customdata[3]} of %{customdata[4]}<extra></extra>`,
            showlegend: showLegend
        };
    });

    const showTopAxis = groupOrder.length > 1;
    const compactGroupLabels = groupLabels.map(label => abbreviateTopAxisLabel(label));
    const topLabelFontSize = xPositions.length >= 36 ? 9 : (xPositions.length >= 24 ? 10 : 11);
    const topAxisAnnotations = showTopAxis
        ? xPositions.map((position, index) => ({
            x: position,
            y: 1.012,
            xref: 'x',
            yref: 'paper',
            text: compactGroupLabels[index],
            textangle: -xTickAngle,
            showarrow: false,
            xanchor: 'left',
            yanchor: 'bottom',
            align: 'left',
            font: { size: topLabelFontSize, color: '#444' }
        }))
        : [];
    const layout = buildDefaultPlotLayout({
        title,
        xaxis: buildXAxisConfig(
            xaxisTitle,
            bottomTickVals,
            bottomTickText,
            xTickAngle,
            'linear',
            [xMin, xMax]
        ),
        yaxis: {
            title: yaxisTitle || 'Responses (%)',
            range: [0, 100],
            ticksuffix: '%',
            automargin: true
        },
        legendOptions: { title: { text: scale.title || 'Response' }, traceorder: 'reversed' },
        showLegend,
        margin: { r: 180, t: showTopAxis ? 122 : 80, b: 120 },
        hovermode: 'x unified'
    });
    layout.barmode = 'stack';
    layout.bargap = 0.22;
    layout.bargroupgap = 0.08;
    layout.xaxis.automargin = true;
    layout.annotations = topAxisAnnotations;
    layout.title = {
        text: title,
        x: 0.5,
        xanchor: 'center',
        y: showTopAxis ? 0.985 : 0.97,
        yanchor: 'top'
    };

    const filteredTraces = window.filterValidTraces(traces);
    if (filteredTraces.length === 0) return;
    const plotContainer = resolvePlotContainer(containerId);
    if (!plotContainer) return;
    Plotly.newPlot(plotContainer, filteredTraces, layout, { responsive: true });
}

function makeLineChart(meanScoresDict, featureOrder, legendColors, legendOrder, options, containerId) {
    options = options || {};
    const title = options.title || '';
    const legendTitle = options.legendTitle || '';
    const showLegend = options.showLegend !== false;
    const safeMarkerSymbols = (typeof options.markerSymbols === 'object' && options.markerSymbols !== null) ? options.markerSymbols : {};
    const stdDevDict = options.stdDevDict || null;
    const forceAIStyle = options.forceAIStyle || false;
    const sharedLayout = options.sharedLayout || null;
    const traceNameMap = options.traceNameMap || {};
    const hoverNameMap = options.hoverNameMap || {};
    const hoverLabel = options.hoverLabel || legendTitle || 'Group';
    const groupOrder = options.groupOrder || legendOrder;
    const xaxisTitle = options.xaxisTitle || 'Type of Alteration';
    const yaxisTitle = options.yaxisTitle || '';
    const xTickAngle = options.xTickAngle ?? 30;
    const responseScale = options.responseScale || 'acceptability';
    const meanLabel = getResponseMetricLabel(responseScale, 'Mean');
    featureOrder = Array.isArray(featureOrder) ? featureOrder : (featureOrder && typeof featureOrder === 'object' ? Object.values(featureOrder) : [featureOrder]);
    function colorToRgba(color, alpha) {
        if (!color) {
            return `rgba(153, 153, 153, ${alpha})`;
        }
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
        }
        return `rgba(153, 153, 153, ${alpha})`;
    }

    const safeGroupOrder = Array.isArray(groupOrder) ? groupOrder : (groupOrder && typeof groupOrder === 'object' ? Object.values(groupOrder) : []);
    const validGroupOrder = safeGroupOrder.filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
    const lineTraces = [];
    const bandTraces = [];

    validGroupOrder.forEach(group => {
        const groupData = meanScoresDict.hasOwnProperty(group) ? meanScoresDict[group] : {};
        const xVals = featureOrder;
        const yVals = featureOrder.map(f => {
            const v = groupData && groupData.hasOwnProperty(f) ? groupData[f] : null;
            return (v !== null && v !== undefined && !Number.isNaN(v)) ? v : null;
        });
        const hoverName = hoverNameMap[group] || group;
        let markerSymbol = safeMarkerSymbols[group] || getMarkerSymbol(group);
        if (isScientistGroup(group)) {
            markerSymbol = 'square';
        }
        if (['Never'].includes(group)) {
            markerSymbol = 'x';
        }
        let marker;
        if (forceAIStyle || (typeof group === 'string' && group.toLowerCase().includes('ai') && !group.toLowerCase().includes('daily'))) {
            marker = {
                size: 10,
                symbol: markerSymbol,
                color: '#fff',
                line: { color: legendColors[group] || '#222', width: 3 }
            };
        } else {
            marker = {
                size: 10,
                symbol: markerSymbol,
                color: legendColors[group] || '#222',
                opacity: 1
            };
        }

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

            const bandX = featureOrder;
            const bandUpper = featureOrder.map((_, idx) => upperVals[idx] !== null ? upperVals[idx] : null);
            const bandLower = featureOrder.map((_, idx) => lowerVals[idx] !== null ? lowerVals[idx] : null);

            const bandSegments = [];
            let currentSegment = { x: [], upper: [], lower: [] };
            for (let idx = 0; idx < bandX.length; idx++) {
                if (bandUpper[idx] !== null && bandLower[idx] !== null) {
                    currentSegment.x.push(bandX[idx]);
                    currentSegment.upper.push(bandUpper[idx]);
                    currentSegment.lower.push(bandLower[idx]);
                } else if (currentSegment.x.length > 0) {
                    bandSegments.push(currentSegment);
                    currentSegment = { x: [], upper: [], lower: [] };
                }
            }
            if (currentSegment.x.length > 0) {
                bandSegments.push(currentSegment);
            }

            bandSegments.forEach(segment => {
                const bandTrace = {
                    type: 'scatter',
                    x: [...segment.x, ...segment.x.slice().reverse()],
                    y: [...segment.upper, ...segment.lower.slice().reverse()],
                    fill: 'toself',
                    fillcolor: colorToRgba(legendColors[group] || '#999', 0.10),
                    line: { color: 'transparent', width: 0 },
                    mode: 'lines',
                    showlegend: false,
                    hoverinfo: 'none',
                    connectgaps: true,
                    legendgroup: group,
                    layer: 'below',
                    isConfidenceBand: true
                };
                bandTraces.push(bandTrace);
            });
        }

        const lineOverlayTrace = {
            x: xVals,
            y: yVals,
            type: 'scatter',
            mode: 'lines',
            line: { color: legendColors[group] || undefined, width: 3 },
            connectgaps: true,
            showlegend: false,
            hoverinfo: 'skip',
            legendgroup: group,
            layer: 'above',
            isConfidenceBand: false
        };
        lineTraces.push(lineOverlayTrace);
        const lineTrace = {
            x: xVals,
            y: yVals,
            customdata: featureOrder.map(feature => {
                const std = stdDevDict && stdDevDict[group] && stdDevDict[group][feature] !== undefined && stdDevDict[group][feature] !== null
                    ? `SD: ${Number(stdDevDict[group][feature]).toFixed(2)}`
                    : '';
                return [getFeatureLabel(feature), hoverName, std];
            }),
            name: traceNameMap[group] || group,
            mode: 'lines+markers',
            line: { color: legendColors[group] || undefined, width: 2 },
            marker,
            connectgaps: true,
            showlegend: showLegend,
            legendgroup: group,
            layer: 'above',
            isConfidenceBand: false,
            hovertemplate: validGroupOrder.length > 1
                ? `<b>%{customdata[0]}</b><br>${hoverLabel}: %{customdata[1]}<br>${meanLabel}: %{y:.2f}<br>%{customdata[2]}<extra></extra>`
                : `<b>%{customdata[0]}</b><br>${meanLabel}: %{y:.2f}<br>%{customdata[2]}<extra></extra>`
        };
        lineTraces.push(lineTrace);
    });

    const traces = [...bandTraces, ...lineTraces];
    let filteredTraces = window.filterValidTraces(traces);
    if (filteredTraces.length === 0) return;
    const bandTracesOnly = filteredTraces.filter(t => t.isConfidenceBand);
    const lineTracesOnly = filteredTraces.filter(t => !t.isConfidenceBand);
    const sortedLineTraces = orderTracesByLegend(lineTracesOnly, legendOrder);
    filteredTraces = [...bandTracesOnly, ...sortedLineTraces];

    let layout;
    if (sharedLayout) {
        layout = Object.assign({}, sharedLayout, {
            title,
            showlegend: showLegend,
            legend: Object.assign({}, sharedLayout.legend || {}, getPlotlyLegendConfig({ title: { text: legendTitle } }))
        });
    } else {
        const xTickVals = featureOrder;
        const xTickText = featureOrder.map(f => getFeatureLabel(f));
        const { tickvals: yTickVals, ticktext: yTickText, range: yRange, title: defaultYTitle } = window.getLikertYAxisTicks(responseScale);
        layout = buildDefaultPlotLayout({
            title,
            xaxis: buildXAxisConfig(xaxisTitle, xTickVals, xTickText, xTickAngle, 'category'),
            yaxis: buildYAxisConfig(yaxisTitle || defaultYTitle, yTickVals, yTickText),
            legendOptions: { title: { text: legendTitle } },
            showLegend,
            height: 500,
            margin: { r: 180 }
        });
        if (yRange) {
            layout.yaxis.range = yRange;
        }
    }
    const plotContainer = resolvePlotContainer(containerId);
    if (!plotContainer) return;
    Plotly.newPlot(plotContainer, filteredTraces, layout, { responsive: true });
}

function makeSlopeChart(meanScoresDict, meanScoresDictAI, featureOrder, legendColors, legendOrder, options, containerId) {
    options = options || {};
    const title = options.title || '';
    const legendTitle = options.legendTitle || '';
    const showLegend = options.showLegend !== false;
    const safeMarkerSymbols = (typeof options.markerSymbols === 'object' && options.markerSymbols !== null) ? options.markerSymbols : {};
    const isGrouped = options.isGrouped || false;
    const groupOrder = options.groupOrder || legendOrder;
    featureOrder = Array.isArray(featureOrder) ? featureOrder : (featureOrder && typeof featureOrder === 'object' ? Object.values(featureOrder) : [featureOrder]);
    const traceNameMap = options.traceNameMap || {};
    const hoverNameMap = options.hoverNameMap || {};
    const hoverLabel = options.hoverLabel || legendTitle || 'Group';
    const pairedData = options.pairedData || [];
    const meanLabel = 'Mean Acceptability';

    const traces = [];

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

    featureOrder.forEach((feature, featureIdx) => {
        const featureX = featureIdx;

        if (isGrouped) {
            const safeGroupOrder = Array.isArray(groupOrder) ? groupOrder : (groupOrder && typeof groupOrder === 'object' ? Object.values(groupOrder) : []);
            const validGroupOrder = safeGroupOrder.filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');

            validGroupOrder.forEach((group, groupIdx) => {
                const humanMean = meanScoresDict[group] && meanScoresDict[group][feature] != null ? meanScoresDict[group][feature] : null;
                const aiMean = meanScoresDictAI[group] && meanScoresDictAI[group][feature] != null ? meanScoresDictAI[group][feature] : null;

                if (humanMean === null || aiMean === null) return;

                traces.push({
                    x: [featureX - 0.1, featureX + 0.1],
                    y: [humanMean, aiMean],
                    mode: 'lines',
                    line: { color: legendColors[group] || 'peru', width: 2 },
                    showlegend: false,
                    hoverinfo: 'skip',
                    legendgroup: group
                });

                let markerSymbol = safeMarkerSymbols[group] || getMarkerSymbol(group);
                if (['Never'].includes(group)) {
                    markerSymbol = 'x';
                }
                const hoverName = hoverNameMap[group] || group;
                const featureLabel = getFeatureLabel(feature);

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
                    showlegend: showLegend && featureIdx === 0,
                    legendgroup: group,
                    hovertemplate: `<b>${featureLabel}</b><br>${hoverLabel}: ${hoverName}<br>Type: Human<br>${meanLabel}: ${humanMean.toFixed(2)}<extra></extra>`,
                    name: traceNameMap[group] || group
                });

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
                    showlegend: false,
                    legendgroup: group,
                    hovertemplate: `<b>${featureLabel}</b><br>${hoverLabel}: ${hoverName}<br>Type: AI<br>${meanLabel}: ${aiMean.toFixed(2)}<extra></extra>`,
                    name: ''
                });
            });
        } else {
            const humanMean = meanScoresDict['Human'] && meanScoresDict['Human'][feature] != null ? meanScoresDict['Human'][feature] : null;
            const aiMean = meanScoresDictAI['AI'] && meanScoresDictAI['AI'][feature] != null ? meanScoresDictAI['AI'][feature] : null;

            if (humanMean === null || aiMean === null) return;
            const humanX = featureX - 0.15;
            const aiX = featureX + 0.15;
            const featureLabel = getFeatureLabel(feature);

            traces.push({
                x: [humanX, aiX],
                y: [humanMean, aiMean],
                mode: 'lines',
                line: { color: legendColors['Human'] || 'peru', width: 2 },
                showlegend: false,
                hoverinfo: 'skip',
                legendgroup: 'human'
            });

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
                showlegend: showLegend && feature === featureOrder[0],
                legendgroup: 'human',
                hovertemplate: `<b>${featureLabel}</b><br>Type: Human<br>${meanLabel}: ${humanMean.toFixed(2)}<extra></extra>`,
                name: 'Human'
            });

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
                showlegend: showLegend && feature === featureOrder[0],
                legendgroup: 'ai',
                hovertemplate: `<b>${featureLabel}</b><br>Type: AI<br>${meanLabel}: ${aiMean.toFixed(2)}<extra></extra>`,
                name: 'AI'
            });
        }
    });

    const { ticktext: xTickText } = window.getAxisTicks(featureOrder, window.FEATURE_LABELS || {});
    const { tickvals: yTickVals, ticktext: yTickText } = window.getLikertYAxisTicks();

    const layout = buildDefaultPlotLayout({
        title,
        xaxis: buildXAxisConfig('Type of Alteration', featureOrder.map((_, i) => i), xTickText, 30, 'linear', [-0.5, featureOrder.length - 0.5]),
        yaxis: buildYAxisConfig('Acceptability', yTickVals, yTickText),
        legendOptions: { title: { text: legendTitle } },
        showLegend,
        margin: { r: 180 }
    });
    const filteredTraces = orderTracesByLegend(window.filterValidTraces(traces), legendOrder);
    const plotContainer = resolvePlotContainer(containerId);
    if (!plotContainer) return;
    Plotly.newPlot(plotContainer, filteredTraces, layout, { responsive: true });
}

function makeSwarmPlot(data, x, y, group, options, containerId) {
    options = options || {};
    const {
        title = '',
        colorMap = {},
        categoryOrders = {},
        xaxisTitle = '',
        yaxisTitle = '',
        responseScale = 'acceptability',
        traceNameMap = {},
        legendTitle = '',
        hoverNameMap = {},
        hoverLabel = legendTitle || 'Group',
        legendOrder = null,
        jitterAmplitude = 0.54,
        markerSize = 7,
        markerOpacity = 0.65,
        xTickAngle = 30,
        showLegend = true
    } = options;

    const rawFeatureOrder = categoryOrders[x] || [...new Set(data.map(row => row[x]))];
    const featureOrder = Array.isArray(rawFeatureOrder) ? rawFeatureOrder : (rawFeatureOrder && typeof rawFeatureOrder === 'object' ? Object.values(rawFeatureOrder) : [rawFeatureOrder]);
    const rawGroupOrder = categoryOrders[group] || [...new Set(data.map(row => row[group]))];
    const groupOrder = Array.isArray(rawGroupOrder) ? rawGroupOrder : (rawGroupOrder && typeof rawGroupOrder === 'object' ? Object.values(rawGroupOrder) : [rawGroupOrder]);

    const validGroupOrder = groupOrder.filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
    let drawOrder = validGroupOrder;
    let legendTraceOrder = 'normal';
    const scaleTitle = getResponseMetricLabel(responseScale);
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
        const traceName = traceNameMap[groupName] || groupName;
        const hoverName = hoverNameMap[groupName] || groupName;

        traces.push({
            x: xVals,
            y: yVals,
            mode: 'markers',
            type: 'scatter',
            name: traceName,
            marker: {
                symbol: ((group === 'ShortGroup' && ['Scientist who creates vis', 'Scientist who uses vis'].includes(groupName)) ||
                         (group === 'Group' && [
                             'I create visualizations to help me in my primary role, which is not visualization-related',
                             'I work with visualizations created by others, but I do not create or research visualization myself'
                         ].includes(groupName))) ? 'square' : 'circle',
                size: markerSize,
                color: colorMap[groupName] || undefined,
                opacity: markerOpacity,
                line: { width: 1, color: '#333' }
            },
            customdata: groupData.map(row => [
                getFeatureLabel(row[x]),
                hoverName,
                window.getResponseLabelForValue ? window.getResponseLabelForValue(row[y], responseScale) : String(row[y])
            ]),
            hovertemplate: validGroupOrder.length > 1
                ? `<b>%{customdata[0]}</b><br>${hoverLabel}: %{customdata[1]}<br>${scaleTitle}: %{customdata[2]}<extra></extra>`
                : `<b>%{customdata[0]}</b><br>${scaleTitle}: %{customdata[2]}<extra></extra>`,
            legendgroup: traceName,
            showlegend: showLegend
        });
    });

    const xTickText = featureOrder.map(f => getFeatureLabel(f));
    const { tickvals: yTickVals, ticktext: yTickText, range: yRange, title: defaultYTitle } = window.getLikertYAxisTicks(responseScale);
    const layout = buildDefaultPlotLayout({
        title,
        xaxis: buildXAxisConfig(xaxisTitle, featureOrder.map((_, i) => i), xTickText, xTickAngle, 'linear', [-0.5, featureOrder.length - 0.5]),
        yaxis: buildYAxisConfig(yaxisTitle || defaultYTitle, yTickVals, yTickText, true),
        legendOptions: Object.assign(
            { traceorder: legendTraceOrder },
            legendTitle ? { title: { text: legendTitle } } : {}
        ),
        showLegend,
        margin: { r: 180 }
    });
    if (yRange) {
        layout.yaxis.range = yRange;
    }
    const filteredTraces = orderTracesByLegend(window.filterValidTraces(traces), legendOrder);
    const plotContainer = resolvePlotContainer(containerId);
    if (!plotContainer) return;
    Plotly.newPlot(plotContainer, filteredTraces, layout, { responsive: true });
}

function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildDefaultPlotLayout({ title = '', xaxis = {}, yaxis = {}, legendOptions = {}, showLegend = true, height = 500, margin = { r: 180 }, hovermode = 'closest' } = {}) {
    return {
        title,
        xaxis,
        yaxis,
        showlegend: showLegend,
        legend: getPlotlyLegendConfig(legendOptions),
        height,
        margin,
        hovermode
    };
}

if (typeof window !== 'undefined') {
    window.makeBoxPlot = makeBoxPlot;
    window.makeStackedBarChart = makeStackedBarChart;
    window.makeLineChart = makeLineChart;
    window.makeSlopeChart = makeSlopeChart;
    window.makeSwarmPlot = makeSwarmPlot;
}
