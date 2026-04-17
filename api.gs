/**
 * doGet(e)
 * API endpoint for returning ONLY AGGREGATED DATA (never raw data) for IRB compliance.
 *
 * Query Parameters:
 *   chartType: 'box' | 'line' | 'slope' | 'swarm' (default: 'box')
 *   comparisonType: e.g., 'summary', 'human_ai', 'role', etc. (default: 'summary')
 *
 * Returns:
 *   JSON object with only aggregated data (box plot, line chart, slope chart, or swarm chart aggregations).
 *   Never returns raw or row-level data.
 *
 * IRB Compliance: This endpoint is guaranteed to never expose raw data.
 */
function doGet(e) {
  // Spreadsheet and sheet setup
  const ss = SpreadsheetApp.openById('1qF70DWA3s3qLGf75CR4OO-H7T4X5lEJrs991F57PDI4');
  const sheet = ss.getSheetByName('Sheet1');
  const values = sheet.getDataRange().getValues();

  // Query parameters
  const chartType = e.parameter.chartType || 'box';
  const comparisonType = e.parameter.comparisonType || 'summary';
  const tab = e.parameter.tab || 'alterations';
  const view = e.parameter.view || 'importance';
  const callback = e.parameter.callback;
  const callbackName = callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback) ? callback : null;

  // Clean and structure data
  const data = cleanData(values);

  // Aggregation (NO RAW DATA RETURNED)
  let result = {};
  if (tab === 'contexts') {
    if (comparisonType === 'human_ai') {
      result = { error: 'The Human vs AI comparison is not available for contexts.' };
    } else if (chartType === 'slope') {
      result = { error: 'Slope charts are not available for contexts.' };
    } else if (chartType === 'box') {
      result = aggregateContextBoxPlot(data, comparisonType, view);
    } else if (chartType === 'line') {
      result = aggregateContextLineChart(data, comparisonType, view);
    } else if (chartType === 'swarm') {
      result = aggregateContextSwarmPlot(data, comparisonType, view);
    } else {
      result = { error: 'Chart type not implemented.' };
    }
  } else if (chartType === 'box') {
    result = aggregateBoxPlot(data, comparisonType);
  } else if (chartType === 'line') {
    result = aggregateLineChart(data, comparisonType);
  } else if (chartType === 'slope') {
    result = aggregateSlopeChart(data, comparisonType);
  } else if (chartType === 'swarm') { // Add swarm chart type
    result = aggregateSwarmPlot(data, comparisonType);
  } else {
    result = {error: 'Chart type not implemented.'};
  }

  if (result && Array.isArray(result) && chartType !== 'swarm') { // Allow array for swarm
    return ContentService
      .createTextOutput(JSON.stringify({error: 'Raw data access is forbidden by IRB policy.'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const json = JSON.stringify(result);
  if (callbackName) {
    return ContentService
      .createTextOutput(`${callbackName}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Shared aggregation metadata ---
const FEATURES = [
  'Smoothing', 'Textures', 'CamPos', 'Blur', 'Details', 'Errors',
  'FeatureAddition', 'FeatureOmission', 'Gaps', 'Shape', 'Lighting',
  'BgItems', 'BgImage', 'Position', 'Color'
];

const LIKERT_MAP = {
  'Never acceptable': 0, 'Rarely acceptable': 1, 'Sometimes acceptable': 2,
  'Often acceptable': 3, 'Usually acceptable': 4, 'Always acceptable': 5,
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5
};

const USE_CASE_LIKERT_MAP = {
  'Never acceptable': 0, 'Rarely acceptable': 1, 'Sometimes acceptable': 2,
  'Often acceptable': 3, 'Always acceptable': 4,
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4
};

const CONTEXT_VIEW_CONFIG = {
  use_cases: {
    features: ['Use_Cases_1', 'Use_Cases_2', 'Use_Cases_3', 'Use_Cases_4', 'Use_Cases_5', 'Use_Cases_6'],
    valueMap: USE_CASE_LIKERT_MAP
  },
  comfort: {
    features: ['Comfort_1', 'Comfort_2', 'Comfort_3', 'Comfort_4'],
    valueMap: {
      'Not at all important': 0,
      'Slightly important': 1,
      'Moderately important': 2,
      'Very important': 3,
      'Extremely important': 4,
      0: 0, 1: 1, 2: 2, 3: 3, 4: 4
    }
  },
  importance: {
    features: ['Importance_1', 'Importance_2'],
    valueMap: {
      'Not at all': 0,
      'Slightly': 1,
      'Moderately': 2,
      'Very much': 3,
      'Extremely': 4,
      0: 0, 1: 1, 2: 2, 3: 3, 4: 4
    }
  }
};

const COMPARISON_CONFIG = {
  summary: { column: null, label: 'Summary' },
  human_ai: { column: null, label: 'Human vs AI' },
  role: { column: 'Vis_Role', label: 'Role' },
  experience: { column: 'Vis_Length', label: 'Years of vis experience' },
  frequency_vis: { column: 'Vis_Frequency', label: 'Frequency of visualization' },
  frequency_public: { column: 'Public_Frequency', label: 'Frequency of vis for public communication' },
  domain: { column: 'Domains', label: 'Domain' },
  age: { column: 'Age', label: 'Age' },
  tool_use: { column: 'Tool_use', label: 'Would use an AI tool for beautification' }
};

function getComparisonColumn(comparisonType) {
  return (COMPARISON_CONFIG[comparisonType] && COMPARISON_CONFIG[comparisonType].column) || comparisonType;
}

function getComparisonLabel(comparisonType) {
  return (COMPARISON_CONFIG[comparisonType] && COMPARISON_CONFIG[comparisonType].label) || comparisonType;
}

/**
 * API Documentation:
 *
 * GET endpoint (doGet):
 *   - chartType: 'box', 'line', or 'slope'
 *   - comparisonType: 'human_ai', 'summary', 'role', 'experience', 'frequency_vis', 'frequency_public', 'domain', 'age', 'tool_use'
 *
 * Returns:
 *   For 'box': { features, groups, data, humanGroups, aiGroups, groupCounts }
 *   For 'line': { features, groups, means, meansHuman, meansAI, stdsHuman, stdsAI, groupCounts }
 *   For 'slope': { features, groups, meansHuman, meansAI, groupCounts, pairedData }
 *   For 'swarm': { features, groups, data, dataHuman, dataAI, humanGroups, aiGroups, groupCounts }
 *
 * This API will NEVER return raw or row-level data, in compliance with IRB requirements.
 */
function cleanData(values) {
  const header = values[0];
  const rows = values.slice(1);
  const contextCols = Object.keys(CONTEXT_VIEW_CONFIG).flatMap(key => CONTEXT_VIEW_CONFIG[key].features);

  // Column indices
  const idx = {};
  header.forEach((col, i) => { idx[col] = i; });

  // Remove rows based on consent, age, role, weeder, and empty survey
  const cleaned = rows.filter(row => {
    if (row[idx['Consent']] !== 'Yes, I consent') return false;
    if (Number(row[idx['Age']]) < 18) return false;
    if (row[idx['Vis_Role']] === 'I do not have experience with 3D visualization of scientific data') return false;
    if (['Voxfish', 'OpenATP', 'All of the above'].includes(row[idx['Weeder']])) return false;
    // Remove if all acceptability columns are empty
    const acceptCols = [
      'Acceptability_Human_Smoothing', 'Acceptability_Human_Textures', 'Acceptability_Human_CamPos',
      'Acceptability_Human_Blur', 'Acceptability_Human_Details', 'Acceptability_Human_Errors',
      'Acceptability_Human_FeatureAddition', 'Acceptability_Human_FeatureOmission', 'Acceptability_Human_Gaps',
      'Acceptability_Human_Shape', 'Acceptability_Human_Lighting', 'Acceptability_Human_BgItems',
      'Acceptability_Human_BgImage', 'Acceptability_Human_Position', 'Acceptability_Human_Color',
      'Acceptability_AI_Smoothing', 'Acceptability_AI_Textures', 'Acceptability_AI_CamPos',
      'Acceptability_AI_Blur', 'Acceptability_AI_Details', 'Acceptability_AI_Errors',
      'Acceptability_AI_FeatureAddition', 'Acceptability_AI_FeatureOmission', 'Acceptability_AI_Gaps',
      'Acceptability_AI_Shape', 'Acceptability_AI_Lighting', 'Acceptability_AI_BgItems',
      'Acceptability_AI_BgImage', 'Acceptability_AI_Position', 'Acceptability_AI_Color'
    ];
    const hasAcceptabilityResponse = acceptCols.some(col => row[idx[col]]);
    const hasContextResponse = contextCols.some(col => row[idx[col]]);
    if (!hasAcceptabilityResponse && !hasContextResponse) return false;
    // Remove specific ResponseIds
    const removeIds = [
      'R_3rvFplrp4hr3iBH'
    ];
    if (removeIds.includes(row[idx['ResponseId']])) return false;
    return true;
  });

  // Map to objects for easier handling
  const mapped = cleaned.map(row => {
    const obj = {};
    header.forEach((col, i) => { obj[col] = row[i]; });
    // Age bucketing
    const age = Number(obj['Age']);
    if (!isNaN(age)) {
      if (age <= 24) obj['Age'] = '18-24';
      else if (age <= 34) obj['Age'] = '25-34';
      else if (age <= 44) obj['Age'] = '35-44';
      else if (age <= 54) obj['Age'] = '45-54';
      else if (age <= 64) obj['Age'] = '55-64';
      else obj['Age'] = '65+';
    }
    // Domains as array
    if (obj['Domains']) {
      obj['Domains'] = obj['Domains'].split(',').map(s => s.trim());
    }
    return obj;
  });

  return mapped;
}

function getContextViewConfig(view) {
  return CONTEXT_VIEW_CONFIG[view] || CONTEXT_VIEW_CONFIG.importance;
}

function hasContextResponseForFeature(row, feature, valueMap) {
  const score = valueMap[row[feature]];
  return isValidScore(score);
}

function hasAnyContextResponse(row, viewConfig) {
  return viewConfig.features.some(feature => hasContextResponseForFeature(row, feature, viewConfig.valueMap));
}

function aggregateContextBoxPlot(data, comparisonType, view) {
  const viewConfig = getContextViewConfig(view);
  const output = {
    features: viewConfig.features,
    groups: [],
    data: {},
    groupCounts: {}
  };

  const groupsAndCounts = getContextGroupsAndCounts(data, comparisonType, viewConfig);
  output.groups = groupsAndCounts.groups;
  output.groupCounts = groupsAndCounts.groupCounts;

  viewConfig.features.forEach(feature => {
    output.data[feature] = {};
    output.groups.forEach(group => {
      output.data[feature][group] = collectContextScores(data, comparisonType, group, feature, viewConfig);
    });
  });

  return output;
}

function aggregateContextSwarmPlot(data, comparisonType, view) {
  return aggregateContextBoxPlot(data, comparisonType, view);
}

function aggregateContextLineChart(data, comparisonType, view) {
  const viewConfig = getContextViewConfig(view);
  const output = {
    features: viewConfig.features,
    groups: [],
    means: {},
    stds: {},
    groupCounts: {}
  };

  const groupsAndCounts = getContextGroupsAndCounts(data, comparisonType, viewConfig);
  output.groups = groupsAndCounts.groups;
  output.groupCounts = groupsAndCounts.groupCounts;

  output.groups.forEach(group => {
    output.means[group] = {};
    output.stds[group] = {};
    viewConfig.features.forEach(feature => {
      const scores = collectContextScores(data, comparisonType, group, feature, viewConfig);
      output.means[group][feature] = calculateMean(scores);
      output.stds[group][feature] = calculateStdDev(scores);
    });
  });

  return output;
}

// --- Aggregation for Swarm Plot ---
function aggregateSwarmPlot(data, comparisonType) {
  const output = {
    features: FEATURES,
    groups: [],
    data: {},
    dataHuman: {},
    dataAI: {},
    humanGroups: [],
    aiGroups: [],
    groupCounts: {}
  };

  const groupsAndCounts = getGroupsAndCounts(data, comparisonType);
  const groups = groupsAndCounts.groups;
  const groupCounts = groupsAndCounts.groupCounts;
  output.groups = groups;
  output.groupCounts = groupCounts;

  if (comparisonType === 'human_ai') {
    output.humanGroups = ['Human'];
    output.aiGroups = ['AI'];
  } else {
    output.humanGroups = groups.slice();
    output.aiGroups = groups.slice();
  }

  FEATURES.forEach(feature => {
    output.data[feature] = {};
    output.dataHuman[feature] = {};
    output.dataAI[feature] = {};
    groups.forEach(group => {
      output.data[feature][group] = [];
      output.dataHuman[feature][group] = [];
      output.dataAI[feature][group] = [];
    });
  });

  groups.forEach(group => {
    FEATURES.forEach(feature => {
      const scores = collectScores(data, comparisonType, group, feature);
      if (comparisonType === 'human_ai') {
        output.data[feature][group] = scores[group === 'Human' ? 'human' : 'ai'];
      } else if (comparisonType === 'summary') {
        output.data[feature][group] = scores.human.concat(scores.ai);
      } else {
        output.data[feature][group] = scores.human;
      }
      output.dataHuman[feature][group] = scores.human;
      output.dataAI[feature][group] = scores.ai;
    });
  });

  return output;
}

// --- Aggregation for Box Plot ---
// Returns only aggregated data for box plots (never raw data)
function aggregateBoxPlot(data, comparisonType) {
  // Prepare output structure
  const output = {
    features: FEATURES,
    groups: [],
    data: {},
    humanGroups: [],
    aiGroups: [],
    groupCounts: {} // <-- add groupCounts to output
  };

  // Determine groups and group counts
  const groupsAndCounts = getGroupsAndCounts(data, comparisonType);
  const groups = groupsAndCounts.groups;
  const groupCounts = groupsAndCounts.groupCounts;
  output.groups = groups;
  output.groupCounts = groupCounts;
  if (comparisonType === 'human_ai') {
    output.humanGroups = ['Human'];
    output.aiGroups = ['AI'];
  } else {
    output.humanGroups = groups.slice();
    output.aiGroups = groups.slice();
  }

  // No feature sorting here; handled on frontend

  // For each group and feature, collect all scores
  groups.forEach(group => {
    output.data[group] = {};
    if (comparisonType !== 'human_ai' && comparisonType !== 'summary') {
      output.data[group + '__AI'] = {};
    }
    FEATURES.forEach(feat => {
      const scores = collectScores(data, comparisonType, group, feat);
      if (comparisonType === 'human_ai') {
        output.data[group][feat] = scores[group === 'Human' ? 'human' : 'ai'];
      } else if (comparisonType === 'summary') {
        output.data[group][feat] = scores.human.concat(scores.ai);
      } else {
        output.data[group][feat] = scores.human;
        output.data[group + '__AI'][feat] = scores.ai;
      }
    });
  });
  // Add AI group keys for frontend
  if (comparisonType !== 'human_ai' && comparisonType !== 'summary') {
    output.groups.forEach(g => {
      output.aiGroups.push(g + '__AI');
    });
  }

  return output;
}

// --- Aggregation for Line Chart (Means and Standard Deviations) ---
// Returns only aggregated means and standard deviations for line charts (never raw data)
function aggregateLineChart(data, comparisonType) {
  // Prepare output structure
  const output = {
    features: FEATURES,
    groups: [],
    means: {},
    meansHuman: {},
    meansAI: {},
    stdsHuman: {},
    stdsAI: {},
    groupCounts: {} // <-- add groupCounts to output
  };

  // Determine groups and group counts
  const groupsAndCounts = getGroupsAndCounts(data, comparisonType);
  const groups = groupsAndCounts.groups;
  const groupCounts = groupsAndCounts.groupCounts;
  output.groups = groups;
  output.groupCounts = groupCounts;

  // No feature sorting here; handled on frontend

  // For each group and feature, calculate mean and standard deviation
  groups.forEach(group => {
    output.means[group] = {};
    output.meansHuman[group] = {};
    output.meansAI[group] = {};
    output.stdsHuman[group] = {};
    output.stdsAI[group] = {};
    FEATURES.forEach(feat => {
      const scores = collectScores(data, comparisonType, group, feat);
      if (comparisonType === 'summary') {
        const combined = scores.human.concat(scores.ai);
        output.means[group][feat] = calculateMean(combined);
        output.meansHuman[group][feat] = calculateMean(combined);
        output.stdsHuman[group][feat] = calculateStdDev(combined);
        output.meansAI[group][feat] = calculateMean(combined);
        output.stdsAI[group][feat] = calculateStdDev(combined);
      } else if (comparisonType === 'human_ai') {
        if (group === 'Human') {
          output.meansHuman[group][feat] = calculateMean(scores.human);
          output.stdsHuman[group][feat] = calculateStdDev(scores.human);
          output.means[group][feat] = output.meansHuman[group][feat];
        } else {
          output.meansAI[group][feat] = calculateMean(scores.ai);
          output.stdsAI[group][feat] = calculateStdDev(scores.ai);
          output.means[group][feat] = output.meansAI[group][feat];
        }
      } else {
        output.meansHuman[group][feat] = calculateMean(scores.human);
        output.stdsHuman[group][feat] = calculateStdDev(scores.human);
        output.meansAI[group][feat] = calculateMean(scores.ai);
        output.stdsAI[group][feat] = calculateStdDev(scores.ai);
      }
    });
  });

  return output;
}

// --- Aggregation for Slope Chart (Means) ---
// Returns only aggregated means for slope charts (never raw data)
// Same structure as line chart but can be used to show Human vs AI on same chart
function aggregateSlopeChart(data, comparisonType) {
  // Prepare output structure (same as line chart)
  const output = {
    features: FEATURES,
    groups: [],
    meansHuman: {},
    meansAI: {},
    stdsHuman: {},
    stdsAI: {},
    groupCounts: {},
    pairedData: [] // For individual responses in Human vs AI
  };

  // Determine groups and group counts
  const groupsAndCounts = getGroupsAndCounts(data, comparisonType);
  const groups = groupsAndCounts.groups;
  const groupCounts = groupsAndCounts.groupCounts;
  output.groups = groups;
  output.groupCounts = groupCounts;

  if (comparisonType === 'human_ai') {
    output.pairedData = [];
    groups.forEach(group => {
      if (group === 'Human') {
        output.groupCounts['Human'] = getResponseGroupCount(data, 'Acceptability_Human_');
      } else if (group === 'AI') {
        output.groupCounts['AI'] = getResponseGroupCount(data, 'Acceptability_AI_');
      }
    });

    // Collect paired individual responses for Human vs AI
    data.forEach(d => {
      const pair = { human: {}, ai: {} };
      let hasHuman = false;
      let hasAI = false;
      FEATURES.forEach(feat => {
        const hVal = LIKERT_MAP[d['Acceptability_Human_' + feat]];
        const aVal = LIKERT_MAP[d['Acceptability_AI_' + feat]];
        if (hVal !== undefined && hVal !== null && hVal !== '') {
          pair.human[feat] = hVal;
          hasHuman = true;
        }
        if (aVal !== undefined && aVal !== null && aVal !== '') {
          pair.ai[feat] = aVal;
          hasAI = true;
        }
      });
      if (hasHuman || hasAI) {
        output.pairedData.push(pair);
      }
    });
  } else {
    output.groups = groups;
    output.groupCounts = groupCounts;
  }

  // No feature sorting here; handled on frontend

  // For each group and feature, calculate mean
  groups.forEach(group => {
    output.meansHuman[group] = {};
    output.meansAI[group] = {};
    output.stdsHuman[group] = {};
    output.stdsAI[group] = {};
    FEATURES.forEach(feat => {
      const scores = collectScores(data, comparisonType, group, feat);
      if (comparisonType === 'summary') {
        const combined = scores.human.concat(scores.ai);
        output.meansHuman[group][feat] = calculateMean(combined);
        output.meansAI[group][feat] = calculateMean(combined);
        output.stdsHuman[group][feat] = calculateStdDev(combined);
        output.stdsAI[group][feat] = calculateStdDev(combined);
      } else if (comparisonType === 'human_ai') {
        if (group === 'Human') {
          output.meansHuman[group][feat] = calculateMean(scores.human);
        } else {
          output.meansAI[group][feat] = calculateMean(scores.ai);
        }
      } else {
        output.meansHuman[group][feat] = calculateMean(scores.human);
        output.meansAI[group][feat] = calculateMean(scores.ai);
      }
    });
  });

  return output;
}

// --- Helper to calculate standard deviation ---
function calculateStdDev(values) {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function getResponseGroupCount(data, prefix) {
  return data.filter(d => Object.keys(d).some(k => k.startsWith(prefix) && d[k] !== undefined && d[k] !== null && d[k] !== '')).length;
}

function getSummaryResponseCount(data) {
  return data.filter(row => {
    return Object.keys(row).some(key => {
      return (key.startsWith('Acceptability_Human_') || key.startsWith('Acceptability_AI_')) && row[key] !== undefined && row[key] !== null && row[key] !== '';
    });
  }).length;
}

function getContextSummaryResponseCount(data, viewConfig) {
  return data.filter(row => hasAnyContextResponse(row, viewConfig)).length;
}

function getContextGroupsAndCounts(data, comparisonType, viewConfig) {
  if (comparisonType === 'summary') {
    return {
      groups: ['Summary'],
      groupCounts: {
        Summary: getContextSummaryResponseCount(data, viewConfig)
      }
    };
  }

  const comparisonColumn = getComparisonColumn(comparisonType);
  let groups = [];
  if (comparisonColumn === 'Domains') {
    groups = Array.from(new Set(data
      .filter(row => hasAnyContextResponse(row, viewConfig))
      .flatMap(d => normalizeDomains(d['Domains']))));
  } else {
    groups = Array.from(new Set(data
      .filter(row => hasAnyContextResponse(row, viewConfig))
      .map(d => normalizeGroupValue(d[comparisonColumn]))
      .filter(v => v !== null)));
  }

  const groupCounts = {};
  groups.forEach(group => {
    if (comparisonColumn === 'Domains') {
      groupCounts[group] = data.filter(d => hasAnyContextResponse(d, viewConfig) && normalizeDomains(d['Domains']).includes(group)).length;
    } else {
      groupCounts[group] = data.filter(d => hasAnyContextResponse(d, viewConfig) && normalizeGroupValue(d[comparisonColumn]) === group).length;
    }
  });

  return { groups, groupCounts };
}

function getGroupsAndCounts(data, comparisonType) {
  if (comparisonType === 'summary') {
    return {
      groups: ['Summary'],
      groupCounts: {
        Summary: getSummaryResponseCount(data)
      }
    };
  }

  if (comparisonType === 'human_ai') {
    return {
      groups: ['Human', 'AI'],
      groupCounts: {
        Human: getResponseGroupCount(data, 'Acceptability_Human_'),
        AI: getResponseGroupCount(data, 'Acceptability_AI_')
      }
    };
  }
  
  const comparisonColumn = getComparisonColumn(comparisonType);
  let groups = [];
  if (comparisonColumn === 'Domains') {
    groups = Array.from(new Set(data.flatMap(d => normalizeDomains(d['Domains']))));
  } else {
    groups = Array.from(new Set(data.map(d => normalizeGroupValue(d[comparisonColumn])).filter(v => v !== null)));
  }
  const groupCounts = {};
  groups.forEach(group => {
    if (comparisonColumn === 'Domains') {
      groupCounts[group] = data.filter(d => normalizeDomains(d['Domains']).includes(group)).length;
    } else {
      groupCounts[group] = data.filter(d => normalizeGroupValue(d[comparisonColumn]) === group).length;
    }
  });
  return { groups, groupCounts };
}

function matchesGroup(row, comparisonType, group) {
  if (comparisonType === 'human_ai' || comparisonType === 'summary') {
    return true;
  }
  const comparisonColumn = getComparisonColumn(comparisonType);
  if (comparisonColumn === 'Domains') {
    return normalizeDomains(row['Domains']).includes(group);
  }
  return row[comparisonColumn] === group;
}

// --- Reusable helpers for score collection and mean calculation ---
function isValidScore(value) {
  return value !== undefined && value !== null && value !== '';
}

function calculateMean(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeDomains(domains) {
  if (Array.isArray(domains)) {
    return domains.map(value => String(value).trim()).filter(value => value);
  }
  if (typeof domains === 'string') {
    return domains.split(',').map(value => value.trim()).filter(value => value);
  }
  return [];
}

function normalizeGroupValue(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function collectScores(data, comparisonType, group, feature) {
  const humanKey = 'Acceptability_Human_' + feature;
  const aiKey = 'Acceptability_AI_' + feature;
  const humanScores = [];
  const aiScores = [];

  data.forEach(row => {
    if (!matchesGroup(row, comparisonType, group)) return;

    const humanVal = LIKERT_MAP[row[humanKey]];
    if (isValidScore(humanVal)) {
      humanScores.push(humanVal);
    }

    const aiVal = LIKERT_MAP[row[aiKey]];
    if (isValidScore(aiVal)) {
      aiScores.push(aiVal);
    }
  });

  if (comparisonType === 'human_ai') {
    return {
      human: group === 'Human' ? humanScores : [],
      ai: group === 'AI' ? aiScores : []
    };
  }

  return { human: humanScores, ai: aiScores };
}

function collectContextScores(data, comparisonType, group, feature, viewConfig) {
  const scores = [];

  data.forEach(row => {
    if (!matchesGroup(row, comparisonType, group)) return;

    const value = viewConfig.valueMap[row[feature]];
    if (isValidScore(value)) {
      scores.push(value);
    }
  });

  return scores;
}
