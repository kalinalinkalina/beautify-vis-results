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
    const csvPath = 'data/data-4-13-26.csv';
    const humanAcceptabilityCols = [
            // Custom legend removed per user request
        'Acceptability_Human_BgImage', 'Acceptability_Human_Position', 'Acceptability_Human_Color'
    ];
    const aiAcceptabilityCols = [
        'Acceptability_AI_Smoothing', 'Acceptability_AI_Textures', 'Acceptability_AI_CamPos',
        'Acceptability_AI_Blur', 'Acceptability_AI_Details', 'Acceptability_AI_Errors',
        'Acceptability_AI_FeatureAddition', 'Acceptability_AI_FeatureOmission', 'Acceptability_AI_Gaps',
        'Acceptability_AI_Shape', 'Acceptability_AI_Lighting', 'Acceptability_AI_BgItems',
        'Acceptability_AI_BgImage', 'Acceptability_AI_Position', 'Acceptability_AI_Color'
    ];
    const likertMapping = {
        "Never acceptable": 0, "Rarely acceptable": 1, "Sometimes acceptable": 2,
        "Often acceptable": 3, "Usually acceptable": 4, "Always acceptable": 5
    };

    // --- State ---
    let cleanedData = [];
    let meltedHuman = [];
    let meltedAI = [];
    let combinedMelted = [];

    // --- Group label, color, and order mappings ---
    const GROUP_METADATA = {
        role: {
            labelMap: {
                "Creating visualizations is the primary role I perform in my work": "Viz Practitioner",
                "I work with visualizations created by others, but I do not create or research visualization myself": "Scientist who uses vis",
                "Researching visualization methods/techniques is my primary role": "Vis Researcher",
                "I create visualizations to help me in my primary role, which is not visualization-related": "Scientist who creates vis"
            },
            colorMap: {
                "Vis Researcher": 'red',
                "Viz Practitioner": 'orange',
                "Scientist who creates vis": 'blue',
                "Scientist who uses vis": 'green'
            },
            order: ["Vis Researcher", "Viz Practitioner", "Scientist who creates vis", "Scientist who uses vis"]
        },
        experience: {
            labelMap: null,
            colorMap: {
                "Less than 1 year": "#5ec962", "1-3 years": "#3fbc73", "3-5 years": "#21918c", "5-10 years": "#31688e", "10-20 years": "#443983", "More than 20 years": "#440154"
            },
            order: ["Less than 1 year", "1-3 years", "3-5 years", "5-10 years", "10-20 years", "More than 20 years"]
        },
        frequency_vis: {
            labelMap: null,
            colorMap: {
                "Less than once a year": "#5ec962", "Annually": "#27ad81", "Monthly": "#21918c", "Weekly": "#3b528b", "Daily": "#440154"
            },
            order: ["Less than once a year", "Annually", "Monthly", "Weekly", "Daily"]
        },
        frequency_public: {
            labelMap: null,
            colorMap: {
                "Never": "#e07b7b", "Rarely": "#27ad81", "Occasionally": "#21918c", "Frequently": "#3b528b", "This is a primary part of my work": "#440154"
            },
            order: ["Never", "Rarely", "Occasionally", "Frequently", "This is a primary part of my work"]
        },
        age: {
            labelMap: null,
            colorMap: {
                "18-24": "#5ec962", "25-34": "#3fbc73", "35-44": "#21918c", "45-54": "#31688e", "55-64": "#443983", "65+": "#440154"
            },
            order: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
        },
        tool_use: {
            labelMap: null,
            colorMap: { "Yes": "#1976d2", "Maybe": "#8e24aa", "No": "#d32f2f" },
            order: ["Yes", "Maybe", "No"]
        },
        domain: {
            labelMap: null, // handled dynamically
            colorMap: null, // handled dynamically
            order: null
        }
    };

    // --- Utility: explode domains ---
    function explodeDomains(data, domainsCol = "Domains") {
        return window.preprocessDomainsColumn(data, domainsCol);
    }

    // --- Utility: group and melt data by comparison type ---
    function prepareGroupedData(cleanedData, comparisonType, humanAcceptabilityCols, aiAcceptabilityCols, likertMapping) {
        let groupCol = null;
        let data = cleanedData;
        if (comparisonType === "role") groupCol = "Vis_Role";
        else if (comparisonType === "experience") groupCol = "Vis_Length";
        else if (comparisonType === "frequency_vis") groupCol = "Vis_Frequency";
        else if (comparisonType === "frequency_public") groupCol = "Public_Frequency";
        else if (comparisonType === "domain") {
            groupCol = "Domains";
            // Explode and filter out empty/nan domains before melting
            data = explodeDomains(cleanedData, groupCol)
                .filter(row => row[groupCol] && typeof row[groupCol] === 'string' && row[groupCol].toLowerCase() !== 'nan');
        } else if (comparisonType === "age") groupCol = "Age";
        else if (comparisonType === "tool_use") groupCol = "Tool_use";

        // Melt and map
        const meltedHuman = window.meltAndMapAcceptability(data, humanAcceptabilityCols, likertMapping, 'Acceptability_Human_', groupCol);
        meltedHuman.forEach(r => r.Type = 'Human');
        const meltedAI = window.meltAndMapAcceptability(data, aiAcceptabilityCols, likertMapping, 'Acceptability_AI_', groupCol);
        meltedAI.forEach(r => r.Type = 'AI');
        return { meltedHuman, meltedAI, groupCol };
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
        const meta = GROUP_METADATA[comparisonType] || {};
        let labelMap = meta.labelMap || null;
        let colorMap = meta.colorMap || null;
        let order = meta.order || null;
        // For domain, generate color map and order dynamically
        if (comparisonType === 'domain' && groupValues) {
            // Use Plotly qualitative colors
            const pxColors = [
                '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52',
                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
            ];
            order = groupValues.slice();
            colorMap = {};
            order.forEach((g, i) => { colorMap[g] = pxColors[i % pxColors.length]; });
        }
        return { labelMap, colorMap, order };
    }

    // --- Utility: check required columns exist ---
    function checkColumnsExist(data, columns) {
        if (!data.length) return false;
        return columns.every(col => col in data[0]);
    }

    // --- Main plot update logic ---
    function updatePlots() {
        const { chartType, comparisonType, sortBy } = getSelections();
        // Defensive: try/catch for main logic
        try {
            // --- Use backendData structure only ---
            const { chartType, comparisonType } = getSelections();
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
                            colorMap: { 'Human': 'peru', 'AI': 'gray' },
                            categoryOrders: { 'Feature_Name': featureOrder, 'Type': backendData.groups },
                            xaxisTitle: 'Alteration',
                            yaxisTitle: 'Acceptability'
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else {
                    // --- Dual plot logic for all other comparison types ---
                    let meltedHuman = [];
                    let meltedAI = [];
                    let groupOrder = backendData.groups;
                    let groupKey = 'Group';
                    let labelMap = null;
                    let colorMapRaw = null;
                    let colorMap = {};
                    let order = null;
                    if (GROUP_METADATA[comparisonType]) {
                        labelMap = GROUP_METADATA[comparisonType].labelMap;
                        colorMapRaw = GROUP_METADATA[comparisonType].colorMap;
                        order = GROUP_METADATA[comparisonType].order;
                    }
                    // Build melted data for Human and AI
                    backendData.groups.forEach(group => {
                        backendData.features.forEach(feat => {
                            (backendData.data[group][feat] || []).forEach(score => {
                                let shortName = labelMap && labelMap[group] ? labelMap[group] : group;
                                let entryH = {
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Group: group
                                };
                                let entryA = {
                                    Feature_Name: feat,
                                    Numerical_Score: score,
                                    Group: group
                                };
                                if (labelMap) {
                                    entryH.ShortGroup = shortName;
                                    entryA.ShortGroup = shortName;
                                }
                                // Human data
                                if (backendData.humanGroups && backendData.humanGroups.includes(group)) {
                                    meltedHuman.push(entryH);
                                }
                                // AI data
                                if (backendData.aiGroups && backendData.aiGroups.includes(group)) {
                                    meltedAI.push(entryA);
                                }
                            });
                        });
                    });
                    // Fallback if humanGroups/aiGroups not present (legacy)
                    if (!backendData.humanGroups) meltedHuman = meltedHuman.concat(meltedAI);
                    if (!backendData.aiGroups) meltedAI = meltedAI.concat(meltedHuman);
                    // Build groupOrder, groupLabelMap, and colorMap for all groups
                    // Build legend labels with counts
                    let groupLabelMap = {};
                    
                    if (labelMap) {
                        // Apply label mapping and respect predefined order
                        const shortNames = backendData.groups
                            .filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '')
                            .map(g => labelMap && labelMap[g] ? labelMap[g] : g);
                        
                        // Start with predefined order if available, then add any missing
                        let orderedNames = [];
                        if (order) {
                            orderedNames = order.filter(name => shortNames.includes(name));
                            shortNames.forEach(name => {
                                if (!orderedNames.includes(name)) orderedNames.push(name);
                            });
                        } else {
                            orderedNames = shortNames;
                        }
                        
                        groupOrder = orderedNames;
                        groupKey = 'ShortGroup';
                        backendData.groups.forEach((g, i) => {
                            if (g === undefined || g === null || String(g).trim().toLowerCase() === 'nan' || String(g).trim() === '') return;
                            const label = labelMap && labelMap[g] ? labelMap[g] : g;
                            const count = backendData.groupCounts && backendData.groupCounts[g] !== undefined ? backendData.groupCounts[g] : 0;
                            groupLabelMap[label] = `${label} (${count})`;
                        });
                    } else {
                        // No label mapping, but respect predefined order if available
                        const validGroups = backendData.groups
                            .filter(g => g !== undefined && g !== null && String(g).trim().toLowerCase() !== 'nan' && String(g).trim() !== '');
                        
                        let orderedGroups = [];
                        if (order) {
                            orderedGroups = order.filter(name => validGroups.includes(name));
                            validGroups.forEach(name => {
                                if (!orderedGroups.includes(name)) orderedGroups.push(name);
                            });
                        } else {
                            orderedGroups = validGroups;
                        }
                        
                        groupOrder = orderedGroups;
                        groupKey = groupKey || 'Group';
                        backendData.groups.forEach((g, i) => {
                            if (g === undefined || g === null || String(g).trim().toLowerCase() === 'nan' || String(g).trim() === '') return;
                            const count = backendData.groupCounts && backendData.groupCounts[g] !== undefined ? backendData.groupCounts[g] : 0;
                            groupLabelMap[g] = `${g} (${count})`;
                        });
                    }
                    groupOrder.forEach((g, i) => {
                        if (colorMapRaw && colorMapRaw[g]) {
                            colorMap[g] = colorMapRaw[g];
                        } else {
                            const pxColors = [
                                '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52',
                                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
                            ];
                            colorMap[g] = pxColors[i % pxColors.length];
                        }
                    });
                    // Sort features for plotting
                    const featureOrder = getFeatureSortOrder(sortBy, meltedHuman, meltedAI);
                    
                    // Build legend order with counts for box plots
                    const boxPlotLegendOrder = groupOrder.map(g => groupLabelMap[g]);
                    
                    window.makeBoxPlot(
                        meltedHuman,
                        'Feature_Name',
                        'Numerical_Score',
                        groupKey,
                        {
                            title: `Human Acceptability by Group`,
                            colorMap: colorMap,
                            categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                            xaxisTitle: 'Alteration',
                            yaxisTitle: 'Acceptability',
                            legendOrder: boxPlotLegendOrder,
                            traceNameMap: groupLabelMap
                        },
                        'human-plot'
                    );
                    window.makeBoxPlot(
                        meltedAI,
                        'Feature_Name',
                        'Numerical_Score',
                        groupKey,
                        {
                            title: `AI Acceptability by Group`,
                            colorMap: colorMap,
                            categoryOrders: { 'Feature_Name': featureOrder, [groupKey]: groupOrder },
                            xaxisTitle: 'Alteration',
                            yaxisTitle: 'Acceptability',
                            legendOrder: boxPlotLegendOrder,
                            traceNameMap: groupLabelMap
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
                        { 'Human': 'peru', 'AI': 'gray' },
                        ['Human', 'AI'],
                        {
                            title: 'Mean Acceptability Scores by Feature (Human vs AI)',
                            legendTitle: 'Type',
                            groupOrder: ['Human', 'AI'],
                            isGrouped: false
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else {
                    // --- Slope chart logic for all other comparison types ---
                    let groupMeansHuman = {};
                    let groupMeansAI = {};
                    let legend = backendData.groups;
                    let legendWithCounts = [];
                    let colorMap = {};
                    let labelMap = null;
                    let colorMapRaw = null;
                    let order = null;
                    if (GROUP_METADATA[comparisonType]) {
                        labelMap = GROUP_METADATA[comparisonType].labelMap;
                        colorMapRaw = GROUP_METADATA[comparisonType].colorMap;
                        order = GROUP_METADATA[comparisonType].order;
                    }
                    
                    // Build legend with proper order and counts
                    if (labelMap) {
                        // Apply label mapping and respect predefined order
                        const shortNames = backendData.groups.map(g => labelMap && labelMap[g] ? labelMap[g] : g);
                        
                        // Start with predefined order if available, then add any missing
                        let orderedNames = [];
                        if (order) {
                            orderedNames = order.filter(name => shortNames.includes(name));
                            shortNames.forEach(name => {
                                if (!orderedNames.includes(name)) orderedNames.push(name);
                            });
                        } else {
                            orderedNames = shortNames;
                        }
                        
                        legend = orderedNames;
                        orderedNames.forEach((shortName, i) => {
                            // Find the raw group name for this short name
                            const rawGroup = backendData.groups.find(g => labelMap && labelMap[g] === shortName);
                            const count = backendData.groupCounts && backendData.groupCounts[rawGroup] !== undefined ? backendData.groupCounts[rawGroup] : 0;
                            legendWithCounts.push(`${shortName} (${count})`);
                            
                            groupMeansHuman[shortName] = backendData.meansHuman ? (backendData.meansHuman[rawGroup] || {}) : {};
                            groupMeansAI[shortName] = backendData.meansAI ? (backendData.meansAI[rawGroup] || {}) : {};
                        });
                    } else {
                        // No label mapping, but respect predefined order if available
                        let orderedGroups = [];
                        if (order) {
                            orderedGroups = order.filter(name => backendData.groups.includes(name));
                            backendData.groups.forEach(name => {
                                if (!orderedGroups.includes(name)) orderedGroups.push(name);
                            });
                        } else {
                            orderedGroups = backendData.groups;
                        }
                        
                        legend = orderedGroups;
                        orderedGroups.forEach(group => {
                            const count = backendData.groupCounts && backendData.groupCounts[group] !== undefined ? backendData.groupCounts[group] : 0;
                            legendWithCounts.push(`${group} (${count})`);
                            
                            groupMeansHuman[group] = backendData.meansHuman ? (backendData.meansHuman[group] || {}) : {};
                            groupMeansAI[group] = backendData.meansAI ? (backendData.meansAI[group] || {}) : {};
                        });
                    }
                    
                    // Always ensure colorMap covers all legend entries
                    legend.forEach((g, i) => {
                        if (colorMapRaw && colorMapRaw[g]) {
                            colorMap[g] = colorMapRaw[g];
                        } else {
                            const pxColors = [
                                '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52',
                                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
                            ];
                            colorMap[g] = pxColors[i % pxColors.length];
                        }
                    });
                    // Sort features for plotting
                    // Use meansHuman and meansAI to build arrays for getFeatureSortOrder
                    const featureOrder = getFeatureSortOrder(sortBy,
                        Object.entries(backendData.meansHuman || {}).flatMap(([Feature_Name, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v }))),
                        Object.entries(backendData.meansAI || {}).flatMap(([Feature_Name, obj]) => Object.entries(obj).map(([f, v]) => ({ Feature_Name: f, Numerical_Score: v })))
                    );
                    // Build traceNameMap for legend labels with counts
                    const traceNameMap = {};
                    legend.forEach(group => {
                        const rawGroup = labelMap ? backendData.groups.find(g => labelMap[g] === group) : group;
                        const count = backendData.groupCounts && backendData.groupCounts[rawGroup] !== undefined ? backendData.groupCounts[rawGroup] : 0;
                        traceNameMap[group] = `${group} (${count})`;
                    });
                    window.makeSlopeChart(
                        groupMeansHuman,
                        groupMeansAI,
                        featureOrder,
                        colorMap,
                        legendWithCounts,
                        {
                            title: `Mean Acceptability Scores by Feature and Group (Human ● vs AI)`,
                            legendTitle: 'Group',
                            groupOrder: legend,
                            traceNameMap: traceNameMap, // Pass traceNameMap
                            isGrouped: true
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                }
            } else {
                document.getElementById('human-plot').innerHTML = '<div style="text-align:center;padding:2em;">Not implemented yet.</div>';
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
            }
        } catch (err) {
            document.getElementById('human-plot').innerHTML = `<div style=\"color:red;text-align:center;padding:2em;\">Error: ${err.message}</div>`;
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            console.error(err);
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
const API_URL = 'https://script.google.com/macros/s/AKfycbyX_yBZrP_9zrOmt24QXSI0i44BEYxSHXHC3ojoHjk7OBLmsOu2CSlQ1O8flpzs5wOq/exec';

