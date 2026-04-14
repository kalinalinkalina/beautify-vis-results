// Entry point for dashboard logic
// TODO: Implement data loading, cleaning, and plotting logic here

document.addEventListener('DOMContentLoaded', function() {
    // --- Constants ---
    const csvPath = 'data/data-4-13-26.csv';
    const humanAcceptabilityCols = [
        'Acceptability_Human_Smoothing', 'Acceptability_Human_Textures', 'Acceptability_Human_CamPos',
        'Acceptability_Human_Blur', 'Acceptability_Human_Details', 'Acceptability_Human_Errors',
        'Acceptability_Human_FeatureAddition', 'Acceptability_Human_FeatureOmission', 'Acceptability_Human_Gaps',
        'Acceptability_Human_Shape', 'Acceptability_Human_Lighting', 'Acceptability_Human_BgItems',
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
        // Check required columns before proceeding
        if (!checkColumnsExist(cleanedData, humanAcceptabilityCols.concat(aiAcceptabilityCols))) {
            document.getElementById('human-plot').innerHTML = '<div style="color:red;text-align:center;padding:2em;">Error: Required columns are missing from the data file.</div>';
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            return;
        }
        // Defensive: try/catch for main logic
        try {
            // Prepare grouped/melted data for the selected comparison type
            const { meltedHuman, meltedAI, groupCol } = prepareGroupedData(cleanedData, comparisonType, humanAcceptabilityCols, aiAcceptabilityCols, likertMapping);
            // Get all group values (for legend and color)
            let groupValues = [];
            if (groupCol) {
                groupValues = Array.from(new Set([...meltedHuman, ...meltedAI].map(r => r[groupCol]).filter(x => x !== undefined && x !== null && x !== '')));
            }
            const { labelMap, colorMap, order } = getGroupMeta(comparisonType, groupValues);
            // Apply display labels if needed
            function displayLabel(val) {
                if (!val) return val;
                return labelMap && labelMap[val] ? labelMap[val] : val;
            }
            // Add display label field for legend only (not for grouping/coloring)
            if (groupCol) {
                meltedHuman.forEach(r => r._displayGroup = displayLabel(r[groupCol]));
                meltedAI.forEach(r => r._displayGroup = displayLabel(r[groupCol]));
            }
            // Feature order
            const featureOrder = getFeatureSortOrder(sortBy, meltedHuman, meltedAI);
            // --- Plotting logic ---
            if (comparisonType === 'human_ai') {
                // Human vs AI (default logic)
                const sortedCombined = [...meltedHuman, ...meltedAI].sort((a, b) => featureOrder.indexOf(a.Feature_Name) - featureOrder.indexOf(b.Feature_Name));
                if (chartType === 'box') {
                    window.makeBoxPlot(
                        sortedCombined,
                        'Feature_Name',
                        'Numerical_Score',
                        'Type',
                        {
                            title: 'Acceptability of Human vs AI Alterations',
                            colorMap: { 'Human': 'peru', 'AI': 'gray' },
                            categoryOrders: { 'Feature_Name': featureOrder, 'Type': ['Human', 'AI'] },
                            xaxisTitle: 'Alteration',
                            yaxisTitle: 'Acceptability'
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else if (chartType === 'line') {
                    // Fix: Only use features present in both Human and AI, and handle nulls
                    const featuresPresent = featureOrder.filter(f =>
                        meltedHuman.some(r => r.Feature_Name === f) || meltedAI.some(r => r.Feature_Name === f)
                    );
                    const humanMeans = {};
                    const aiMeans = {};
                    featuresPresent.forEach(f => {
                        const hVals = meltedHuman.filter(r => r.Feature_Name === f).map(r => r.Numerical_Score).filter(v => v !== null && v !== undefined);
                        const aVals = meltedAI.filter(r => r.Feature_Name === f).map(r => r.Numerical_Score).filter(v => v !== null && v !== undefined);
                        humanMeans[f] = hVals.length ? hVals.reduce((a, b) => a + b, 0) / hVals.length : null;
                        aiMeans[f] = aVals.length ? aVals.reduce((a, b) => a + b, 0) / aVals.length : null;
                    });
                    window.makeLineChart(
                        { 'Human': humanMeans, 'AI': aiMeans },
                        featuresPresent,
                        { 'Human': 'peru', 'AI': 'gray' },
                        ['Human', 'AI'],
                        {
                            title: 'Mean Acceptability Scores by Feature (Human vs AI)',
                            legendTitle: 'Type'
                        },
                        'human-plot'
                    );
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                } else {
                    document.getElementById('human-plot').innerHTML = '<div style="text-align:center;padding:2em;">Not implemented yet.</div>';
                    document.getElementById('human-plot').style.display = 'block';
                    document.getElementById('ai-plot').style.display = 'none';
                }
                return;
            }
            // --- All other comparison types ---
            // Refine legend and color handling
            // Build presentGroups from cleanedData, not melted arrays, to ensure all possible groups are included
            let presentGroups = [];
            if (groupCol) {
                let groupVals = cleanedData.map(row => row[groupCol]).filter(x => x !== undefined && x !== null && x !== '');
                presentGroups = Array.from(new Set(groupVals));
            }
            // Accurate group counts: count unique rows in cleanedData for each group
            let groupCounts = {};
            if (groupCol) {
                if (comparisonType === 'domain') {
                    // For domain, explode and filter cleanedData, then count per domain
                    let exploded = explodeDomains(cleanedData, groupCol)
                        .filter(row => row[groupCol] && typeof row[groupCol] === 'string' && row[groupCol].toLowerCase() !== 'nan');
                    presentGroups = Array.from(new Set(exploded.map(row => row[groupCol])));
                    presentGroups.forEach(g => {
                        groupCounts[g] = exploded.filter(row => row[groupCol] === g).length;
                    });
                } else {
                    presentGroups.forEach(g => {
                        groupCounts[g] = cleanedData.filter(row => displayLabel(row[groupCol]) === g).length;
                    });
                }
            }
            // Build legend labels with counts
            let legendOrder = order ? order.filter(g => presentGroups.includes(g)) : presentGroups;
            presentGroups.forEach(g => { if (!legendOrder.includes(g)) legendOrder.push(g); });
            let legendLabelsWithCounts = legendOrder.map(g => `${g} (${groupCounts[g] || 0})`);
            // Map displayGroup to label with count for plotting
            let groupLabelMap = {};
            legendOrder.forEach((g, i) => { groupLabelMap[g] = legendLabelsWithCounts[i]; });
            // Update _displayGroupWithCount for legend display only (not for grouping/coloring)
            meltedHuman.forEach(r => { if (r._displayGroup) r._displayGroupWithCount = groupLabelMap[r._displayGroup]; });
            meltedAI.forEach(r => { if (r._displayGroup) r._displayGroupWithCount = groupLabelMap[r._displayGroup]; });
            // Build color map for present groups only (with counts)
            let legendColors = {};
            legendOrder.forEach((g, i) => {
                legendColors[groupLabelMap[g]] = colorMap && colorMap[g] ? colorMap[g] : (colorMap ? Object.values(colorMap)[i % Object.values(colorMap).length] : undefined);
            });
            let legendTitle = groupCol ? groupCol.replace(/_/g, ' ') : '';
            if (chartType === 'box') {
                window.makeBoxPlot(
                    meltedHuman,
                    'Feature_Name',
                    'Numerical_Score',
                    groupCol,
                    {
                        title: `Human Acceptability by ${legendTitle}`,
                        colorMap: colorMap,
                        categoryOrders: { 'Feature_Name': featureOrder, [groupCol]: legendOrder },
                        xaxisTitle: 'Alteration',
                        yaxisTitle: 'Acceptability',
                        legendOrder: legendOrder,
                        legendLabelsWithCounts: groupLabelMap // for legend display only
                    },
                    'human-plot'
                );
                window.makeBoxPlot(
                    meltedAI,
                    'Feature_Name',
                    'Numerical_Score',
                    groupCol,
                    {
                        title: `AI Acceptability by ${legendTitle}`,
                        colorMap: colorMap,
                        categoryOrders: { 'Feature_Name': featureOrder, [groupCol]: legendOrder },
                        xaxisTitle: 'Alteration',
                        yaxisTitle: 'Acceptability',
                        legendOrder: legendOrder,
                        legendLabelsWithCounts: groupLabelMap // for legend display only
                    },
                    'ai-plot'
                );
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'block';
            } else if (chartType === 'line') {
                const groupDisplay = legendLabelsWithCounts;
                const meanScoresHuman = {};
                const meanScoresAI = {};
                let markerSymbols = {};
                let forceFilledCircle = false;
                if (comparisonType === 'role') {
                    groupDisplay.forEach(label => {
                        if (label.includes('Vis Researcher')) markerSymbols[label] = 'circle';
                        else if (label.includes('Viz Practitioner')) markerSymbols[label] = 'circle';
                        else if (label.includes('Scientist who creates vis')) markerSymbols[label] = 'square';
                        else if (label.includes('Scientist who uses vis')) markerSymbols[label] = 'square';
                    });
                } else if (comparisonType === 'frequency_public') {
                    groupDisplay.forEach(label => {
                        if (label.startsWith('Never')) markerSymbols[label] = 'x';
                    });
                } else {
                    // For all other groupings, force all markers to filled circle for Human chart
                    groupDisplay.forEach(label => {
                        markerSymbols[label] = 'circle';
                    });
                    forceFilledCircle = true;
                }
                // Use display labels for legend, but filter/calculate means by RAW group value (not display label)
                // Iterate over [rawGroup, displayLabel] pairs in parallel, like Python code
                legendOrder.forEach((rawGroup, i) => {
                    const groupLabel = groupDisplay[i]; // display label with count
                    const groupRowsH = meltedHuman.filter(r => r[groupCol] === rawGroup);
                    const groupRowsA = meltedAI.filter(r => r[groupCol] === rawGroup);
                    meanScoresHuman[groupLabel] = {};
                    meanScoresAI[groupLabel] = {};
                    featureOrder.forEach(f => {
                        // Robust mean calculation: filter out null, undefined, NaN
                        const valsH = groupRowsH
                            .filter(r => r.Feature_Name === f)
                            .map(r => r.Numerical_Score)
                            .filter(x => typeof x === 'number' && !Number.isNaN(x));
                        const valsA = groupRowsA
                            .filter(r => r.Feature_Name === f)
                            .map(r => r.Numerical_Score)
                            .filter(x => typeof x === 'number' && !Number.isNaN(x));
                        meanScoresHuman[groupLabel][f] = valsH.length ? valsH.reduce((a, b) => a + b, 0) / valsH.length : null;
                        meanScoresAI[groupLabel][f] = valsA.length ? valsA.reduce((a, b) => a + b, 0) / valsA.length : null;
                    });
                });
                // Shared layout for consistent width and x-axis
                const sharedLayout = {
                    xaxis: {
                        title: 'Type of Alteration',
                        tickangle: 30,
                        tickvals: featureOrder,
                        ticktext: featureOrder.map(val => window.FEATURE_LABELS ? window.FEATURE_LABELS[val] || val : val)
                    },
                    yaxis: {
                        title: 'Acceptability',
                        tickmode: 'array',
                        tickvals: [0, 1, 2, 3, 4, 5],
                        ticktext: ["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                        range: [-0.5, 5.5]
                    },
                    height: 500,
                    margin: { r: 180 }
                };
                window.makeLineChart(
                    meanScoresHuman,
                    featureOrder,
                    legendColors,
                    groupDisplay,
                    {
                        title: `Mean Human Acceptability Scores by Feature and ${legendTitle}`,
                        legendTitle: legendTitle,
                        markerSymbols: markerSymbols,
                        sharedLayout: sharedLayout,
                        forceFilledCircle: forceFilledCircle // custom flag for plotting.js
                    },
                    'human-plot'
                );
                window.makeLineChart(
                    meanScoresAI,
                    featureOrder,
                    legendColors,
                    groupDisplay,
                    {
                        title: `Mean AI Acceptability Scores by Feature and ${legendTitle}`,
                        legendTitle: legendTitle,
                        markerSymbols: markerSymbols,
                        forceAIStyle: true,
                        sharedLayout: sharedLayout
                    },
                    'ai-plot'
                );
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'block';
            } else {
                document.getElementById('human-plot').innerHTML = '<div style="text-align:center;padding:2em;">Not implemented yet.</div>';
                document.getElementById('human-plot').style.display = 'block';
                document.getElementById('ai-plot').style.display = 'none';
            }
        } catch (err) {
            document.getElementById('human-plot').innerHTML = `<div style="color:red;text-align:center;padding:2em;">Error: ${err.message}</div>`;
            document.getElementById('human-plot').style.display = 'block';
            document.getElementById('ai-plot').style.display = 'none';
            console.error(err);
        }
    }

    // --- Load and process data ---
    Papa.parse(csvPath, {
        header: true,
        download: true,
        skipEmptyLines: true,
        complete: function(results) {
            cleanedData = window.cleanTeapotData(results.data);
            // Melt and map
            meltedHuman = window.meltAndMapAcceptability(cleanedData, humanAcceptabilityCols, likertMapping, 'Acceptability_Human_');
            meltedHuman.forEach(r => r.Type = 'Human');
            meltedAI = window.meltAndMapAcceptability(cleanedData, aiAcceptabilityCols, likertMapping, 'Acceptability_AI_');
            meltedAI.forEach(r => r.Type = 'AI');
            combinedMelted = meltedHuman.concat(meltedAI);
            updatePlots();
        }
    });

    // --- Event listeners ---
    document.getElementById('chart-type').addEventListener('change', updatePlots);
    document.getElementById('comparison-type').addEventListener('change', updatePlots);
    document.getElementById('sort-by').addEventListener('change', updatePlots);
});

