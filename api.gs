/**
 * doGet(e)
 * API endpoint for returning ONLY AGGREGATED DATA (never raw data) for IRB compliance.
 *
 * Query Parameters:
 *   chartType: 'box' | 'line' (default: 'box')
 *   comparisonType: e.g., 'human_ai', 'role', etc. (default: 'human_ai')
 *   sortBy: e.g., 'human_mean' (default: 'human_mean') — currently reserved for frontend sorting and not used by backend aggregation
 *
 * Returns:
 *   JSON object with only aggregated data (box plot or line chart aggregations).
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
  const comparisonType = e.parameter.comparisonType || 'human_ai';
  const sortBy = e.parameter.sortBy || 'human_mean';

  // Clean and structure data
  const data = cleanData(values);

  // Aggregation (NO RAW DATA RETURNED)
  let result = {};
  if (chartType === 'box') {
    result = aggregateBoxPlot(data, comparisonType, sortBy);
  } else if (chartType === 'line') {
    result = aggregateLineChart(data, comparisonType, sortBy);
  } else if (chartType === 'slope') {
    result = aggregateSlopeChart(data, comparisonType, sortBy);
  } else if (chartType === 'swarm') { // Add swarm chart type
    result = aggregateSwarmPlot(data, comparisonType, sortBy);
  } else {
    result = {error: 'Chart type not implemented.'};
  }

  // Defensive: Never allow raw data to be returned
  if (result && Array.isArray(result) && chartType !== 'swarm') { // Allow array for swarm
    // If somehow an array (raw data) is returned, block it
    return ContentService
      .createTextOutput(JSON.stringify({error: 'Raw data access is forbidden by IRB policy.'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // CORS header for cross-origin requests
  return ContentService
    .createTextOutput(JSON.stringify(result))
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

const COMPARISON_CONFIG = {
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
 *   - comparisonType: 'human_ai', 'role', 'experience', 'frequency_vis', 'frequency_public', 'domain', 'age', 'tool_use'
 *   - sortBy: (optional, for future use)
 *
 * Returns:
 *   For 'box': { features, groups, data } (aggregated scores per group/feature)
 *   For 'line': { features, groups, means } (mean scores per group/feature)
 *   For 'slope': { features, groups, meansHuman, meansAI } (mean scores for both human and AI)
 *
 * This API will NEVER return raw or row-level data, in compliance with IRB requirements.
 */
function cleanData(values) {
  const header = values[0];
  const rows = values.slice(1);

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
    if (acceptCols.every(col => !row[idx[col]])) return false;
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

// --- Aggregation for Swarm Plot ---
function aggregateSwarmPlot(data, comparisonType, sortBy) {
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
function aggregateBoxPlot(data, comparisonType, sortBy) {
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
    if (comparisonType !== 'human_ai') {
      output.data[group + '__AI'] = {};
    }
    FEATURES.forEach(feat => {
      const scores = collectScores(data, comparisonType, group, feat);
      if (comparisonType === 'human_ai') {
        output.data[group][feat] = scores[group === 'Human' ? 'human' : 'ai'];
      } else {
        output.data[group][feat] = scores.human;
        output.data[group + '__AI'][feat] = scores.ai;
      }
    });
  });
  // Add AI group keys for frontend
  if (comparisonType !== 'human_ai') {
    output.groups.forEach(g => {
      output.aiGroups.push(g + '__AI');
    });
  }

  return output;
}

// --- Aggregation for Line Chart (Means and Standard Deviations) ---
// Returns only aggregated means and standard deviations for line charts (never raw data)
function aggregateLineChart(data, comparisonType, sortBy) {
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
      output.meansHuman[group][feat] = calculateMean(scores.human);
      output.stdsHuman[group][feat] = calculateStdDev(scores.human);
      output.meansAI[group][feat] = calculateMean(scores.ai);
      output.stdsAI[group][feat] = calculateStdDev(scores.ai);
      if (comparisonType === 'human_ai') {
        output.means[group][feat] = group === 'Human' ? output.meansHuman[group][feat] : output.meansAI[group][feat];
      }
    });
  });

  return output;
}

// --- Aggregation for Slope Chart (Means) ---
// Returns only aggregated means for slope charts (never raw data)
// Same structure as line chart but can be used to show Human vs AI on same chart
function aggregateSlopeChart(data, comparisonType, sortBy) {
  // Prepare output structure (same as line chart)
  const output = {
    features: FEATURES,
    groups: [],
    meansHuman: {},
    meansAI: {},
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
    FEATURES.forEach(feat => {
      const scores = collectScores(data, comparisonType, group, feat);
      if (comparisonType === 'human_ai') {
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

function getGroupsAndCounts(data, comparisonType) {
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
    groups = Array.from(new Set(data.map(d => d[comparisonColumn])));
  }
  const groupCounts = {};
  groups.forEach(group => {
    if (comparisonColumn === 'Domains') {
      groupCounts[group] = data.filter(d => normalizeDomains(d['Domains']).includes(group)).length;
    } else {
      groupCounts[group] = data.filter(d => d[comparisonColumn] === group).length;
    }
  });
  return { groups, groupCounts };
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

function matchesGroup(row, comparisonType, group) {
  const comparisonColumn = getComparisonColumn(comparisonType);
  if (comparisonType === 'human_ai') {
    return true;
  }
  if (comparisonColumn === 'Domains') {
    return normalizeDomains(row['Domains']).includes(group);
  }
  return row[comparisonColumn] === group;
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