// Shared frontend plotting utilities for use by chart builder modules

/**
 * Filters out traces with falsy names or named 'trace'.
 * @param {Array<Object>} traces
 * @returns {Array<Object>} filtered traces
 */
function filterValidTraces(traces) {
    return traces.filter(t => {
        if (t.showlegend === false) return true;
        return t.name && String(t.name).toLowerCase() !== 'trace';
    });
}

/**
 * Generates axis tick values and text from a mapping.
 * @param {Array<string>} values - The values for the axis
 * @param {Object} labelMap - Mapping from value to label
 * @returns {{tickvals: Array<string>, ticktext: Array<string>}}
 */
function getAxisTicks(values, labelMap) {
    return {
        tickvals: values,
        ticktext: values.map(val => labelMap[val] || val)
    };
}

function getResponseScale(scaleKey = 'acceptability') {
    const scales = (typeof window !== 'undefined' && window.RESPONSE_SCALES) ? window.RESPONSE_SCALES : {};
    return scales[scaleKey] || scales.acceptability || {
        title: 'Acceptability',
        tickvals: [0, 1, 2, 3, 4, 5],
        ticktext: ["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
        range: [-0.5, 5.5]
    };
}

/**
 * Returns y-axis ticks and labels for the requested response scale.
 * @param {string} scaleKey
 * @returns {{tickvals: Array<number>, ticktext: Array<string>, range: Array<number>|null, title: string}}
 */
function getLikertYAxisTicks(scaleKey = 'acceptability') {
    const scale = getResponseScale(scaleKey);
    return {
        tickvals: scale.tickvals || [],
        ticktext: scale.ticktext || [],
        range: scale.range || null,
        title: scale.title || ''
    };
}

function getResponseLabelForValue(value, scaleKey = 'acceptability') {
    const scale = getResponseScale(scaleKey);
    const tickvals = Array.isArray(scale.tickvals) ? scale.tickvals : [];
    const ticktext = Array.isArray(scale.ticktext) ? scale.ticktext : [];
    const matchIndex = tickvals.findIndex(tickValue => Number(tickValue) === Number(value));
    if (matchIndex !== -1 && ticktext[matchIndex]) {
        return ticktext[matchIndex];
    }
    return value !== undefined && value !== null ? String(value) : '';
}

function getFeatureSortOrder(sortBy, meltedHuman, meltedAI) {
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
}

function getContextFeatureSortOrder(sortBy, rows, fallbackFeatures) {
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
}

/**
 * Builds Plotly traces from grouped data.
 * @param {Array<Object>} data - Data array
 * @param {string} groupCol - Column to group by
 * @param {string} x - X axis field
 * @param {string} y - Y axis field
 * @param {Object} options - { colorMap, traceType, markerOptions, traceNameMap }
 * @returns {Array<Object>} traces
 */
function buildTracesFromGroups(data, groupCol, x, y, options = {}) {
    const {
        colorMap = {},
        traceType = 'box',
        markerOptions = {},
        traceNameMap = {},
        hoverNameMap = {},
        hoverLabel = 'Group',
        responseScale = 'acceptability',
        showLegend = true
    } = options;
    const groups = [...new Set(data.map(row => row[groupCol]))];
    const scaleTitle = getResponseScale(responseScale).title || 'Value';
    const includeGroupLine = groups.length > 1;
    return groups.map(group => {
        const groupData = data.filter(row => row[groupCol] === group);
        const traceName = traceNameMap[group] || group;
        const hoverName = hoverNameMap[group] || group;
        const marker = markerOptions[group] || { color: colorMap[group] || undefined };
        if (traceType === 'box') {
            return {
                y: groupData.map(row => row[y]),
                x: groupData.map(row => row[x]),
                name: traceName,
                type: 'box',
                marker: marker,
                boxpoints: 'outliers',
                hoverinfo: 'skip',
                boxmean: false,
                line: { width: 2 },
                median: { line: { width: 6 } },
                offsetgroup: traceName,
                legendgroup: traceName,
                showlegend: showLegend
            };
        } else if (traceType === 'line') {
            return {
                x: groupData.map(row => row[x]),
                y: groupData.map(row => row[y]),
                name: traceName,
                mode: 'lines+markers',
                marker: marker,
                line: { color: colorMap[group] || undefined, width: 2 },
                connectgaps: true,
                showlegend: showLegend
            };
        }
        return null;
    }).filter(Boolean);
}

function calculateQuantile(values, quantile) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const position = (sorted.length - 1) * quantile;
    const base = Math.floor(position);
    const remainder = position - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + remainder * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
}

function buildBoxHoverTraces(data, groupCol, x, y, options = {}) {
    const {
        traceNameMap = {},
        hoverNameMap = {},
        hoverLabel = 'Group',
        responseScale = 'acceptability'
    } = options;
    const includeGroupLine = [...new Set(data.map(row => row[groupCol]))].length > 1;
    const groupedRows = data.reduce((acc, row) => {
        const key = `${row[groupCol]}|||${row[x]}`;
        acc[key] = acc[key] || [];
        acc[key].push(row);
        return acc;
    }, {});

    return Object.entries(groupedRows).flatMap(([key, rows]) => {
        const [group, feature] = key.split('|||');
        const values = rows
            .map(row => Number(row[y]))
            .filter(value => !Number.isNaN(value));
        if (!values.length) return [];

        const min = Math.min(...values);
        const max = Math.max(...values);
        const q1 = calculateQuantile(values, 0.25);
        const median = calculateQuantile(values, 0.5);
        const q3 = calculateQuantile(values, 0.75);
        const hoverName = hoverNameMap[group] || group;
        const featureLabel = getFeatureLabel(feature);
        const traceName = traceNameMap[group] || group;
        const customdata = [[featureLabel, hoverName, min, q1, median, q3, max, values.length]];
        const hovertemplate = includeGroupLine
            ? `<b>%{customdata[0]}</b><br>${hoverLabel}: %{customdata[1]}<br>N: %{customdata[7]}<br>Max: %{customdata[6]:.2f}<br>Q3: %{customdata[5]:.2f}<br>Median: %{customdata[4]:.2f}<br>Q1: %{customdata[3]:.2f}<br>Min: %{customdata[2]:.2f}<extra></extra>`
            : `<b>%{customdata[0]}</b><br>N: %{customdata[7]}<br>Max: %{customdata[6]:.2f}<br>Q3: %{customdata[5]:.2f}<br>Median: %{customdata[4]:.2f}<br>Q1: %{customdata[3]:.2f}<br>Min: %{customdata[2]:.2f}<extra></extra>`;

        const segments = [
            { base: min, value: q1 - min, width: 0.08 },
            { base: q1, value: Math.max(median - q1, 0.001), width: 0.34 },
            { base: median, value: Math.max(q3 - median, 0.001), width: 0.34 },
            { base: q3, value: max - q3, width: 0.08 }
        ].filter(segment => segment.value > 0);

        return segments.map(segment => ({
            type: 'bar',
            x: [feature],
            y: [segment.value],
            base: segment.base,
            width: segment.width,
            offsetgroup: traceName,
            alignmentgroup: traceName,
            legendgroup: traceName,
            marker: {
                color: 'rgba(0,0,0,0)',
                line: { color: 'rgba(0,0,0,0)', width: 0 }
            },
            customdata,
            hovertemplate,
            showlegend: false
        }));
    });
}

// Export for use by chart builder modules
if (typeof window !== 'undefined') {
    window.getResponseScale = getResponseScale;
    window.getResponseLabelForValue = getResponseLabelForValue;
    window.filterValidTraces = filterValidTraces;
    window.getAxisTicks = getAxisTicks;
    window.getLikertYAxisTicks = getLikertYAxisTicks;
    window.getFeatureSortOrder = getFeatureSortOrder;
    window.getContextFeatureSortOrder = getContextFeatureSortOrder;
    window.buildTracesFromGroups = buildTracesFromGroups;
    window.buildBoxHoverTraces = buildBoxHoverTraces;
}
