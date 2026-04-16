// Attach to window for global access
window.generateColorScale = generateColorScale;

// Utility function to generate a color scale dynamically
function generateColorScale(legend) {
    const colors = window.DEFAULT_COLOR_PALETTE || [
        '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
        '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
    ];
    const colorMap = {};
    legend.forEach((item, index) => {
        colorMap[item] = colors[index % colors.length]; // Cycle through colors if legend is longer than the palette
    });
    return colorMap;
}

// Entry point for dashboard logic
// TODO: Implement data loading, cleaning, and plotting logic here

document.addEventListener('DOMContentLoaded', function() {
    // --- Spinner utility ---
    const spinner = document.getElementById('spinner');
    function showSpinner() {
        if (spinner) spinner.style.display = 'block';
    }
    function hideSpinner() {
        if (spinner) spinner.style.display = 'none';
    }
    // Usage: Call showSpinner() before a server request and hideSpinner() in .finally() or after response.
    // --- Constants ---
    // The app now uses shared comparison and palette metadata from js/metadata.js.

    // --- State ---
    let backendData = null;

    // --- Utility: shared comparison metadata ---
    function getComparisonConfig(comparisonType) {
        return (window.COMPARISON_CONFIG && window.COMPARISON_CONFIG[comparisonType]) || {
            column: null,
            label: comparisonType,
            labelMap: null,
            order: null,
            colorMap: null
        };
    }

    function getComparisonLabel(comparisonType) {
        return getComparisonConfig(comparisonType).label || comparisonType;
    }

    // --- Utility: get current dropdown values ---
    function getSelections() {
        return {
            chartType: document.getElementById('chart-type').value,
            comparisonType: document.getElementById('comparison-type').value,
            sortBy: document.getElementById('sort-by').value
        };
    }

    // --- Utility: sort features by mean, median, or difference ---
    function getFeatureSortOrder(sortBy, meltedHuman, meltedAI) {
        function groupBy(arr, key) {
            return arr.reduce((acc, row) => {
                const k = row[key];
                acc[k] = acc[k] || [];
                acc[k].push(row);
                return acc;
            }, {});
        }
        if (sortBy === 'human_mean') {
            const grouped = groupBy(meltedHuman, 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => {
                const meanA = grouped[a].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / grouped[a].length;
                const meanB = grouped[b].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / grouped[b].length;
                return meanB - meanA;
            });
        } else if (sortBy === 'ai_mean') {
            const grouped = groupBy(meltedAI, 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => {
                const meanA = grouped[a].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / grouped[a].length;
                const meanB = grouped[b].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / grouped[b].length;
                return meanB - meanA;
            });
        } else if (sortBy === 'difference') {
            const groupedH = groupBy(meltedHuman, 'Feature_Name');
            const groupedA = groupBy(meltedAI, 'Feature_Name');
            const allFeatures = Array.from(new Set([...Object.keys(groupedH), ...Object.keys(groupedA)]));
            return allFeatures.sort((a, b) => {
                const meanH_A = groupedH[a] ? groupedH[a].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / groupedH[a].length : 0;
                const meanA_A = groupedA[a] ? groupedA[a].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / groupedA[a].length : 0;
                const meanH_B = groupedH[b] ? groupedH[b].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / groupedH[b].length : 0;
                const meanA_B = groupedA[b] ? groupedA[b].reduce((s, r) => s + (r.Numerical_Score ?? 0), 0) / groupedA[b].length : 0;
                return (meanH_B - meanA_B) - (meanH_A - meanA_A);
            });
        } else if (sortBy === 'human_median') {
            const grouped = groupBy(meltedHuman, 'Feature_Name');
            function median(arr) {
                const nums = arr.map(r => r.Numerical_Score).sort((a, b) => a - b);
                const mid = Math.floor(nums.length / 2);
                return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
            }
            return Object.keys(grouped).sort((a, b) => median(grouped[b]) - median(grouped[a]));
        } else if (sortBy === 'ai_median') {
            const grouped = groupBy(meltedAI, 'Feature_Name');
            function median(arr) {
                const nums = arr.map(r => r.Numerical_Score).sort((a, b) => a - b);
                const mid = Math.floor(nums.length / 2);
                return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
            }
            return Object.keys(grouped).sort((a, b) => median(grouped[b]) - median(grouped[a]));
        } else if (sortBy === 'difference_median') {
            const groupedH = groupBy(meltedHuman, 'Feature_Name');
            const groupedA = groupBy(meltedAI, 'Feature_Name');
            function median(arr) {
                const nums = arr.map(r => r.Numerical_Score).sort((a, b) => a - b);
                const mid = Math.floor(nums.length / 2);
                return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
            }
            const allFeatures = Array.from(new Set([...Object.keys(groupedH), ...Object.keys(groupedA)]));
            return allFeatures.sort((a, b) => {
                const medH_A = groupedH[a] ? median(groupedH[a]) : 0;
                const medA_A = groupedA[a] ? median(groupedA[a]) : 0;
                const medH_B = groupedH[b] ? median(groupedH[b]) : 0;
                const medA_B = groupedA[b] ? median(groupedA[b]) : 0;
                return (medH_B - medA_B) - (medH_A - medA_A);
            });
        }
        // Default: human_mean
        return getFeatureSortOrder('human_mean', meltedHuman, meltedAI);
    }

    // --- Utility: get group display labels, colors, and order ---
    function getGroupMeta(comparisonType, groupValues) {
        const config = getComparisonConfig(comparisonType);
        let labelMap = config.labelMap || null;
        let colorMap = config.colorMap || null;
        let order = config.order || null;

        if (comparisonType === 'domain' && groupValues) {
            order = groupValues.slice();
            colorMap = {};
            const pxColors = window.PLOTLY_QUALITATIVE_COLORS || [];
            order.forEach((g, i) => {
                colorMap[g] = pxColors[i % pxColors.length] || window.DEFAULT_COLOR_PALETTE[i % window.DEFAULT_COLOR_PALETTE.length];
            });
        }

        return { labelMap, colorMap, order };
    }

    function normalizeGroups(groups) {
        return (groups || []).filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
    }

    function buildGroupPresentation(comparisonType, backendData) {
        const rawGroups = normalizeGroups(backendData.groups);
        const meta = getGroupMeta(comparisonType, rawGroups);
        const labelMap = meta.labelMap;
        const groupKey = 'Group';
        let colorMap;
        if (labelMap && meta.colorMap) {
            colorMap = {};
            rawGroups.forEach(rawGroup => {
                const shortName = labelMap[rawGroup] || rawGroup;
                if (meta.colorMap[shortName]) {
                    colorMap[rawGroup] = meta.colorMap[shortName];
                }
            });
            const missingGroups = rawGroups.filter(rawGroup => !colorMap[rawGroup]);
            if (missingGroups.length) {
                Object.assign(colorMap, window.generateColorScale(missingGroups));
            }
        } else {
            colorMap = meta.colorMap || window.generateColorScale(rawGroups);
        }
        let groupOrder = rawGroups.slice();
        const traceNameMap = {};

        if (labelMap) {
            const orderedRawGroups = [];
            if (meta.order) {
                meta.order.forEach(displayName => {
                    const rawGroup = rawGroups.find(g => labelMap[g] === displayName);
                    if (rawGroup && !orderedRawGroups.includes(rawGroup)) {
                        orderedRawGroups.push(rawGroup);
                    }
                });
            }
            rawGroups.forEach(rawGroup => {
                if (!orderedRawGroups.includes(rawGroup)) {
                    orderedRawGroups.push(rawGroup);
                }
            });
            groupOrder = orderedRawGroups;
            rawGroups.forEach(rawGroup => {
                const displayName = labelMap[rawGroup] || rawGroup;
                const count = backendData.groupCounts && backendData.groupCounts[rawGroup] !== undefined ? backendData.groupCounts[rawGroup] : 0;
                traceNameMap[rawGroup] = `${displayName} (${count})`;
            });
        } else {
            if (meta.order) {
                const ordered = meta.order.filter(name => rawGroups.includes(name));
                rawGroups.forEach(name => { if (!ordered.includes(name)) ordered.push(name); });
                groupOrder = ordered;
            }
            rawGroups.forEach(group => {
                const count = backendData.groupCounts && backendData.groupCounts[group] !== undefined ? backendData.groupCounts[group] : 0;
                traceNameMap[group] = `${group} (${count})`;
            });
        }

        if (!colorMap) {
            colorMap = window.generateColorScale(groupOrder);
        }

        return { rawGroups, groupOrder, groupKey, colorMap, traceNameMap };
    }

    // --- Utility: set plot visibility before rendering ---
    function setPlotVisibility(humanVisible, aiVisible) {
        const humanPlot = document.getElementById('human-plot');
        const aiPlot = document.getElementById('ai-plot');
        if (humanPlot) humanPlot.style.display = humanVisible ? 'block' : 'none';
        if (aiPlot) aiPlot.style.display = aiVisible ? 'block' : 'none';
    }

    // --- Utility: resize plots after rendering so visible charts match their container width ---
    function resizeVisiblePlots() {
        ['human-plot', 'ai-plot'].forEach(id => {
            const plotEl = document.getElementById(id);
            if (plotEl && plotEl.offsetWidth > 0) {
                try {
                    Plotly.Plots.resize(plotEl);
                } catch (err) {
                    // ignore if plot is not initialized yet
                }
            }
        });
    }

    // --- Main plot update logic ---
    function updatePlots() {
        const { chartType, comparisonType, sortBy } = getSelections();
        const comparisonConfig = getComparisonConfig(comparisonType);
        // Determine which containers should be visible for the selected chart type
        let showHumanPlot = true;
        let showAIPlot = false;
        if (chartType === 'box' || chartType === 'line' || chartType === 'swarm') {
            showAIPlot = comparisonType !== 'human_ai';
        }
        setPlotVisibility(showHumanPlot, showAIPlot);

        // Defensive: try/catch for main logic
        try {
            // --- Use backendData structure only ---
            if (!backendData) {
                document.getElementById('human-plot').innerHTML = '<div style="color:red;text-align:center;padding:2em;">No data loaded from backend.</div>';
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
                return;
            }
            if (chartType === 'box') {
                if (comparisonType === 'human_ai') {
                    const combined = [];
                    backendData.groups.forEach(group => {
                        backendData.features.forEach(feat => {
                            (backendData.data[group][feat] || []).forEach(score => {
                                combined.push({
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Type: group
                                });
                            });
                        });
                    });
                    // Sort features for plotting
                    const featureOrder = getFeatureSortOrder(sortBy, combined.filter(r => r.Type === 'Human'), combined.filter(r => r.Type === 'AI'));
                    window.makeBoxPlot(
                        combined,
                        'Feature_Name',
                        'Numerical_Score',
                        'Type',
                        {
                            title: 'Acceptability of Human vs AI Alterations',
                            colorMap: comparisonConfig.colorMap,
                            categoryOrders: { 'Feature_Name': featureOrder, 'Type': backendData.groups },
                            xaxisTitle: 'Type of Alteration',
                            yaxisTitle: 'Acceptability'
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else {
                    // --- Dual plot
                    //  logic for all other comparison types ---
                    const { groupOrder, groupKey, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);
                    let meltedHuman = [];
                    let meltedAI = [];

                    backendData.groups.forEach(group => {
                        backendData.features.forEach(feat => {
                            const humanScores = (backendData.data[group] && backendData.data[group][feat]) ? backendData.data[group][feat] : [];
                            const aiScores = (backendData.data[`${group}__AI`] && backendData.data[`${group}__AI`][feat]) ? backendData.data[`${group}__AI`][feat] : [];
                            const shortName = labelMap && labelMap[group] ? labelMap[group] : group;

                            humanScores.forEach(score => {
                                const entryH = {
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Group: group
                                };
                                meltedHuman.push(entryH);
                            });
                            aiScores.forEach(score => {
                                const entryA = {
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Group: group
                                };
                                meltedAI.push(entryA);
                            });
                        });
                    });
                    // Legacy fallback for old responses that may not have separate human/AI group lists
                    if (!backendData.humanGroups) meltedHuman = meltedHuman.concat(meltedAI);
                    if (!backendData.aiGroups) meltedAI = meltedAI.concat(meltedHuman);
                    // Sort features for plotting
                    const featureOrder = getFeatureSortOrder(sortBy, meltedHuman, meltedAI);
                    
                    // Build legend order with counts for box plots
                    const boxPlotLegendOrder = groupOrder.map(g => traceNameMap[g]);
                    
                    window.makeBoxPlot(
                        meltedHuman,
                        'Feature_Name',
                        'Numerical_Score',
                        groupKey,
                        {
                            title: `Acceptability of Human Alterations`,
                            colorMap: colorMap,
                            categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                            xaxisTitle: 'Type of Alteration',
                            yaxisTitle: 'Acceptability',
                            legendOrder: boxPlotLegendOrder,
                            traceNameMap: traceNameMap
                        },
                        'human-plot'
                    );
                    window.makeBoxPlot(
                        meltedAI,
                        'Feature_Name',
                        'Numerical_Score',
                        groupKey,
                        {
                            title: `Acceptability of AI Alterations`,
                            colorMap: colorMap,
                            categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                            xaxisTitle: 'Type of Alteration',
                            yaxisTitle: 'Acceptability',
                            legendOrder: boxPlotLegendOrder,
                            traceNameMap: traceNameMap
                        },
                        'ai-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'block';
                }
            } else if (chartType === 'slope') {
                if (comparisonType === 'human_ai') {
                    const humanMeans = backendData.meansHuman['Human'] || {};
                    const aiMeans = backendData.meansAI['AI'] || {};
                    // Sort features for plotting
                    const featureOrder = getFeatureSortOrder(sortBy,
                        Object.entries(humanMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score })),
                        Object.entries(aiMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score }))
                    );
                    window.makeSlopeChart(
                        { 'Human': humanMeans },
                        { 'AI': aiMeans },
                        featureOrder,
                        comparisonConfig.colorMap,
                        ['Human', 'AI'],
                        {
                            title: 'Mean Acceptability (Human ● vs AI ○, individual responses shown as gray lines)',
                            legendTitle: 'Type',
                            groupOrder: ['Human', 'AI'],
                            isGrouped: false,
                            pairedData: backendData.pairedData || [] // Pass paired individual responses
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else {
                    // --- Slope chart logic for all other comparison types ---
                    let groupMeansHuman = {};
                    let groupMeansAI = {};
                    let groupStdsHuman = {};
                    let groupStdsAI = {};
                    const legendWithCounts = [];
                    const { groupOrder, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);

                    backendData.groups.forEach(rawGroup => {
                        const displayName = labelMap ? (labelMap[rawGroup] || rawGroup) : rawGroup;
                        const count = backendData.groupCounts && backendData.groupCounts[rawGroup] !== undefined ? backendData.groupCounts[rawGroup] : 0;
                        legendWithCounts.push(`${displayName} (${count})`);

                        groupMeansHuman[rawGroup] = backendData.meansHuman ? (backendData.meansHuman[rawGroup] || {}) : {};
                        groupMeansAI[rawGroup] = backendData.meansAI ? (backendData.meansAI[rawGroup] || {}) : {};
                        groupStdsHuman[rawGroup] = backendData.stdsHuman ? (backendData.stdsHuman[rawGroup] || {}) : {};
                        groupStdsAI[rawGroup] = backendData.stdsAI ? (backendData.stdsAI[rawGroup] || {}) : {};
                    });

                    // Use meansHuman and meansAI to build arrays for getFeatureSortOrder
                    const featureOrder = getFeatureSortOrder(sortBy,
                        Object.entries(groupMeansHuman).flatMap(([Feature_Name, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v }))),
                        Object.entries(groupMeansAI).flatMap(([Feature_Name, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v })))
                    );
                    window.makeSlopeChart(
                        groupMeansHuman,
                        groupMeansAI,
                        featureOrder,
                        colorMap,
                        legendWithCounts,
                        {
                            title: `Mean Acceptability (Human \u25cf vs AI \u25cb)`,
                            legendTitle: 'Group',
                            traceNameMap: traceNameMap,
                            groupOrder: groupOrder,
                            isGrouped: true
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                }
            } else if (chartType === 'line') {
                if (comparisonType === 'human_ai') {
                    const humanMeans = backendData.means['Human'] || {};
                    const aiMeans = backendData.means['AI'] || {};
                    const humanStds = backendData.stdsHuman['Human'] || {};
                    const aiStds = backendData.stdsAI['AI'] || {};
                    // Sort features for plotting
                    const featureOrder = getFeatureSortOrder(sortBy,
                        Object.entries(humanMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score })),
                        Object.entries(aiMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score }))
                    );
                    // Build traceNameMap for legend labels with counts
                    const traceNameMap = {};
                    const legendOrderWithCounts = [];
                    ['Human', 'AI'].forEach(group => {
                        const count = backendData.groupCounts && backendData.groupCounts[group] !== undefined ? backendData.groupCounts[group] : 0;
                        traceNameMap[group] = `${group} (${count})`;
                        legendOrderWithCounts.push(`${group} (${count})`);
                    });
                    window.makeLineChart(
                        { 'Human': humanMeans, 'AI': aiMeans },
                        featureOrder,
                        comparisonConfig.colorMap,
                        legendOrderWithCounts,
                        {
                            title: 'Mean Acceptability with ±1 Stdev Bands (Human ● vs AI ○)',
                            legendTitle: 'Type',
                            traceNameMap: traceNameMap,
                            groupOrder: ['Human', 'AI'],  // Data lookup keys
                            stdDevDict: { 'Human': humanStds, 'AI': aiStds }
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else {
                    // --- Line chart logic for all other comparison types ---
                    let groupMeansHuman = {};
                    let groupMeansAI = {};
                    let groupStdsHuman = {};
                    let groupStdsAI = {};
                    const legendWithCounts = [];
                    const { groupOrder, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);

                    backendData.groups.forEach(rawGroup => {
                        const displayName = labelMap ? (labelMap[rawGroup] || rawGroup) : rawGroup;
                        const count = backendData.groupCounts && backendData.groupCounts[rawGroup] !== undefined ? backendData.groupCounts[rawGroup] : 0;
                        legendWithCounts.push(`${displayName} (${count})`);

                        groupMeansHuman[rawGroup] = backendData.meansHuman ? (backendData.meansHuman[rawGroup] || {}) : {};
                        groupMeansAI[rawGroup] = backendData.meansAI ? (backendData.meansAI[rawGroup] || {}) : {};
                        groupStdsHuman[rawGroup] = backendData.stdsHuman ? (backendData.stdsHuman[rawGroup] || {}) : {};
                        groupStdsAI[rawGroup] = backendData.stdsAI ? (backendData.stdsAI[rawGroup] || {}) : {};
                    });

                    // Use meansHuman and meansAI to build arrays for getFeatureSortOrder
                    const featureOrder = getFeatureSortOrder(sortBy,
                        Object.entries(groupMeansHuman).flatMap(([Feature_Name, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v }))),
                        Object.entries(groupMeansAI).flatMap(([Feature_Name, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v })))
                    );
                    window.makeLineChart(
                        groupMeansHuman,
                        featureOrder,
                        colorMap,
                        legendWithCounts,
                        {
                            title: `Mean Acceptability for Human Alteration (±1 Stdev Bands)`,
                            legendTitle: 'Group',
                            traceNameMap: traceNameMap,
                            groupOrder: groupOrder,
                            isGrouped: true,
                            stdDevDict: groupStdsHuman
                        },
                        'human-plot'
                    );
                    window.makeLineChart(
                        groupMeansAI,
                        featureOrder,
                        colorMap,
                        legendWithCounts,
                        {
                            title: `Mean Acceptability for AI Alteration (±1 Stdev Bands)`,
                            legendTitle: 'Group',
                            forceAIStyle: true,
                            traceNameMap: traceNameMap,
                            groupOrder: groupOrder,
                            stdDevDict: groupStdsAI
                        },
                        'ai-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'block';
                }
            } else if (chartType === 'swarm') {
                const comparisonLabel = getComparisonLabel(comparisonType);
                if (comparisonType === 'human_ai') {
                    const combined = [];
                    backendData.groups.forEach(group => {
                        backendData.features.forEach(feat => {
                            (backendData.data[feat][group] || []).forEach(score => {
                                combined.push({
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Type: group
                                });
                            });
                        });
                    });
                    const featureOrder = getFeatureSortOrder(sortBy, combined.filter(r => r.Type === 'Human'), combined.filter(r => r.Type === 'AI'));
                    window.makeSwarmPlot(
                        combined,
                        'Feature_Name',
                        'Numerical_Score',
                        'Type',
                        {
                            title: `Swarm Plot: Acceptability of Human vs AI Alterations`,
                            colorMap: comparisonConfig.colorMap,
                            categoryOrders: { 'Feature_Name': featureOrder, 'Type': backendData.groups },
                            xaxisTitle: 'Type of Alteration',
                            yaxisTitle: 'Acceptability',
                            traceNameMap: { 'Human': 'Human', 'AI': 'AI' }
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else {
                    const combinedHuman = [];
                    const combinedAI = [];
                    const { groupOrder, groupKey, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);

                    backendData.groups.forEach(rawGroup => {
                        if (rawGroup === undefined || rawGroup === null || String(rawGroup).trim().toLowerCase() === 'nan' || String(rawGroup).trim() === '') return;
                        const shortName = labelMap ? (labelMap[rawGroup] || rawGroup) : rawGroup;
                        backendData.features.forEach(feat => {
                            const valuesH = (backendData.dataHuman[feat] && backendData.dataHuman[feat][rawGroup]) ? backendData.dataHuman[feat][rawGroup] : [];
                            valuesH.forEach(score => {
                                combinedHuman.push({
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Group: rawGroup,
                                    ShortGroup: shortName
                                });
                            });
                            const valuesA = (backendData.dataAI[feat] && backendData.dataAI[feat][rawGroup]) ? backendData.dataAI[feat][rawGroup] : [];
                            valuesA.forEach(score => {
                                combinedAI.push({
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Group: rawGroup,
                                    ShortGroup: shortName
                                });
                            });
                        });
                    });

                    const featureOrder = getFeatureSortOrder(sortBy, combinedHuman, combinedAI);
                    window.makeSwarmPlot(
                        combinedHuman,
                        'Feature_Name',
                        'Numerical_Score',
                        groupKey,
                        {
                            title: `Swarm Plot: Acceptability of Human Alterations by ${comparisonLabel}`,
                            colorMap: colorMap || window.generateColorScale(groupOrder),
                            categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                            xaxisTitle: 'Type of Alteration',
                            yaxisTitle: 'Acceptability',
                            traceNameMap: traceNameMap
                        },
                        'human-plot'
                    );
                    window.makeSwarmPlot(
                        combinedAI,
                        'Feature_Name',
                        'Numerical_Score',
                        groupKey,
                        {
                            title: `Swarm Plot: Acceptability of AI Alterations by ${comparisonLabel}`,
                            colorMap: colorMap || window.generateColorScale(groupOrder),
                            categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                            xaxisTitle: 'Type of Alteration',
                            yaxisTitle: 'Acceptability',
                            traceNameMap: traceNameMap
                        },
                        'ai-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'block';
                }
            } else {
                document.getElementById('human-plot').innerHTML = '<div style="text-align:center;padding:2em;">Not implemented yet.</div>';
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
            }
            resizeVisiblePlots();
        } catch (err) {
            document.getElementById('human-plot').innerHTML = `<div style="color:red;text-align:center;padding:2em;">Error updating plots: ${err.message}</div>`;
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
        }
    }

    // --- Fetch aggregated data from backend ---
    async function fetchAggregatedData() {
            const { chartType, comparisonType, sortBy } = getSelections();
            const url = `${API_URL}?chartType=${encodeURIComponent(chartType)}&comparisonType=${encodeURIComponent(comparisonType)}&sortBy=${encodeURIComponent(sortBy)}`;
            showSpinner();
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                backendData = data;
                updatePlots();
            } catch (err) {
                document.getElementById('human-plot').innerHTML = `<div style="color:red;text-align:center;padding:2em;">Error fetching data: ${err.message}</div>`;
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
                backendData = null;
            } finally {
                hideSpinner();
            }
    }

    // --- Event listeners ---

    // Only fetch data when chart-type or comparison-type changes
    document.getElementById('chart-type').addEventListener('change', fetchAggregatedData);
    document.getElementById('comparison-type').addEventListener('change', fetchAggregatedData);
    // Only re-sort and re-plot when sort-by changes (no backend call)
    document.getElementById('sort-by').addEventListener('change', function() {
        updatePlots();
    });

    // Initial load
    fetchAggregatedData();

});

// Backend API endpoint for aggregated data
const API_URL = 'https://script.google.com/macros/s/AKfycbxkS_1zbPPw0uWhnp6abeclW4rKhWqMc06MjiC83YqHa-lcVjMMEOHuPl9ch-Zga-Gb/exec';
