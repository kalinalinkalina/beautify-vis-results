document.addEventListener('DOMContentLoaded', function() {
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
    let selectedStackedGroups = new Set();
    let stackedFilterSignature = '';

    const generateColorScale = window.generateColorScale || function(legend) {
        const colors = window.DEFAULT_COLOR_PALETTE || [
            '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
            '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
        ];
        const colorMap = {};
        (legend || []).forEach((item, index) => {
            colorMap[item] = colors[index % colors.length];
        });
        return colorMap;
    };

    const getComparisonConfig = window.getComparisonConfig || function(comparisonType) {
        return (window.COMPARISON_CONFIG && window.COMPARISON_CONFIG[comparisonType]) || {
            column: null,
            label: comparisonType,
            labelMap: null,
            order: null,
            colorMap: null
        };
    };

    const getComparisonLabel = window.getComparisonLabel || function(comparisonType) {
        return getComparisonConfig(comparisonType).label || comparisonType;
    };

    const getContextViewConfig = window.getContextViewConfig || function(view) {
        return (window.CONTEXT_VIEW_CONFIG && window.CONTEXT_VIEW_CONFIG[view]) || {
            label: 'Use Cases',
            features: ['Use_Cases_1', 'Use_Cases_2', 'Use_Cases_3', 'Use_Cases_4', 'Use_Cases_5', 'Use_Cases_6'],
            responseScale: 'use_case_acceptability',
            plotTitlePrefix: 'Context',
            combineFeatures: true,
            combinedPlotTitle: 'Acceptability by Context'
        };
    };

    const getFeatureSortOrder = window.getFeatureSortOrder || function(sortBy, meltedHuman, meltedAI) {
        function groupBy(arr, key) {
            return (arr || []).reduce((acc, row) => {
                const groupKey = row[key];
                acc[groupKey] = acc[groupKey] || [];
                acc[groupKey].push(row);
                return acc;
            }, {});
        }

        function getMean(rows) {
            return rows.reduce((sum, row) => sum + (row.Numerical_Score ?? 0), 0) / rows.length;
        }

        function getMedian(rows) {
            const nums = rows.map(row => row.Numerical_Score).sort((a, b) => a - b);
            const mid = Math.floor(nums.length / 2);
            return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
        }

        if (sortBy === 'mean') {
            const grouped = groupBy([...(meltedHuman || []), ...(meltedAI || [])], 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => getMean(grouped[b]) - getMean(grouped[a]));
        }
        if (sortBy === 'human_mean') {
            const grouped = groupBy(meltedHuman, 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => getMean(grouped[b]) - getMean(grouped[a]));
        }
        if (sortBy === 'ai_mean') {
            const grouped = groupBy(meltedAI, 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => getMean(grouped[b]) - getMean(grouped[a]));
        }
        if (sortBy === 'difference') {
            const groupedH = groupBy(meltedHuman, 'Feature_Name');
            const groupedA = groupBy(meltedAI, 'Feature_Name');
            const allFeatures = Array.from(new Set([...Object.keys(groupedH), ...Object.keys(groupedA)]));
            return allFeatures.sort((a, b) => {
                const meanH_A = groupedH[a] ? getMean(groupedH[a]) : 0;
                const meanA_A = groupedA[a] ? getMean(groupedA[a]) : 0;
                const meanH_B = groupedH[b] ? getMean(groupedH[b]) : 0;
                const meanA_B = groupedA[b] ? getMean(groupedA[b]) : 0;
                return (meanH_B - meanA_B) - (meanH_A - meanA_A);
            });
        }
        if (sortBy === 'median') {
            const grouped = groupBy([...(meltedHuman || []), ...(meltedAI || [])], 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => getMedian(grouped[b]) - getMedian(grouped[a]));
        }
        if (sortBy === 'human_median') {
            const grouped = groupBy(meltedHuman, 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => getMedian(grouped[b]) - getMedian(grouped[a]));
        }
        if (sortBy === 'ai_median') {
            const grouped = groupBy(meltedAI, 'Feature_Name');
            return Object.keys(grouped).sort((a, b) => getMedian(grouped[b]) - getMedian(grouped[a]));
        }
        if (sortBy === 'difference_median') {
            const groupedH = groupBy(meltedHuman, 'Feature_Name');
            const groupedA = groupBy(meltedAI, 'Feature_Name');
            const allFeatures = Array.from(new Set([...Object.keys(groupedH), ...Object.keys(groupedA)]));
            return allFeatures.sort((a, b) => {
                const medH_A = groupedH[a] ? getMedian(groupedH[a]) : 0;
                const medA_A = groupedA[a] ? getMedian(groupedA[a]) : 0;
                const medH_B = groupedH[b] ? getMedian(groupedH[b]) : 0;
                const medA_B = groupedA[b] ? getMedian(groupedA[b]) : 0;
                return (medH_B - medA_B) - (medH_A - medA_A);
            });
        }

        return getFeatureSortOrder('mean', meltedHuman, meltedAI);
    };

    const getContextFeatureSortOrder = window.getContextFeatureSortOrder || function(sortBy, rows, fallbackFeatures) {
        const features = Array.isArray(fallbackFeatures) ? fallbackFeatures.slice() : [];
        if (!Array.isArray(rows) || rows.length === 0) {
            return features;
        }

        const grouped = rows.reduce((acc, row) => {
            const key = row.Feature_Name;
            acc[key] = acc[key] || [];
            acc[key].push(row.Numerical_Score);
            return acc;
        }, {});

        function median(values) {
            const sorted = values.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }

        const metric = (sortBy === 'median' || sortBy === 'human_median') ? 'median' : 'mean';
        const ordered = Object.keys(grouped).sort((a, b) => {
            const valuesA = grouped[a];
            const valuesB = grouped[b];
            const scoreA = metric === 'median'
                ? median(valuesA)
                : valuesA.reduce((sum, value) => sum + value, 0) / valuesA.length;
            const scoreB = metric === 'median'
                ? median(valuesB)
                : valuesB.reduce((sum, value) => sum + value, 0) / valuesB.length;
            return scoreB - scoreA;
        });

        features.forEach(feature => {
            if (!ordered.includes(feature)) {
                ordered.push(feature);
            }
        });

        return ordered;
    };

    // --- Utility: get current dropdown values ---
    function getSelections() {
        return {
            chartType: document.getElementById('chart-type').value,
            comparisonType: document.getElementById('comparison-type').value,
            sortBy: document.getElementById('sort-by').value,
            contextView: document.getElementById('context-view') ? document.getElementById('context-view').value : 'use_cases'
        };
    }

    function isContextsTab() {
        return activeTab === 'contexts';
    }

    function getStackedFilterContainer(tabName = activeTab) {
        return document.getElementById(tabName === 'contexts'
            ? 'stacked-filter-controls-contexts'
            : 'stacked-filter-controls-alterations');
    }

    function getAvailableStackedGroups(data = backendData, tabName = activeTab) {
        if (!data) return [];
        if (tabName === 'contexts' && data.contextViews) {
            return Array.from(new Set(
                Object.values(data.contextViews)
                    .flatMap(viewData => Array.isArray(viewData?.groups) ? viewData.groups : [])
                    .filter(group => group !== undefined && group !== null && String(group).trim() !== '')
            ));
        }
        return Array.isArray(data.groups)
            ? data.groups.filter(group => group !== undefined && group !== null && String(group).trim() !== '')
            : [];
    }

    function getOrderedStackedGroups(data = backendData, tabName = activeTab, comparisonType = getSelections().comparisonType) {
        const availableGroups = getAvailableStackedGroups(data, tabName);
        if (!availableGroups.length) return [];
        if (comparisonType === 'summary' || comparisonType === 'human_ai') {
            return availableGroups;
        }

        const comparisonData = (tabName === 'contexts' && data && data.contextViews)
            ? Object.values(data.contextViews).find(viewData => Array.isArray(viewData?.groups) && viewData.groups.length)
            : data;

        if (!comparisonData) {
            return availableGroups;
        }

        const groupPresentation = buildGroupPresentation(comparisonType, comparisonData);
        const ordered = (groupPresentation.groupOrder || []).filter(group => availableGroups.includes(group));
        availableGroups.forEach(group => {
            if (!ordered.includes(group)) {
                ordered.push(group);
            }
        });
        return ordered;
    }

    function syncStackedFilterState(availableGroups, tabName = activeTab, comparisonType = getSelections().comparisonType) {
        const signature = `${tabName}|${comparisonType}|${availableGroups.join('|')}`;
        if (signature !== stackedFilterSignature) {
            selectedStackedGroups = new Set(availableGroups);
            stackedFilterSignature = signature;
            return;
        }

        selectedStackedGroups = new Set(
            [...selectedStackedGroups].filter(group => availableGroups.includes(group))
        );
    }

    function getStackedFilterDisplayLabel(group, comparisonType = getSelections().comparisonType) {
        const config = getComparisonConfig(comparisonType);
        return (config.labelMap && config.labelMap[group]) || group;
    }

    function renderStackedFilterControls() {
        const { chartType, comparisonType } = getSelections();
        const container = getStackedFilterContainer();
        if (!container) return;

        if (chartType !== 'stacked' || comparisonType === 'summary' || !backendData) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const availableGroups = getOrderedStackedGroups();
        if (!availableGroups.length) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <p class="stacked-filter-label">Show variables:</p>
            <div class="stacked-filter-options">
                ${availableGroups.map(group => `
                    <label class="stacked-filter-option">
                        <input type="checkbox" class="stacked-filter-checkbox" value="${String(group).replace(/"/g, '&quot;')}" ${selectedStackedGroups.has(group) ? 'checked' : ''}>
                        <span>${getStackedFilterDisplayLabel(group)}</span>
                    </label>
                `).join('')}
            </div>
        `;
        container.style.display = 'flex';
    }

    function validateBackendDataShape(data, chartType, tabName = activeTab) {
        if (!data || typeof data !== 'object') {
            throw new Error('Backend response is not a valid object.');
        }
        if (data.error) {
            throw new Error(data.error);
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

        const optionalObjects = ['data', 'dataHuman', 'dataAI', 'means', 'meansHuman', 'meansAI', 'stds', 'stdsHuman', 'stdsAI', 'pairedData'];
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
        if (chartType === 'stacked') {
            if (typeof data.data !== 'object' || data.data === null) {
                throw new Error('Stacked bar chart response must include "data".');
            }
        }
        if (chartType === 'line') {
            if (tabName === 'contexts') {
                if (typeof data.means !== 'object' || data.means === null) {
                    throw new Error('Context line chart response must include "means".');
                }
                if (typeof data.stds !== 'object' || data.stds === null) {
                    throw new Error('Context line chart response must include "stds".');
                }
            } else {
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
            if (tabName === 'contexts') {
                if (typeof data.data !== 'object' || data.data === null) {
                    throw new Error('Context swarm plot response must include "data".');
                }
            } else {
                if (typeof data.dataHuman !== 'object' || data.dataHuman === null) {
                    throw new Error('Swarm plot response must include "dataHuman".');
                }
                if (typeof data.dataAI !== 'object' || data.dataAI === null) {
                    throw new Error('Swarm plot response must include "dataAI".');
                }
            }
        }

        return true;
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
        const displayNameMap = {};
        let colorMap;
        if (labelMap && meta.colorMap) {
            colorMap = {};
            rawGroups.forEach(rawGroup => {
                const shortName = labelMap[rawGroup] || rawGroup;
                displayNameMap[rawGroup] = shortName;
                displayNameMap[shortName] = shortName;
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
            rawGroups.forEach(rawGroup => {
                const displayName = labelMap ? (labelMap[rawGroup] || rawGroup) : rawGroup;
                displayNameMap[rawGroup] = displayName;
                displayNameMap[displayName] = displayName;
            });
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

        return { rawGroups, groupOrder, groupKey, colorMap, traceNameMap, displayNameMap };
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
        const plotIds = ['human-plot', 'ai-plot'];
        plotIds.forEach(id => {
            const plotEl = document.getElementById(id);
            if (plotEl && plotEl.offsetWidth > 0) {
                try {
                    Plotly.Plots.resize(plotEl);
                } catch (err) {
                    // ignore if plot is not initialized yet
                }
            }
        });
        document.querySelectorAll('#contexts-plots-container .context-plot').forEach(plotEl => {
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
    function buildValueRows(groups, features, getScores, buildRow) {
        const rows = [];
        groups.forEach(group => {
            features.forEach(feature => {
                const scores = getScores(group, feature) || [];
                scores.forEach(score => {
                    rows.push(buildRow({ group, feature, score }));
                });
            });
        });
        return rows;
    }

    function buildMetricRowsByGroups(groups, metricMap) {
        return (groups || []).flatMap(group => (
            Object.entries((metricMap && metricMap[group]) || {}).map(([Feature_Name, Numerical_Score]) => ({
                Feature_Name,
                Numerical_Score
            }))
        ));
    }

    function buildSummarySeriesPresentation(backendData, comparisonConfig) {
        const groupName = backendData.groups[0] || 'Summary';
        return {
            groupName,
            means: (backendData.meansHuman && backendData.meansHuman[groupName]) || {},
            stds: (backendData.stdsHuman && backendData.stdsHuman[groupName]) || {},
            traceName: `${groupName} (${backendData.groupCounts?.[groupName] || 0})`,
            colorMap: { [groupName]: comparisonConfig.colorMap ? comparisonConfig.colorMap[groupName] : '#444' }
        };
    }

    function getLegendTitleForComparison(comparisonType) {
        return getComparisonLabel(comparisonType);
    }

    function getAlterationPlotTitle(titleKey, comparisonLabel = '') {
        const titles = {
            acceptabilityHumanVsAI: 'Acceptability: Human vs AI Alterations',
            acceptabilitySummary: 'Acceptability Summary',
            acceptabilityHuman: 'Acceptability: Human Alterations',
            acceptabilityAI: 'Acceptability: AI Alterations',
            acceptabilityHumanByComparison: `Acceptability: Human Alterations by ${comparisonLabel}`,
            acceptabilityAIByComparison: `Acceptability: AI Alterations by ${comparisonLabel}`,
            meanHumanVsAI: 'Mean Acceptability: Human vs AI',
            meanSummary: 'Mean Acceptability: Summary',
            meanHuman: 'Mean Acceptability: Human Alterations',
            meanAI: 'Mean Acceptability: AI Alterations',
            meanByComparison: `Mean Acceptability: by ${comparisonLabel}`,
            distributionHumanVsAI: 'Acceptability Distribution: Human vs AI Alterations',
            distributionSummary: 'Acceptability Distribution',
            distributionHumanByComparison: `Acceptability Distribution: Human Alterations by ${comparisonLabel}`,
            distributionAIByComparison: `Acceptability Distribution: AI Alterations by ${comparisonLabel}`
        };
        return titles[titleKey] || '';
    }

    function buildGroupedMetricPresentation(comparisonType, backendData, sortBy) {
        const groupPresentation = buildGroupPresentation(comparisonType, backendData);
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

        return Object.assign({}, groupPresentation, {
            groupMeansHuman,
            groupMeansAI,
            groupStdsHuman,
            groupStdsAI,
            featureOrder: getFeatureSortOrder(
                sortBy,
                buildMetricRowsByGroups(backendData.groups, groupMeansHuman),
                buildMetricRowsByGroups(backendData.groups, groupMeansAI)
            ),
            legendOrder: groupPresentation.groupOrder.map(group => groupPresentation.traceNameMap[group] || group)
        });
    }

    function buildContextGroupPresentation(backendData, comparisonType) {
        const comparisonConfig = getComparisonConfig(comparisonType);
        const isSummary = comparisonType === 'summary';
        const groupPresentation = isSummary
            ? {
                groupOrder: backendData.groups.slice(),
                colorMap: { Summary: (comparisonConfig.colorMap && comparisonConfig.colorMap.Summary) || '#444' },
                traceNameMap: { Summary: `Summary (${backendData.groupCounts?.Summary || 0})` },
                displayNameMap: { Summary: 'Summary' }
            }
            : buildGroupPresentation(comparisonType, backendData);

        return {
            isSummary,
            groupPresentation,
            legendOrder: groupPresentation.groupOrder.map(group => groupPresentation.traceNameMap[group] || group)
        };
    }

    function renderContextPlotCollection({
        backendData,
        comparisonType,
        sortBy,
        contextView,
        renderOptions = {},
        buildRows,
        renderCombinedPlot,
        renderFeaturePlot
    }) {
        const viewConfig = getContextViewConfig(contextView);
        const { container, plotIdPrefix } = getContextRenderTarget(renderOptions);
        if (!container) return;

        const rows = buildRows(backendData);
        const featureOrder = getContextFeatureSortOrder(sortBy, rows, backendData.features);
        const { isSummary, groupPresentation, legendOrder } = buildContextGroupPresentation(backendData, comparisonType);

        if (viewConfig.combineFeatures === true) {
            container.innerHTML = `
                <div style="width:90vw;max-width:1200px;">
                    <div id="${plotIdPrefix}-combined" class="context-plot" style="width:100%;"></div>
                </div>
            `;

            renderCombinedPlot({
                backendData,
                featureOrder,
                rows,
                viewConfig,
                groupPresentation,
                legendOrder,
                isSummary,
                plotId: `${plotIdPrefix}-combined`
            });
            return;
        }

        container.innerHTML = featureOrder.map(feature => `
            <div style="width:90vw;max-width:1200px;">
                <div id="${plotIdPrefix}-${feature}" class="context-plot" style="width:100%;"></div>
            </div>
        `).join('');

        featureOrder.forEach((feature, index) => {
            renderFeaturePlot({
                backendData,
                feature,
                featureRows: rows
                    .filter(row => row.Feature_Name === feature)
                    .map(row => Object.assign({}, row)),
                featureIndex: index,
                groupPresentation,
                legendOrder,
                isSummary,
                plotId: `${plotIdPrefix}-${feature}`,
                viewConfig
            });
        });
    }

    function renderBoxPlot(backendData, comparisonType, sortBy) {
        const comparisonConfig = getComparisonConfig(comparisonType);
        const legendTitle = getLegendTitleForComparison(comparisonType);

        if (comparisonType === 'human_ai') {
            const combined = buildValueRows(
                backendData.groups,
                backendData.features,
                (group, feature) => (backendData.data[group] && backendData.data[group][feature]) || [],
                ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Type: group })
            );
            const featureOrder = getFeatureSortOrder(
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
                    title: getAlterationPlotTitle('acceptabilityHumanVsAI'),
                    colorMap: comparisonConfig.colorMap,
                    categoryOrders: { 'Feature_Name': featureOrder, 'Type': backendData.groups },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    legendTitle,
                    hoverLabel: 'Type',
                    hoverNameMap: { Human: 'Human', AI: 'AI' }
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        } else if (comparisonType === 'summary') {
            const groupName = backendData.groups[0] || 'Summary';
            const combined = buildValueRows(
                [groupName],
                backendData.features,
                (group, feature) => ((backendData.data[group] && backendData.data[group][feature]) || []),
                ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Type: group })
            );
            const featureOrder = getFeatureSortOrder(sortBy, combined, combined);
            makeBoxPlot(
                combined,
                'Feature_Name',
                'Numerical_Score',
                'Type',
                {
                    title: getAlterationPlotTitle('acceptabilitySummary'),
                    colorMap: comparisonConfig.colorMap || { [groupName]: '#444' },
                    categoryOrders: { 'Feature_Name': featureOrder, 'Type': [groupName] },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    showLegend: false
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const { groupOrder, groupKey, colorMap, traceNameMap, displayNameMap } = buildGroupPresentation(comparisonType, backendData);
        let meltedHuman = buildValueRows(
            backendData.groups,
            backendData.features,
            (group, feature) => ((backendData.data[group] && backendData.data[group][feature]) || []),
            ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Group: group })
        );
        let meltedAI = buildValueRows(
            backendData.groups,
            backendData.features,
            (group, feature) => ((backendData.data[`${group}__AI`] && backendData.data[`${group}__AI`][feature]) || []),
            ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Group: group })
        );

        if (!backendData.humanGroups) meltedHuman = meltedHuman.concat(meltedAI);
        if (!backendData.aiGroups) meltedAI = meltedAI.concat(meltedHuman);

        const featureOrder = getFeatureSortOrder(sortBy, meltedHuman, meltedAI);
        const boxPlotLegendOrder = groupOrder.map(g => traceNameMap[g]);

        makeBoxPlot(
            meltedHuman,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
                {
                    title: getAlterationPlotTitle('acceptabilityHumanByComparison', getComparisonLabel(comparisonType)),
                    colorMap: colorMap,
                    categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    legendTitle,
                    legendOrder: boxPlotLegendOrder,
                    traceNameMap: traceNameMap,
                    hoverLabel: legendTitle,
                    hoverNameMap: displayNameMap
                },
            'human-plot'
        );
        makeBoxPlot(
            meltedAI,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
                {
                    title: getAlterationPlotTitle('acceptabilityAIByComparison', getComparisonLabel(comparisonType)),
                    colorMap: colorMap,
                    categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    legendTitle,
                    legendOrder: boxPlotLegendOrder,
                    traceNameMap: traceNameMap,
                    hoverLabel: legendTitle,
                    hoverNameMap: displayNameMap
                },
            'ai-plot'
        );
        document.getElementById('human-plot').style.display = 'block';
        document.getElementById('ai-plot').style.display = 'block';
    }

    function renderSlopeChart(backendData, comparisonType, sortBy) {
        const comparisonConfig = getComparisonConfig(comparisonType);
        const legendTitle = getLegendTitleForComparison(comparisonType);

        if (comparisonType === 'human_ai') {
            const humanMeans = backendData.meansHuman['Human'] || {};
            const aiMeans = backendData.meansAI['AI'] || {};
            const featureOrder = getFeatureSortOrder(
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
                    title: getAlterationPlotTitle('meanHumanVsAI'),
                    subtitle: 'Gray lines show individual responses',
                    legendTitle,
                    hoverLabel: 'Type',
                    hoverNameMap: { Human: 'Human', AI: 'AI' },
                    groupOrder: ['Human', 'AI'],
                    isGrouped: false,
                    pairedData: backendData.pairedData || []
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        } else if (comparisonType === 'summary') {
            const summary = buildSummarySeriesPresentation(backendData, comparisonConfig);
            const featureOrder = getFeatureSortOrder(
                sortBy,
                buildMetricRowsByGroups([summary.groupName], { [summary.groupName]: summary.means }),
                buildMetricRowsByGroups([summary.groupName], { [summary.groupName]: summary.means })
            );
            makeLineChart(
                { [summary.groupName]: summary.means },
                featureOrder,
                summary.colorMap,
                [summary.traceName],
                {
                    title: getAlterationPlotTitle('meanSummary'),
                    subtitle: 'with ± 1 SD bands and outliers',
                    legendTitle: 'Summary',
                    traceNameMap: { [summary.groupName]: summary.traceName },
                    groupOrder: [summary.groupName],
                    stdDevDict: { [summary.groupName]: summary.stds },
                    outlierDict: { [summary.groupName]: backendData.outliers?.[summary.groupName] || {} },
                    showLegend: false
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const {
            groupOrder,
            colorMap,
            traceNameMap,
            displayNameMap,
            groupMeansHuman,
            groupMeansAI,
            featureOrder,
            legendOrder
        } = buildGroupedMetricPresentation(comparisonType, backendData, sortBy);

        makeSlopeChart(
            groupMeansHuman,
            groupMeansAI,
            featureOrder,
            colorMap,
            legendOrder,
                {
                    title: getAlterationPlotTitle('meanByComparison', getComparisonLabel(comparisonType)),
                    legendTitle,
                    traceNameMap: traceNameMap,
                    hoverLabel: legendTitle,
                    hoverNameMap: displayNameMap,
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
        const legendTitle = getLegendTitleForComparison(comparisonType);

        if (comparisonType === 'human_ai') {
            const humanMeans = backendData.means['Human'] || {};
            const aiMeans = backendData.means['AI'] || {};
            const humanStds = backendData.stdsHuman['Human'] || {};
            const aiStds = backendData.stdsAI['AI'] || {};
            const featureOrder = getFeatureSortOrder(
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
                    title: getAlterationPlotTitle('meanHumanVsAI'),
                    subtitle: 'with ± 1 SD bands and outliers',
                    legendTitle,
                    traceNameMap: traceNameMap,
                    hoverLabel: 'Type',
                    hoverNameMap: { Human: 'Human', AI: 'AI' },
                    groupOrder: ['Human', 'AI'],
                    stdDevDict: { Human: humanStds, AI: aiStds },
                    outlierDict: backendData.outliers || {}
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        } else if (comparisonType === 'summary') {
            const summary = buildSummarySeriesPresentation(backendData, comparisonConfig);
            const featureOrder = getFeatureSortOrder(
                sortBy,
                buildMetricRowsByGroups([summary.groupName], { [summary.groupName]: summary.means }),
                buildMetricRowsByGroups([summary.groupName], { [summary.groupName]: summary.means })
            );
            makeLineChart(
                { [summary.groupName]: summary.means },
                featureOrder,
                summary.colorMap,
                [summary.traceName],
                {
                    title: getAlterationPlotTitle('meanSummary'),
                    subtitle: 'with ± 1 SD bands and outliers',
                    legendTitle: 'Summary',
                    traceNameMap: { [summary.groupName]: summary.traceName },
                    groupOrder: [summary.groupName],
                    stdDevDict: { [summary.groupName]: summary.stds },
                    outlierDict: { [summary.groupName]: backendData.outliers?.[summary.groupName] || {} },
                    showLegend: false
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const {
            groupOrder,
            colorMap,
            traceNameMap,
            displayNameMap,
            groupMeansHuman,
            groupMeansAI,
            groupStdsHuman,
            groupStdsAI,
            featureOrder,
            legendOrder
        } = buildGroupedMetricPresentation(comparisonType, backendData, sortBy);

        makeLineChart(
            groupMeansHuman,
            featureOrder,
            colorMap,
            legendOrder,
                {
                    title: getAlterationPlotTitle('meanHuman'),
                    subtitle: 'with ± 1 SD bands and outliers',
                    legendTitle,
                    traceNameMap: traceNameMap,
                    hoverLabel: legendTitle,
                    hoverNameMap: displayNameMap,
                    groupOrder: groupOrder,
                    isGrouped: true,
                    stdDevDict: groupStdsHuman,
                    outlierDict: backendData.outliersHuman || {}
                },
            'human-plot'
        );
        makeLineChart(
            groupMeansAI,
            featureOrder,
            colorMap,
            legendOrder,
                {
                    title: getAlterationPlotTitle('meanAI'),
                    subtitle: 'with ± 1 SD bands and outliers',
                    legendTitle,
                    forceAIStyle: true,
                    traceNameMap: traceNameMap,
                    hoverLabel: legendTitle,
                    hoverNameMap: displayNameMap,
                    groupOrder: groupOrder,
                    stdDevDict: groupStdsAI,
                    outlierDict: backendData.outliersAI || {}
                },
            'ai-plot'
        );
        document.getElementById('human-plot').style.display = 'block';
        document.getElementById('ai-plot').style.display = 'block';
    }

    function renderStackedBarChart(backendData, comparisonType, sortBy) {
        const comparisonLabel = getComparisonLabel(comparisonType);
        const selectedGroups = new Set(selectedStackedGroups);
        const getVisibleGroupOrder = groups => (groups || []).filter(group => selectedGroups.has(group));

        if (comparisonType === 'human_ai') {
            const visibleGroups = getVisibleGroupOrder(backendData.groups);
            const allRows = buildValueRows(
                backendData.groups,
                backendData.features,
                (group, feature) => ((backendData.data[group] && backendData.data[group][feature]) || []),
                ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Type: group })
            );
            const combined = allRows.filter(row => selectedGroups.has(row.Type));
            if (!combined.length) {
                renderStackedEmptyState('Select at least one variable to visualize.', 'human-plot');
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
                return;
            }
            const featureOrder = getFeatureSortOrder(
                sortBy,
                allRows.filter(row => row.Type === 'Human'),
                allRows.filter(row => row.Type === 'AI')
            );
            const traceNameMap = {
                Human: `Human (${backendData.groupCounts?.Human || 0})`,
                AI: `AI (${backendData.groupCounts?.AI || 0})`
            };

            makeStackedBarChart(
                combined,
                'Feature_Name',
                'Numerical_Score',
                'Type',
                {
                    title: getAlterationPlotTitle('distributionHumanVsAI'),
                    categoryOrders: { Feature_Name: featureOrder, Type: visibleGroups },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Responses (%)',
                    traceNameMap,
                    groupLabelMap: { Human: 'Human', AI: 'AI' },
                    groupHoverLabel: 'Type'
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        if (comparisonType === 'summary') {
            const groupName = backendData.groups[0] || 'Summary';
            const visibleGroups = getVisibleGroupOrder([groupName]);
            const allRows = buildValueRows(
                [groupName],
                backendData.features,
                (group, feature) => ((backendData.data[group] && backendData.data[group][feature]) || []),
                ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Type: group })
            );
            const combined = allRows.filter(row => selectedGroups.has(row.Type));
            if (!combined.length) {
                renderStackedEmptyState('Select at least one variable to visualize.', 'human-plot');
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
                return;
            }
            const featureOrder = getFeatureSortOrder(sortBy, allRows, allRows);

            makeStackedBarChart(
                combined,
                'Feature_Name',
                'Numerical_Score',
                'Type',
                {
                    title: getAlterationPlotTitle('distributionSummary'),
                    categoryOrders: { Feature_Name: featureOrder, Type: visibleGroups },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Responses (%)',
                    traceNameMap: { [groupName]: `${groupName} (${backendData.groupCounts?.[groupName] || 0})` },
                    groupLabelMap: { [groupName]: groupName }
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const { rawGroups, groupOrder, groupKey, traceNameMap, displayNameMap } = buildGroupPresentation(comparisonType, backendData);
        const visibleGroupOrder = getVisibleGroupOrder(groupOrder);
        const allHumanRows = buildValueRows(
            rawGroups,
            backendData.features,
            (group, feature) => ((backendData.data[group] && backendData.data[group][feature]) || []),
            ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Group: group })
        );
        const allAIRows = buildValueRows(
            rawGroups,
            backendData.features,
            (group, feature) => ((backendData.data[`${group}__AI`] && backendData.data[`${group}__AI`][feature]) || []),
            ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Group: group })
        );
        const combinedHuman = allHumanRows.filter(row => selectedGroups.has(row.Group));
        const combinedAI = allAIRows.filter(row => selectedGroups.has(row.Group));
        if (!combinedHuman.length && !combinedAI.length) {
            renderStackedEmptyState('Select at least one variable to visualize.', 'human-plot');
            renderStackedEmptyState('Select at least one variable to visualize.', 'ai-plot');
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'block';
            return;
        }
        const featureOrder = getFeatureSortOrder(sortBy, allHumanRows, allAIRows);

        makeStackedBarChart(
            combinedHuman,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
                {
                    title: getAlterationPlotTitle('distributionHumanByComparison', comparisonLabel),
                    categoryOrders: { Feature_Name: featureOrder, [groupKey]: visibleGroupOrder },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Responses (%)',
                    traceNameMap,
                    groupLabelMap: displayNameMap,
                    groupHoverLabel: comparisonLabel
                },
            'human-plot'
        );
        makeStackedBarChart(
            combinedAI,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
                {
                    title: getAlterationPlotTitle('distributionAIByComparison', comparisonLabel),
                    categoryOrders: { Feature_Name: featureOrder, [groupKey]: visibleGroupOrder },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Responses (%)',
                    traceNameMap,
                    groupLabelMap: displayNameMap,
                    groupHoverLabel: comparisonLabel
                },
            'ai-plot'
        );
        document.getElementById('human-plot').style.display = 'block';
        document.getElementById('ai-plot').style.display = 'block';
    }

    function renderSwarmPlot(backendData, comparisonType, sortBy) {
        const comparisonLabel = getComparisonLabel(comparisonType);
        const comparisonConfig = getComparisonConfig(comparisonType);
        const legendTitle = getLegendTitleForComparison(comparisonType);

        if (comparisonType === 'human_ai') {
            const combined = buildValueRows(
                backendData.groups,
                backendData.features,
                (group, feature) => ((backendData.data[feature] && backendData.data[feature][group]) || []),
                ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Type: group })
            );
            const featureOrder = getFeatureSortOrder(
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
                    title: getAlterationPlotTitle('acceptabilityHumanVsAI'),
                    colorMap: comparisonConfig.colorMap,
                    categoryOrders: { 'Feature_Name': featureOrder, 'Type': backendData.groups },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    legendTitle,
                    traceNameMap: { Human: 'Human', AI: 'AI' },
                    hoverLabel: 'Type',
                    hoverNameMap: { Human: 'Human', AI: 'AI' }
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        } else if (comparisonType === 'summary') {
            const groupName = backendData.groups[0] || 'Summary';
            const combined = buildValueRows(
                [groupName],
                backendData.features,
                (group, feature) => ((backendData.data[feature] && backendData.data[feature][group]) || []),
                ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Type: group })
            );
            const featureOrder = getFeatureSortOrder(sortBy, combined, combined);
            makeSwarmPlot(
                combined,
                'Feature_Name',
                'Numerical_Score',
                'Type',
                {
                    title: getAlterationPlotTitle('acceptabilitySummary'),
                    colorMap: { [groupName]: comparisonConfig.colorMap ? comparisonConfig.colorMap[groupName] : '#444' },
                    categoryOrders: { 'Feature_Name': featureOrder, 'Type': [groupName] },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    traceNameMap: { [groupName]: groupName },
                    showLegend: false
                },
                'human-plot'
            );
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }

        const { rawGroups, groupOrder, groupKey, colorMap, traceNameMap, displayNameMap } = buildGroupPresentation(comparisonType, backendData);
        const combinedHuman = buildValueRows(
            rawGroups,
            backendData.features,
            (group, feature) => ((backendData.dataHuman[feature] && backendData.dataHuman[feature][group]) || []),
            ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Group: group })
        );
        const combinedAI = buildValueRows(
            rawGroups,
            backendData.features,
            (group, feature) => ((backendData.dataAI[feature] && backendData.dataAI[feature][group]) || []),
            ({ group, feature, score }) => ({ Feature_Name: feature, Numerical_Score: score, Group: group })
        );

        const featureOrder = getFeatureSortOrder(sortBy, combinedHuman, combinedAI);
        makeSwarmPlot(
            combinedHuman,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
                {
                    title: getAlterationPlotTitle('acceptabilityHumanByComparison', comparisonLabel),
                    colorMap: colorMap || generateColorScale(groupOrder),
                    categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    legendTitle,
                    traceNameMap: traceNameMap,
                    hoverLabel: legendTitle,
                    hoverNameMap: displayNameMap
                },
            'human-plot'
        );
        makeSwarmPlot(
            combinedAI,
            'Feature_Name',
            'Numerical_Score',
            groupKey,
                {
                    title: getAlterationPlotTitle('acceptabilityAIByComparison', comparisonLabel),
                    colorMap: colorMap || generateColorScale(groupOrder),
                    categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                    xaxisTitle: 'Type of Alteration',
                    yaxisTitle: 'Acceptability',
                    legendTitle,
                    traceNameMap: traceNameMap,
                    hoverLabel: legendTitle,
                    hoverNameMap: displayNameMap
                },
            'ai-plot'
        );
        document.getElementById('human-plot').style.display = 'block';
        document.getElementById('ai-plot').style.display = 'block';
    }

    function buildContextRows(backendData) {
        return buildValueRows(
            backendData.groups,
            backendData.features,
            (group, feature) => ((backendData.data[feature] && backendData.data[feature][group]) || []),
            ({ group, feature, score }) => ({
                Feature_Name: feature,
                Numerical_Score: score,
                Group: group
            })
        );
    }

    function buildContextMeanRows(backendData) {
        return backendData.features.flatMap(feature => (
            backendData.groups.flatMap(group => {
                const score = backendData.means[group] ? backendData.means[group][feature] : null;
                return score === null || score === undefined ? [] : [{
                    Feature_Name: feature,
                    Numerical_Score: score,
                    Group: group
                }];
            })
        ));
    }

    function renderContextError(message) {
        const container = document.getElementById('contexts-plots-container');
        if (!container) return;
        container.innerHTML = `<div style="color:red;text-align:center;padding:2em;">${message}</div>`;
    }

    function clearPlotContainers() {
        const humanPlot = document.getElementById('human-plot');
        const aiPlot = document.getElementById('ai-plot');
        const contextsContainer = document.getElementById('contexts-plots-container');
        if (humanPlot) {
            humanPlot.innerHTML = '';
            humanPlot.style.display = 'none';
        }
        if (aiPlot) {
            aiPlot.innerHTML = '';
            aiPlot.style.display = 'none';
        }
        if (contextsContainer) {
            contextsContainer.innerHTML = '';
        }
    }

    function renderStackedEmptyState(message, plotId) {
        const plot = document.getElementById(plotId);
        if (!plot) return;
        plot.innerHTML = `<div style="text-align:center;padding:2em;color:#666;">${message}</div>`;
    }

    function getContextPlotTitle(feature, viewConfig) {
        const featureLabel = getFeatureLabel(feature);
        const prefix = viewConfig.plotTitlePrefix || viewConfig.label || 'Context';
        if (featureLabel === feature) {
            return `${prefix}: ${feature}`;
        }
        return `${prefix}: ${featureLabel}`;
    }

    function getContextViewsToRender(contextView) {
        if (contextView === 'importance') {
            return ['comfort', 'importance'];
        }
        return [contextView];
    }

    function getCombinedContextPlotTitle(viewConfig) {
        if (viewConfig.combinedPlotTitle) {
            return viewConfig.combinedPlotTitle;
        }
        return viewConfig.label || 'Contexts';
    }

    function getContextRenderTarget(renderOptions = {}) {
        const container = renderOptions.container || document.getElementById('contexts-plots-container');
        const plotIdPrefix = renderOptions.plotIdPrefix || 'context-plot';
        return { container, plotIdPrefix };
    }

    function renderContextBoxPlots(backendData, comparisonType, sortBy, contextView, renderOptions = {}) {
        const legendTitle = getLegendTitleForComparison(comparisonType);
        renderContextPlotCollection({
            backendData,
            comparisonType,
            sortBy,
            contextView,
            renderOptions,
            buildRows: buildContextRows,
            renderCombinedPlot: ({ rows, featureOrder, viewConfig, groupPresentation, legendOrder, isSummary, plotId }) => {
                makeBoxPlot(
                    rows,
                    'Feature_Name',
                    'Numerical_Score',
                    'Group',
                    {
                        title: getCombinedContextPlotTitle(viewConfig),
                        colorMap: groupPresentation.colorMap,
                        categoryOrders: { Feature_Name: featureOrder, Group: groupPresentation.groupOrder },
                        xaxisTitle: '',
                        yaxisTitle: '',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        legendTitle,
                        legendOrder,
                        traceNameMap: groupPresentation.traceNameMap,
                        hoverLabel: legendTitle,
                        hoverNameMap: groupPresentation.displayNameMap,
                        showLegend: !isSummary
                    },
                    plotId
                );
            },
            renderFeaturePlot: ({ feature, featureRows, featureIndex, viewConfig, groupPresentation, legendOrder, isSummary, plotId }) => {
                makeBoxPlot(
                    featureRows,
                    'Feature_Name',
                    'Numerical_Score',
                    'Group',
                    {
                        title: getContextPlotTitle(feature, viewConfig),
                        colorMap: groupPresentation.colorMap,
                        categoryOrders: { Feature_Name: [feature], Group: groupPresentation.groupOrder },
                        xaxisTitle: '',
                        yaxisTitle: '',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        legendTitle,
                        legendOrder,
                        traceNameMap: groupPresentation.traceNameMap,
                        hoverLabel: legendTitle,
                        hoverNameMap: groupPresentation.displayNameMap,
                        showLegend: !isSummary && featureIndex === 0
                    },
                    plotId
                );
            }
        });
    }

    function renderContextLinePlots(backendData, comparisonType, sortBy, contextView, renderOptions = {}) {
        const legendTitle = getLegendTitleForComparison(comparisonType);
        renderContextPlotCollection({
            backendData,
            comparisonType,
            sortBy,
            contextView,
            renderOptions,
            buildRows: buildContextMeanRows,
            renderCombinedPlot: ({ backendData: contextData, featureOrder, viewConfig, groupPresentation, legendOrder, isSummary, plotId }) => {
                const means = {};
                const stds = {};
                groupPresentation.groupOrder.forEach(group => {
                    means[group] = contextData.means[group] || {};
                    stds[group] = contextData.stds[group] || {};
                });

                makeLineChart(
                    means,
                    featureOrder,
                    groupPresentation.colorMap,
                    legendOrder,
                    {
                        title: getCombinedContextPlotTitle(viewConfig),
                        subtitle: 'with ± 1 SD bands and outliers',
                        legendTitle,
                        traceNameMap: groupPresentation.traceNameMap,
                        hoverLabel: legendTitle,
                        hoverNameMap: groupPresentation.displayNameMap,
                        groupOrder: groupPresentation.groupOrder,
                        stdDevDict: stds,
                        outlierDict: backendData.outliers || {},
                        xaxisTitle: '',
                        yaxisTitle: '',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        showLegend: !isSummary
                    },
                    plotId
                );
            },
            renderFeaturePlot: ({ backendData: contextData, feature, featureIndex, viewConfig, groupPresentation, legendOrder, isSummary, plotId }) => {
                const means = {};
                const stds = {};
                groupPresentation.groupOrder.forEach(group => {
                    means[group] = { [feature]: contextData.means[group] ? contextData.means[group][feature] : null };
                    stds[group] = { [feature]: contextData.stds[group] ? contextData.stds[group][feature] : null };
                });

                makeLineChart(
                    means,
                    [feature],
                    groupPresentation.colorMap,
                    legendOrder,
                    {
                        title: getContextPlotTitle(feature, viewConfig),
                        subtitle: 'with ± 1 SD bands and outliers',
                        legendTitle,
                        traceNameMap: groupPresentation.traceNameMap,
                        hoverLabel: legendTitle,
                        hoverNameMap: groupPresentation.displayNameMap,
                        groupOrder: groupPresentation.groupOrder,
                        stdDevDict: stds,
                        outlierDict: backendData.outliers || {},
                        xaxisTitle: '',
                        yaxisTitle: '',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        showLegend: !isSummary && featureIndex === 0
                    },
                    plotId
                );
            }
        });
    }

    function renderContextSwarmPlots(backendData, comparisonType, sortBy, contextView, renderOptions = {}) {
        const legendTitle = getLegendTitleForComparison(comparisonType);
        renderContextPlotCollection({
            backendData,
            comparisonType,
            sortBy,
            contextView,
            renderOptions,
            buildRows: buildContextRows,
            renderCombinedPlot: ({ rows, featureOrder, viewConfig, groupPresentation, legendOrder, isSummary, plotId }) => {
                makeSwarmPlot(
                    rows,
                    'Feature_Name',
                    'Numerical_Score',
                    'Group',
                    {
                        title: getCombinedContextPlotTitle(viewConfig),
                        colorMap: groupPresentation.colorMap,
                        categoryOrders: { Feature_Name: featureOrder, Group: groupPresentation.groupOrder },
                        xaxisTitle: '',
                        yaxisTitle: '',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        legendTitle,
                        traceNameMap: groupPresentation.traceNameMap,
                        hoverLabel: legendTitle,
                        hoverNameMap: groupPresentation.displayNameMap,
                        legendOrder,
                        showLegend: !isSummary
                    },
                    plotId
                );
            },
            renderFeaturePlot: ({ feature, featureRows, featureIndex, viewConfig, groupPresentation, legendOrder, isSummary, plotId }) => {
                makeSwarmPlot(
                    featureRows,
                    'Feature_Name',
                    'Numerical_Score',
                    'Group',
                    {
                        title: getContextPlotTitle(feature, viewConfig),
                        colorMap: groupPresentation.colorMap,
                        categoryOrders: { Feature_Name: [feature], Group: groupPresentation.groupOrder },
                        xaxisTitle: '',
                        yaxisTitle: '',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        legendTitle,
                        traceNameMap: groupPresentation.traceNameMap,
                        hoverLabel: legendTitle,
                        hoverNameMap: groupPresentation.displayNameMap,
                        legendOrder,
                        showLegend: !isSummary && featureIndex === 0
                    },
                    plotId
                );
            }
        });
    }

    function renderContextStackedBarPlots(backendData, comparisonType, sortBy, contextView, renderOptions = {}) {
        const selectedGroups = new Set(selectedStackedGroups);
        const getVisibleGroupOrder = groups => (groups || []).filter(group => selectedGroups.has(group));
        renderContextPlotCollection({
            backendData,
            comparisonType,
            sortBy,
            contextView,
            renderOptions,
            buildRows: buildContextRows,
            renderCombinedPlot: ({ rows, featureOrder, viewConfig, groupPresentation, plotId }) => {
                const filteredRows = rows.filter(row => selectedGroups.has(row.Group));
                makeStackedBarChart(
                    filteredRows,
                    'Feature_Name',
                    'Numerical_Score',
                    'Group',
                    {
                        title: getCombinedContextPlotTitle(viewConfig),
                        categoryOrders: { Feature_Name: featureOrder, Group: getVisibleGroupOrder(groupPresentation.groupOrder) },
                        xaxisTitle: '',
                        yaxisTitle: 'Responses (%)',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        traceNameMap: groupPresentation.traceNameMap,
                        groupLabelMap: groupPresentation.displayNameMap,
                        groupHoverLabel: getLegendTitleForComparison(comparisonType),
                        showLegend: true
                    },
                    plotId
                );
            },
            renderFeaturePlot: ({ feature, featureRows, featureIndex, viewConfig, groupPresentation, plotId }) => {
                const filteredRows = featureRows.filter(row => selectedGroups.has(row.Group));
                makeStackedBarChart(
                    filteredRows,
                    'Feature_Name',
                    'Numerical_Score',
                    'Group',
                    {
                        title: getContextPlotTitle(feature, viewConfig),
                        categoryOrders: { Feature_Name: [feature], Group: getVisibleGroupOrder(groupPresentation.groupOrder) },
                        xaxisTitle: '',
                        yaxisTitle: 'Responses (%)',
                        xTickAngle: 15,
                        responseScale: viewConfig.responseScale,
                        traceNameMap: groupPresentation.traceNameMap,
                        groupLabelMap: groupPresentation.displayNameMap,
                        groupHoverLabel: getLegendTitleForComparison(comparisonType),
                        showLegend: featureIndex === 0
                    },
                    plotId
                );
            }
        });
    }

    function renderContextPlotsForView(backendData, comparisonType, sortBy, contextView, renderOptions = {}) {
        if (!backendData) {
            renderContextError('No data loaded from backend.');
            return;
        }

        if (comparisonType === 'human_ai') {
            renderContextError('The Human vs AI comparison is not available for contexts.');
            return;
        }

        const chartType = document.getElementById('chart-type').value;
        if (chartType === 'box') {
            renderContextBoxPlots(backendData, comparisonType, sortBy, contextView, renderOptions);
        } else if (chartType === 'stacked') {
            renderContextStackedBarPlots(backendData, comparisonType, sortBy, contextView, renderOptions);
        } else if (chartType === 'line') {
            renderContextLinePlots(backendData, comparisonType, sortBy, contextView, renderOptions);
        } else if (chartType === 'swarm') {
            renderContextSwarmPlots(backendData, comparisonType, sortBy, contextView, renderOptions);
        } else {
            renderContextError('This chart type is not available for contexts.');
        }
    }

    function renderContextPlots(backendData, comparisonType, sortBy, contextView) {
        const container = document.getElementById('contexts-plots-container');
        if (!container) return;

        const viewsToRender = getContextViewsToRender(contextView);
        if (viewsToRender.length === 1) {
            const singleViewData = backendData && backendData.contextViews ? backendData.contextViews[viewsToRender[0]] : backendData;
            renderContextPlotsForView(singleViewData, comparisonType, sortBy, viewsToRender[0]);
            return;
        }

        container.innerHTML = viewsToRender.map(view => `
            <div id="context-section-${view}" class="context-section" style="width:100%;display:flex;flex-direction:column;align-items:center;"></div>
        `).join('');

        viewsToRender.forEach(view => {
            const section = document.getElementById(`context-section-${view}`);
            const viewData = backendData && backendData.contextViews ? backendData.contextViews[view] : null;
            renderContextPlotsForView(viewData, comparisonType, sortBy, view, {
                container: section,
                plotIdPrefix: `context-plot-${view}`
            });
        });
    }

    function updateControlAvailability(tabName = activeTab, preferredControl = null) {
        const comparisonSelect = document.getElementById('comparison-type');
        const chartTypeSelect = document.getElementById('chart-type');
        const sortBySelect = document.getElementById('sort-by');
        if (!comparisonSelect || !chartTypeSelect || !sortBySelect) return;

        const humanAIOption = comparisonSelect.querySelector('option[value="human_ai"]');
        const summaryOption = comparisonSelect.querySelector('option[value="summary"]');
        const slopeOption = chartTypeSelect.querySelector('option[value="slope"]');
        const chartType = chartTypeSelect ? chartTypeSelect.value : null;
        const comparisonType = comparisonSelect ? comparisonSelect.value : null;
        const disableHumanAISorts = tabName === 'contexts' || comparisonType === 'summary';
        const disableHumanAI = tabName === 'contexts';
        const disableSummary = tabName === 'alterations' && chartType === 'slope';
        const disableSlope = tabName === 'contexts' || comparisonType === 'summary';

        function setOptionDisabled(option, isDisabled) {
            if (!option) return;
            option.disabled = isDisabled;
            if (isDisabled) {
                option.setAttribute('aria-disabled', 'true');
            } else {
                option.removeAttribute('aria-disabled');
            }
        }

        setOptionDisabled(humanAIOption, disableHumanAI);
        setOptionDisabled(summaryOption, disableSummary);
        setOptionDisabled(slopeOption, disableSlope);

        function selectFirstEnabled(selectElement) {
            const firstEnabledOption = selectElement.querySelector('option:not([disabled])');
            if (firstEnabledOption) {
                selectElement.value = firstEnabledOption.value;
                return true;
            }
            return false;
        }

        const selectedChartTypeOption = chartTypeSelect.querySelector(`option[value="${chartTypeSelect.value}"]`);
        const selectedComparisonOption = comparisonSelect.querySelector(`option[value="${comparisonSelect.value}"]`);
        const selectedChartTypeDisabled = selectedChartTypeOption && selectedChartTypeOption.disabled;
        const selectedComparisonDisabled = selectedComparisonOption && selectedComparisonOption.disabled;

        if (preferredControl === 'comparison' && selectedChartTypeDisabled && selectFirstEnabled(chartTypeSelect)) {
            updateControlAvailability(tabName);
            return;
        }

        if (preferredControl === 'chart' && selectedComparisonDisabled && selectFirstEnabled(comparisonSelect)) {
            updateControlAvailability(tabName);
            return;
        }

        const sortOptionUpdates = [
            { value: 'mean', disabled: false, label: 'Mean' },
            { value: 'human_mean', disabled: disableHumanAISorts, label: '\u00a0\u00a0Human Mean' },
            { value: 'ai_mean', disabled: disableHumanAISorts, label: '\u00a0\u00a0AI Mean' },
            { value: 'difference', disabled: disableHumanAISorts, label: '\u00a0\u00a0Difference in Means (Human - AI)' },
            { value: 'median', disabled: false, label: 'Median' },
            { value: 'human_median', disabled: disableHumanAISorts, label: '\u00a0\u00a0Human Median' },
            { value: 'ai_median', disabled: disableHumanAISorts, label: '\u00a0\u00a0AI Median' },
            { value: 'difference_median', disabled: disableHumanAISorts, label: '\u00a0\u00a0Difference in Medians (Human - AI)' }
        ];
        sortOptionUpdates.forEach(update => {
            const option = sortBySelect.querySelector(`option[value="${update.value}"]`);
            if (!option) return;
            option.disabled = update.disabled;
            option.textContent = update.label;
            if (update.disabled) {
                option.setAttribute('aria-disabled', 'true');
            } else {
                option.removeAttribute('aria-disabled');
            }
        });

        if (selectedChartTypeDisabled && selectFirstEnabled(chartTypeSelect)) {
            updateControlAvailability(tabName);
            return;
        }

        if (selectedComparisonDisabled && selectFirstEnabled(comparisonSelect)) {
            updateControlAvailability(tabName);
            return;
        }

        const selectedSortOption = sortBySelect.querySelector(`option[value="${sortBySelect.value}"]`);
        if (selectedSortOption && selectedSortOption.disabled) {
            const preferredSortOption = sortBySelect.querySelector('option[value="human_mean"]');
            sortBySelect.value = preferredSortOption ? 'human_mean' : 'mean';
        }
    }

    // --- Main plot update logic ---
    function updatePlots() {
        const { chartType, comparisonType, sortBy, contextView } = getSelections();
        renderStackedFilterControls();

        if (isContextsTab()) {
            try {
                if (chartType === 'stacked' && comparisonType !== 'summary' && selectedStackedGroups.size === 0) {
                    renderContextError('Select at least one variable to visualize.');
                    return;
                }
                renderContextPlots(backendData, comparisonType, sortBy, contextView);
                resizeVisiblePlots();
            } catch (err) {
                renderContextError(`Error updating plots: ${err.message}`);
            }
            return;
        }

        let showHumanPlot = true;
        let showAIPlot = false;
        if (chartType === 'box' || chartType === 'stacked' || chartType === 'line' || chartType === 'swarm') {
            showAIPlot = comparisonType !== 'human_ai' && comparisonType !== 'summary';
        }
        setPlotVisibility(showHumanPlot, showAIPlot);

        try {
            if (!backendData) {
                document.getElementById('human-plot').innerHTML = '<div style="color:red;text-align:center;padding:2em;">No data loaded from backend.</div>';
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
                return;
            }

            if (chartType === 'stacked' && comparisonType !== 'summary' && selectedStackedGroups.size === 0) {
                renderStackedEmptyState('Select at least one variable to visualize.', 'human-plot');
                document.getElementById('human-plot').style.display = 'block';
                if (comparisonType !== 'human_ai' && comparisonType !== 'summary') {
                    renderStackedEmptyState('Select at least one variable to visualize.', 'ai-plot');
                    document.getElementById('ai-plot').style.display = 'block';
                } else {
                    document.getElementById('ai-plot').style.display = 'none';
                }
                return;
            }

            if (chartType === 'box') {
                renderBoxPlot(backendData, comparisonType, sortBy);
            } else if (chartType === 'stacked') {
                renderStackedBarChart(backendData, comparisonType, sortBy);
            } else if ( chartType === 'slope') {
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
        } catch ( err) {
            document.getElementById('human-plot').innerHTML = `<div style="color:red;text-align:center;padding:2em;">Error updating plots: ${err.message}</div>`;
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
        }
    }

    // --- Fetch aggregated data from backend ---
    async function refreshBackendData() {
        const { chartType, comparisonType, contextView } = getSelections();
        clearPlotContainers();
        showSpinner();
        try {
            if (isContextsTab()) {
                const viewsToRender = getContextViewsToRender(contextView);
                const viewEntries = await Promise.all(viewsToRender.map(async view => {
                    const data = await fetchAggregatedData(chartType, comparisonType, {
                        tab: activeTab,
                        view
                    });
                    validateBackendDataShape(data, chartType, activeTab);
                    return [view, data];
                }));
                backendData = {
                    contextViews: Object.fromEntries(viewEntries)
                };
            } else {
                const data = await fetchAggregatedData(chartType, comparisonType, {
                    tab: activeTab,
                    view: contextView
                });
                validateBackendDataShape(data, chartType, activeTab);
                backendData = data;
            }
            syncStackedFilterState(getAvailableStackedGroups(), activeTab, comparisonType);
            updatePlots();
        } catch (err) {
            if (isContextsTab()) {
                renderContextError(`Error fetching data: ${err.message}`);
            } else {
                document.getElementById('human-plot').innerHTML = `<div style="color:red;text-align:center;padding:2em;">Error fetching data: ${err.message}</div>`;
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
            }
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
    document.getElementById('chart-type').addEventListener('change', function() {
        updateControlAvailability(activeTab, 'chart');
        refreshBackendData();
    });
    document.getElementById('comparison-type').addEventListener('change', function() {
        updateControlAvailability(activeTab, 'comparison');
        refreshBackendData();
    });
    // Only re-sort and re-plot when sort-by changes (no backend call)
    document.getElementById('sort-by').addEventListener('change', function() {
        updatePlots();
    });
    document.getElementById('context-view').addEventListener('change', refreshBackendData);
    document.getElementById('stacked-filter-controls-alterations').addEventListener('change', function(event) {
        if (!event.target.classList.contains('stacked-filter-checkbox')) return;
        const value = event.target.value;
        if (event.target.checked) {
            selectedStackedGroups.add(value);
        } else {
            selectedStackedGroups.delete(value);
        }
        renderStackedFilterControls();
        updatePlots();
    });
    document.getElementById('stacked-filter-controls-contexts').addEventListener('change', function(event) {
        if (!event.target.classList.contains('stacked-filter-checkbox')) return;
        const value = event.target.value;
        if (event.target.checked) {
            selectedStackedGroups.add(value);
        } else {
            selectedStackedGroups.delete(value);
        }
        renderStackedFilterControls();
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
        updateControlAvailability(tabName);
        refreshBackendData()
            .catch(err => {
                console.error(`Error loading data for tab ${tabName}:`, err);
            });
    }

});
