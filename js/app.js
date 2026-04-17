document.addEventListener('DOMContentLoaded', function() {
    // --- Utility function to generate a color scale dynamically ---
    function generateColorScale(legend) {
        const colors = window.DEFAULT_COLOR_PALETTE || [
            '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
            '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
        ];
        const colorMap = {};
        legend.forEach((item, index) => {
            colorMap[item] = colors[index % colors.length];
        });
        return colorMap;
    }

    // --- Spinner utility ---
    const spinner = document.getElementById('spinner');
    function showSpinner() {
        if (spinner) spinner.style.display = 'block';
    }
    function hideSpinner() {
        if (spinner) spinner.style.display = 'none';
    }
    // --- Constants ---
    // The app now uses shared comparison and palette metadata from js/metadata.js.

    // --- State ---
    let backendData = null;
    let activeTab = 'alterations';

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

    function validateBackendDataShape(data, chartType) {
        if (!data || typeof data !== 'object') {
            throw new Error('Backend response is not a valid object.');
        }
        if (!Array.isArray(data.groups)) {
            throw new Error('Backend response missing required array "groups".');
        }
        if (!Array.isArray(data.features)) {
            throw new Error('Backend response missing required array "features".');
        }
        if (typeof data.groupCounts !== 'object' || data.groupCounts === null || Array.isArray(data.groupCounts)) {
            throw new Error('Backend response missing required object "groupCounts".');
        }
        if (data.groups.length > 0 && Object.keys(data.groupCounts).length === 0) {
            throw new Error('Backend response "groupCounts" must contain entries for the requested groups.');
        }
        data.groups.forEach(group => {
            if (group !== undefined && group !== null && String(group).trim() !== '' && data.groupCounts[group] === undefined) {
                throw new Error(`Backend response missing group count for "${group}".`);
            }
        });

        const optionalObjects = ['data', 'dataHuman', 'dataAI', 'means', 'meansHuman', 'meansAI', 'stdsHuman', 'stdsAI', 'pairedData'];
        optionalObjects.forEach(name => {
            if (data[name] !== undefined && (typeof data[name] !== 'object' || data[name] === null)) {
                throw new Error(`Backend response property "${name}" must be an object or array if present.`);
            }
        });

        if (chartType === 'box') {
            if (typeof data.data !== 'object' || data.data === null) {
                throw new Error('Box plot response must include "data".');
            }
        }
        if (chartType === 'line') {
            if (typeof data.meansHuman !== 'object' || data.meansHuman === null) {
                throw new Error('Line chart response must include "meansHuman".');
            }
            if (typeof data.meansAI !== 'object' || data.meansAI === null) {
                throw new Error('Line chart response must include "meansAI".');
            }
            if (typeof data.stdsHuman !== 'object' || data.stdsHuman === null) {
                throw new Error('Line chart response must include "stdsHuman".');
            }
            if (typeof data.stdsAI !== 'object' || data.stdsAI === null) {
                throw new Error('Line chart response must include "stdsAI".');
            }
        }
        if (chartType === 'slope') {
            if (typeof data.meansHuman !== 'object' || data.meansHuman === null) {
                throw new Error('Slope chart response must include "meansHuman".');
            }
            if (typeof data.meansAI !== 'object' || data.meansAI === null) {
                throw new Error('Slope chart response must include "meansAI".');
            }
            if (data.pairedData !== undefined && !Array.isArray(data.pairedData)) {
                throw new Error('Slope chart response "pairedData" must be an array if present.');
            }
        }
        if (chartType === 'swarm') {
            if (typeof data.dataHuman !== 'object' || data.dataHuman === null) {
                throw new Error('Swarm plot response must include "dataHuman".');
            }
            if (typeof data.dataAI !== 'object' || data.dataAI === null) {
                throw new Error('Swarm plot response must include "dataAI".');
            }
        }

        return true;
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
                Object.assign(colorMap, generateColorScale(missingGroups));
            }
        } else {
            colorMap = meta.colorMap || generateColorScale(rawGroups);
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
            colorMap = generateColorScale(groupOrder);
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

    // --- Refactored rendering functions ---
    function buildLegendLabels(rawGroups, labelMap, groupCounts) {
        return rawGroups.map(rawGroup => {
            const displayName = labelMap ? (labelMap[rawGroup] || rawGroup) : rawGroup;
            const count = groupCounts && groupCounts[rawGroup] !== undefined ? groupCounts[rawGroup] : 0;
            return `${displayName} (${count})`;
        });
    }

    function getFeatureOrderFromBackend(sortBy, meltedHuman, meltedAI) {
        return getFeatureSortOrder(sortBy, meltedHuman, meltedAI);
    }

    function renderBoxPlot(backendData, comparisonType, sortBy) {
        const comparisonConfig = getComparisonConfig(comparisonType);

        if (comparisonType === 'human_ai') {
            const combined = [];
            backendData.groups.forEach(group => {
                backendData.features.forEach(feat => {
                    (backendData.data[group][feat] || []).forEach(score => {
                        combined.push({ Feature_Name: feat, Numerical_Score: score, Type: group });
                    });
                });
            });
            const featureOrder = getFeatureOrderFromBackend(
                sortBy,
                combined.filter(r => r.Type === 'Human'),
                combined.filter(r => r.Type === 'AI')
            );
            makeBoxPlot(
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
            return;
        }

        const { groupOrder, groupKey, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);
        let meltedHuman = [];
        let meltedAI = [];

        backendData.groups.forEach(group => {
            backendData.features.forEach(feat => {
                const humanScores = (backendData.data[group] && backendData.data[group][feat]) ? backendData.data[group][feat] : [];
                const aiScores = (backendData.data[`${group}__AI`] && backendData.data[`${group}__AI`][feat]) ? backendData.data[`${group}__AI`][feat] : [];

                humanScores.forEach(score => meltedHuman.push({ Feature_Name: feat, Numerical_Score: score, Group: group }));
                aiScores.forEach(score => meltedAI.push({ Feature_Name: feat, Numerical_Score: score, Group: group }));
            });
        });

        if (!backendData.humanGroups) meltedHuman = meltedHuman.concat(meltedAI);
        if (!backendData.aiGroups) meltedAI = meltedAI.concat(meltedHuman);

        const featureOrder = getFeatureOrderFromBackend(sortBy, meltedHuman, meltedAI);
        const boxPlotLegendOrder = groupOrder.map(g => traceNameMap[g]);

        makeBoxPlot(
            meltedHuman,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
            {
                title: 'Acceptability of Human Alterations',
                colorMap: colorMap,
                categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                xaxisTitle: 'Type of Alteration',
                yaxisTitle: 'Acceptability',
                legendOrder: boxPlotLegendOrder,
                traceNameMap: traceNameMap
            },
            'human-plot'
        );
        makeBoxPlot(
            meltedAI,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
            {
                title: 'Acceptability of AI Alterations',
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

    function renderSlopeChart(backendData, comparisonType, sortBy) {
        const comparisonConfig = getComparisonConfig(comparisonType);

        if (comparisonType === 'human_ai') {
            const humanMeans = backendData.meansHuman['Human'] || {};
            const aiMeans = backendData.meansAI['AI'] || {};
            const featureOrder = getFeatureOrderFromBackend(
                sortBy,
                Object.entries(humanMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score })),
                Object.entries(aiMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score }))
            );
            makeSlopeChart(
                { Human: humanMeans },
                { AI: aiMeans },
                featureOrder,
                comparisonConfig.colorMap,
                ['Human', 'AI'],
                {
                    title: 'Mean Acceptability (Human \u25cf vs AI \u25cb, individual responses shown as gray lines)',
                    legendTitle: 'Type',
                    groupOrder: ['Human', 'AI'],
                    isGrouped: false,
                    pairedData: backendData.pairedData || []
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const { groupOrder, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);
        const legendWithCounts = buildLegendLabels(backendData.groups, labelMap, backendData.groupCounts);

        const groupMeansHuman = {};
        const groupMeansAI = {};
        const groupStdsHuman = {};
        const groupStdsAI = {};

        backendData.groups.forEach(rawGroup => {
            groupMeansHuman[rawGroup] = backendData.meansHuman ? (backendData.meansHuman[rawGroup] || {}) : {};
            groupMeansAI[rawGroup] = backendData.meansAI ? (backendData.meansAI[rawGroup] || {}) : {};
            groupStdsHuman[rawGroup] = backendData.stdsHuman ? (backendData.stdsHuman[rawGroup] || {}) : {};
            groupStdsAI[rawGroup] = backendData.stdsAI ? (backendData.stdsAI[rawGroup] || {}) : {};
        });

        const featureOrder = getFeatureOrderFromBackend(
            sortBy,
            Object.entries(groupMeansHuman).flatMap(([feature, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v }))),
            Object.entries(groupMeansAI).flatMap(([feature, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v })))
        );

        makeSlopeChart(
            groupMeansHuman,
            groupMeansAI,
            featureOrder,
            colorMap,
            legendWithCounts,
            {
                title: 'Mean Acceptability (Human \u25cf vs AI \u25cb)',
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

    function renderLineChart(backendData, comparisonType, sortBy) {
        const comparisonConfig = getComparisonConfig(comparisonType);

        if (comparisonType === 'human_ai') {
            const humanMeans = backendData.means['Human'] || {};
            const aiMeans = backendData.means['AI'] || {};
            const humanStds = backendData.stdsHuman['Human'] || {};
            const aiStds = backendData.stdsAI['AI'] || {};
            const featureOrder = getFeatureOrderFromBackend(
                sortBy,
                Object.entries(humanMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score })),
                Object.entries(aiMeans).map(([Feature_Name, Numerical_Score]) => ({ Feature_Name, Numerical_Score }))
            );
            const traceNameMap = { Human: `Human (${backendData.groupCounts?.Human || 0})`, AI: `AI (${backendData.groupCounts?.AI || 0})` };
            makeLineChart(
                { Human: humanMeans, AI: aiMeans },
                featureOrder,
                comparisonConfig.colorMap,
                [traceNameMap.Human, traceNameMap.AI],
                {
                    title: 'Mean Acceptability with \u00b11 Stdev Bands (Human \u25cf vs AI \u25cb)',
                    legendTitle: 'Type',
                    traceNameMap: traceNameMap,
                    groupOrder: ['Human', 'AI'],
                    stdDevDict: { Human: humanStds, AI: aiStds }
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const { groupOrder, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);
        const legendWithCounts = buildLegendLabels(backendData.groups, labelMap, backendData.groupCounts);

        const groupMeansHuman = {};
        const groupMeansAI = {};
        const groupStdsHuman = {};
        const groupStdsAI = {};

        backendData.groups.forEach(rawGroup => {
            groupMeansHuman[rawGroup] = backendData.meansHuman ? (backendData.meansHuman[rawGroup] || {}) : {};
            groupMeansAI[rawGroup] = backendData.meansAI ? (backendData.meansAI[rawGroup] || {}) : {};
            groupStdsHuman[rawGroup] = backendData.stdsHuman ? (backendData.stdsHuman[rawGroup] || {}) : {};
            groupStdsAI[rawGroup] = backendData.stdsAI ? (backendData.stdsAI[rawGroup] || {}) : {};
        });

        const featureOrder = getFeatureOrderFromBackend(
            sortBy,
            Object.entries(groupMeansHuman).flatMap(([feature, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v }))),
            Object.entries(groupMeansAI).flatMap(([feature, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v })))
        );

        makeLineChart(
            groupMeansHuman,
            featureOrder,
            colorMap,
            legendWithCounts,
            {
                title: 'Mean Acceptability for Human Alteration (\u00b11 Stdev Bands)',
                legendTitle: 'Group',
                traceNameMap: traceNameMap,
                groupOrder: groupOrder,
                isGrouped: true,
                stdDevDict: groupStdsHuman
            },
            'human-plot'
        );
        makeLineChart(
            groupMeansAI,
            featureOrder,
            colorMap,
            legendWithCounts,
            {
                title: 'Mean Acceptability for AI Alteration (\u00b11 Stdev Bands)',
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

    function renderSwarmPlot(backendData, comparisonType, sortBy) {
        const comparisonLabel = getComparisonLabel(comparisonType);
        const comparisonConfig = getComparisonConfig(comparisonType);

        if (comparisonType === 'human_ai') {
            const combined = [];
            backendData.groups.forEach(group => {
                backendData.features.forEach(feat => {
                    (backendData.data[feat][group] || []).forEach(score => {
                        combined.push({ Feature_Name: feat, Numerical_Score: score, Type: group });
                    });
                });
            });
            const featureOrder = getFeatureOrderFromBackend(
                sortBy,
                combined.filter(r => r.Type === 'Human'),
                combined.filter(r => r.Type === 'AI')
            );
            makeSwarmPlot(
                combined,
                'Feature_Name',
                'Numerical_Score',
                'Type',
                {
                    title: 'Swarm Plot: Acceptability of Human vs AI Alterations',
                    colorMap: comparisonConfig.colorMap,
                    categoryOrders: { 'Feature_Name': featureOrder, 'Type': backendData.groups },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    traceNameMap: { Human: 'Human', AI: 'AI' }
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const { groupOrder, groupKey, colorMap, traceNameMap, labelMap } = buildGroupPresentation(comparisonType, backendData);
        const combinedHuman = [];
        const combinedAI = [];

        backendData.groups.forEach(rawGroup => {
            if (rawGroup === undefined || rawGroup === null || String(rawGroup).trim().toLowerCase() === 'nan' || String(rawGroup).trim() === '') return;
            const shortName = labelMap ? (labelMap[rawGroup] || rawGroup) : rawGroup;
            backendData.features.forEach(feat => {
                const valuesH = (backendData.dataHuman[feat] && backendData.dataHuman[feat][rawGroup]) ? backendData.dataHuman[feat][rawGroup] : [];
                valuesH.forEach(score => combinedHuman.push({ Feature_Name: feat, Numerical_Score: score, Group: rawGroup, ShortGroup: shortName }));
                const valuesA = (backendData.dataAI[feat] && backendData.dataAI[feat][rawGroup]) ? backendData.dataAI[feat][rawGroup] : [];
                valuesA.forEach(score => combinedAI.push({ Feature_Name: feat, Numerical_Score: score, Group: rawGroup, ShortGroup: shortName }));
            });
        });

        const featureOrder = getFeatureOrderFromBackend(sortBy, combinedHuman, combinedAI);
        makeSwarmPlot(
            combinedHuman,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
            {
                title: `Swarm Plot: Acceptability of Human Alterations by ${comparisonLabel}`,
                colorMap: colorMap || generateColorScale(groupOrder),
                categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                xaxisTitle: 'Type of Alteration',
                yaxisTitle: 'Acceptability',
                traceNameMap: traceNameMap
            },
            'human-plot'
        );
        makeSwarmPlot(
            combinedAI,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
            {
                title: `Swarm Plot: Acceptability of AI Alterations by ${comparisonLabel}`,
                colorMap: colorMap || generateColorScale(groupOrder),
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

    const TAB_RENDERERS = {
        alterations: renderAlterationsTab,
        contexts: renderContextsTab
    };

    function renderAlterationsTab() {
        updatePlots();
    }

    function renderContextsTab() {
        const container = document.getElementById('tab-contexts');
        if (!container) return;
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#666;font-size:1rem;">Contexts charts will be added here in a future update.</div>';
    }

    function loadTabData(tabName) {
        if (tabName === 'alterations') {
            return refreshBackendData();
        }
        // Future: replace with context-specific data loading logic when Contexts data becomes available
        return Promise.resolve();
    }

    // --- Main plot update logic ---
    function updatePlots() {
        const { chartType, comparisonType, sortBy } = getSelections();
        let showHumanPlot = true;
        let showAIPlot = false;
        if (chartType === 'box' || chartType === 'line' || chartType === 'swarm') {
            showAIPlot = comparisonType !== 'human_ai';
        }
        setPlotVisibility(showHumanPlot, showAIPlot);

        try {
            if (!backendData) {
                document.getElementById('human-plot').innerHTML = '<div style="color:red;text-align:center;padding:2em;">No data loaded from backend.</div>';
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
                return;
            }

            if (chartType === 'box') {
                renderBoxPlot(backendData, comparisonType, sortBy);
            } else if (chartType === 'slope') {
                renderSlopeChart(backendData, comparisonType, sortBy);
            } else if (chartType === 'line') {
                renderLineChart(backendData, comparisonType, sortBy);
            } else if (chartType === 'swarm') {
                renderSwarmPlot(backendData, comparisonType, sortBy);
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
    async function refreshBackendData() {
        const { chartType, comparisonType } = getSelections();
        showSpinner();
        try {
            const data = await fetchAggregatedData(chartType, comparisonType);
            validateBackendDataShape(data, chartType);
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

    document.getElementById('tab-alterations-button').addEventListener('click', function() {
        switchTab('alterations');
    });
    document.getElementById('tab-contexts-button').addEventListener('click', function() {
        switchTab('contexts');
    });

    // Only fetch data when chart-type or comparison-type changes
    document.getElementById('chart-type').addEventListener('change', refreshBackendData);
    document.getElementById('comparison-type').addEventListener('change', refreshBackendData);
    // Only re-sort and re-plot when sort-by changes (no backend call)
    document.getElementById('sort-by').addEventListener('change', function() {
        updatePlots();
    });

    // Initial tab state and load
    switchTab('alterations');

    function switchTab(tabName) {
        const tabIds = ['alterations', 'contexts'];
        tabIds.forEach(id => {
            const panel = document.getElementById(`tab-${id}`);
            const button = document.getElementById(`tab-${id}-button`);
            const isActive = id === tabName;
            if (panel) {
                panel.classList.toggle('active', isActive);
            }
            if (button) {
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            }
        });
        activeTab = tabName;
        loadTabData(tabName)
            .then(() => {
                const renderer = TAB_RENDERERS[tabName];
                if (typeof renderer === 'function') {
                    renderer();
                }
            })
            .catch(err => {
                console.error(`Error loading data for tab ${tabName}:`, err);
            });
    }

    function renderActiveTab() {
        const renderer = TAB_RENDERERS[activeTab];
        if (typeof renderer === 'function') {
            renderer();
        }
    }

});
