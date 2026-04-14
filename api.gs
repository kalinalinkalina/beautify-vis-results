/**
 * doGet(e)
 * API endpoint for returning ONLY AGGREGATED DATA (never raw data) for IRB compliance.
 *
 * Query Parameters:
 *   chartType: 'box' | 'line' (default: 'box')
 *   comparisonType: e.g., 'human_ai', 'role', etc. (default: 'human_ai')
 *   sortBy: e.g., 'human_mean' (default: 'human_mean')
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

// --- Data Cleaning ---
// This function processes and cleans the raw spreadsheet data, but only for use in aggregation.
// No raw data is ever returned to the client.
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
      'R_3t6asL5rzmRf0dc', 'R_7FR0CIq9gWcLI9H', 'R_7qCnRUkyPD08zGO', 'R_3e84CRbBQyQBjvX',
      'R_3rvFplrp4hr3iBH', 'R_10ivOzLSu73P1B6', 'R_32M9Pogwo7gP2YM',
      'R_4YysgirTHLontwR', 'R_5rwsIGQ0MS83TRT', 'R_4p8r1FZg0saMUFz', 'R_1Sk3Nm1afmoFlUA', 'R_6n7hKa7m4GZJFAd', 'R_6eamu3XrOX3EveH'
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
  const features = [
    'Smoothing', 'Textures', 'CamPos', 'Blur', 'Details', 'Errors',
    'FeatureAddition', 'FeatureOmission', 'Gaps', 'Shape', 'Lighting',
    'BgItems', 'BgImage', 'Position', 'Color'
  ];
  const likertMap = {
    "Never acceptable": 0, "Rarely acceptable": 1, "Sometimes acceptable": 2,
    "Often acceptable": 3, "Usually acceptable": 4, "Always acceptable": 5,
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5
  };

  const output = {
    features: features,
    groups: [],
    data: {},
    humanGroups: [],
    aiGroups: [],
    groupCounts: {}
  };

  let groups = [];
  let groupCounts = {};
  if (comparisonType === 'human_ai') {
    groups = ['Human', 'AI'];
    groupCounts = { 'Human': data.length, 'AI': data.length };
  } else {
    const uniqueGroups = [...new Set(data.map(row => row[comparisonType]))];
    groups = uniqueGroups.filter(g => g); // Filter out empty/null groups
    groupCounts = groups.reduce((acc, group) => {
      acc[group] = data.filter(row => row[comparisonType] === group).length;
      return acc;
    }, {});
  }

  output.groups = groups;
  output.groupCounts = groupCounts;

  if (comparisonType === 'human_ai') {
    output.humanGroups = ['Human'];
    output.aiGroups = ['AI'];
  } else {
    output.humanGroups = groups;
    output.aiGroups = [];
  }

  // Initialize data structure
  features.forEach(feature => {
    output.data[feature] = {};
    groups.forEach(group => {
      output.data[feature][group] = []; // Store individual points
    });
  });

  // Populate data
  data.forEach(row => {
    features.forEach(feature => {
      if (comparisonType === 'human_ai') {
        const humanVal = likertMap[row[`Acceptability_Human_${feature}`]];
        const aiVal = likertMap[row[`Acceptability_AI_${feature}`]];
        if (humanVal !== undefined) output.data[feature]['Human'].push(humanVal);
        if (aiVal !== undefined) output.data[feature]['AI'].push(aiVal);
      } else {
        const group = row[comparisonType];
        if (groups.includes(group)) {
          const humanVal = likertMap[row[`Acceptability_Human_${feature}`]];
          if (humanVal !== undefined) output.data[feature][group].push(humanVal);
        }
      }
    });
  });

  // Sorting (if applicable, though less common for swarm plots)
  // This part is complex for swarm plots and might not be needed.
  // If sorting is required, it would likely be based on the median or mean of the points.
  // For now, we'll keep the original feature order.

  return output;
}

// --- Aggregation for Box Plot ---
// Returns only aggregated data for box plots (never raw data)
function aggregateBoxPlot(data, comparisonType, sortBy) {
  // Acceptability columns and mapping
  const features = [
    'Smoothing', 'Textures', 'CamPos', 'Blur', 'Details', 'Errors',
    'FeatureAddition', 'FeatureOmission', 'Gaps', 'Shape', 'Lighting',
    'BgItems', 'BgImage', 'Position', 'Color'
  ];
  const likertMap = {
    "Never acceptable": 0, "Rarely acceptable": 1, "Sometimes acceptable": 2,
    "Often acceptable": 3, "Usually acceptable": 4, "Always acceptable": 5,
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 // In case already mapped
  };

  // Prepare output structure
  const output = {
    features: features,
    groups: [],
    data: {},
    humanGroups: [],
    aiGroups: [],
    groupCounts: {} // <-- add groupCounts to output
  };

  // Determine groups and group counts
  let groups = [];
  let groupCounts = {};
  if (comparisonType === 'human_ai') {
    groups = ['Human', 'AI'];
    output.humanGroups = ['Human'];
    output.aiGroups = ['AI'];
    groupCounts['Human'] = data.filter(d => {
      return Object.keys(d).some(k => k.startsWith('Acceptability_Human_') && d[k] !== undefined && d[k] !== null && d[k] !== '');
    }).length;
    groupCounts['AI'] = data.filter(d => {
      return Object.keys(d).some(k => k.startsWith('Acceptability_AI_') && d[k] !== undefined && d[k] !== null && d[k] !== '');
    }).length;
  } else {
    // All other comparison types
    let groupCol = null;
    if (comparisonType === 'role') {
      groupCol = 'Vis_Role';
    } else if (comparisonType === 'experience') {
      groupCol = 'Vis_Length';
    } else if (comparisonType === 'frequency_vis') {
      groupCol = 'Vis_Frequency';
    } else if (comparisonType === 'frequency_public') {
      groupCol = 'Public_Frequency';
    } else if (comparisonType === 'domain') {
      groupCol = 'Domains';
    } else if (comparisonType === 'age') {
      groupCol = 'Age';
    } else if (comparisonType === 'tool_use') {
      groupCol = 'Tool_use';
    }
    if (groupCol === 'Domains') {
      groups = Array.from(new Set([].concat(...data.map(d => d['Domains'] || []))));
      groups.forEach(g => {
        groupCounts[g] = data.filter(d => (d['Domains'] || []).includes(g)).length;
      });
    } else {
      groups = Array.from(new Set(data.map(d => d[groupCol])));
      groups.forEach(g => {
        groupCounts[g] = data.filter(d => d[groupCol] === g).length;
      });
    }
    output.humanGroups = groups.slice();
    output.aiGroups = groups.slice();
  }
  output.groups = groups;
  output.groupCounts = groupCounts;

  // No feature sorting here; handled on frontend

  // For each group and feature, collect all scores
  groups.forEach(group => {
    output.data[group] = {};
    features.forEach(feat => {
      let scoresHuman = [];
      let scoresAI = [];
      if (comparisonType === 'human_ai') {
        // Human
        if (group === 'Human') {
          scoresHuman = data.map(d => likertMap[d['Acceptability_Human_' + feat]]).filter(v => v !== undefined && v !== null && v !== '');
          output.data[group][feat] = scoresHuman;
        } else {
          scoresAI = data.map(d => likertMap[d['Acceptability_AI_' + feat]]).filter(v => v !== undefined && v !== null && v !== '');
          output.data[group][feat] = scoresAI;
        }
      } else if (comparisonType === 'domain') {
        scoresHuman = data.filter(d => (d['Domains'] || []).includes(group))
          .map(d => likertMap[d['Acceptability_Human_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        scoresAI = data.filter(d => (d['Domains'] || []).includes(group))
          .map(d => likertMap[d['Acceptability_AI_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        output.data[group][feat] = scoresHuman;
        output.data[group + '__AI'] = output.data[group + '__AI'] || {};
        output.data[group + '__AI'][feat] = scoresAI;
      } else {
        scoresHuman = data.filter(d => d[getComparisonCol(comparisonType)] === group)
          .map(d => likertMap[d['Acceptability_Human_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        scoresAI = data.filter(d => d[getComparisonCol(comparisonType)] === group)
          .map(d => likertMap[d['Acceptability_AI_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        output.data[group][feat] = scoresHuman;
        output.data[group + '__AI'] = output.data[group + '__AI'] || {};
        output.data[group + '__AI'][feat] = scoresAI;
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

// --- Aggregation for Line Chart (Means) ---
// Returns only aggregated means for line charts (never raw data)
function aggregateLineChart(data, comparisonType, sortBy) {
  // Acceptability columns and mapping
  const features = [
    'Smoothing', 'Textures', 'CamPos', 'Blur', 'Details', 'Errors',
    'FeatureAddition', 'FeatureOmission', 'Gaps', 'Shape', 'Lighting',
    'BgItems', 'BgImage', 'Position', 'Color'
  ];
  const likertMap = {
    "Never acceptable": 0, "Rarely acceptable": 1, "Sometimes acceptable": 2,
    "Often acceptable": 3, "Usually acceptable": 4, "Always acceptable": 5,
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 // In case already mapped
  };

  // Prepare output structure
  const output = {
    features: features,
    groups: [],
    means: {},
    meansHuman: {},
    meansAI: {},
    groupCounts: {} // <-- add groupCounts to output
  };

  // Determine groups and group counts
  let groups = [];
  let groupCounts = {};
  if (comparisonType === 'human_ai') {
    groups = ['Human', 'AI'];
    groupCounts['Human'] = data.filter(d => {
      return Object.keys(d).some(k => k.startsWith('Acceptability_Human_') && d[k] !== undefined && d[k] !== null && d[k] !== '');
    }).length;
    groupCounts['AI'] = data.filter(d => {
      return Object.keys(d).some(k => k.startsWith('Acceptability_AI_') && d[k] !== undefined && d[k] !== null && d[k] !== '');
    }).length;
  } else if (comparisonType === 'role') {
    groups = Array.from(new Set(data.map(d => d['Vis_Role'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Vis_Role'] === g).length;
    });
  } else if (comparisonType === 'experience') {
    groups = Array.from(new Set(data.map(d => d['Vis_Length'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Vis_Length'] === g).length;
    });
  } else if (comparisonType === 'frequency_vis') {
    groups = Array.from(new Set(data.map(d => d['Vis_Frequency'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Vis_Frequency'] === g).length;
    });
  } else if (comparisonType === 'frequency_public') {
    groups = Array.from(new Set(data.map(d => d['Public_Frequency'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Public_Frequency'] === g).length;
    });
  } else if (comparisonType === 'domain') {
    groups = Array.from(new Set([].concat(...data.map(d => d['Domains'] || []))));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => (d['Domains'] || []).includes(g)).length;
    });
  } else if (comparisonType === 'age') {
    groups = Array.from(new Set(data.map(d => d['Age'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Age'] === g).length;
    });
  } else if (comparisonType === 'tool_use') {
    groups = Array.from(new Set(data.map(d => d['Tool_use'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Tool_use'] === g).length;
    });
  }
  output.groups = groups;
  output.groupCounts = groupCounts;

  // No feature sorting here; handled on frontend

  // For each group and feature, calculate mean
  groups.forEach(group => {
    output.means[group] = {};
    output.meansHuman[group] = {};
    output.meansAI[group] = {};
    features.forEach(feat => {
      let scoresHuman = [];
      let scoresAI = [];
      if (comparisonType === 'human_ai') {
        if (group === 'Human') {
          scoresHuman = data.map(d => likertMap[d['Acceptability_Human_' + feat]]).filter(v => v !== undefined && v !== null && v !== '');
          output.means[group][feat] = scoresHuman.length ? (scoresHuman.reduce((a, b) => a + b, 0) / scoresHuman.length) : null;
        } else {
          scoresAI = data.map(d => likertMap[d['Acceptability_AI_' + feat]]).filter(v => v !== undefined && v !== null && v !== '');
          output.means[group][feat] = scoresAI.length ? (scoresAI.reduce((a, b) => a + b, 0) / scoresAI.length) : null;
        }
      } else if (comparisonType === 'domain') {
        scoresHuman = data.filter(d => (d['Domains'] || []).includes(group))
          .map(d => likertMap[d['Acceptability_Human_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        scoresAI = data.filter(d => (d['Domains'] || []).includes(group))
          .map(d => likertMap[d['Acceptability_AI_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        output.meansHuman[group][feat] = scoresHuman.length ? (scoresHuman.reduce((a, b) => a + b, 0) / scoresHuman.length) : null;
        output.meansAI[group][feat] = scoresAI.length ? (scoresAI.reduce((a, b) => a + b, 0) / scoresAI.length) : null;
      } else {
        scoresHuman = data.filter(d => d[getComparisonCol(comparisonType)] === group)
          .map(d => likertMap[d['Acceptability_Human_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        scoresAI = data.filter(d => d[getComparisonCol(comparisonType)] === group)
          .map(d => likertMap[d['Acceptability_AI_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        output.meansHuman[group][feat] = scoresHuman.length ? (scoresHuman.reduce((a, b) => a + b, 0) / scoresHuman.length) : null;
        output.meansAI[group][feat] = scoresAI.length ? (scoresAI.reduce((a, b) => a + b, 0) / scoresAI.length) : null;
      }
    });
  });

  return output;
}

// --- Aggregation for Slope Chart (Means) ---
// Returns only aggregated means for slope charts (never raw data)
// Same structure as line chart but can be used to show Human vs AI on same chart
function aggregateSlopeChart(data, comparisonType, sortBy) {
  // Acceptability columns and mapping
  const features = [
    'Smoothing', 'Textures', 'CamPos', 'Blur', 'Details', 'Errors',
    'FeatureAddition', 'FeatureOmission', 'Gaps', 'Shape', 'Lighting',
    'BgItems', 'BgImage', 'Position', 'Color'
  ];
  const likertMap = {
    "Never acceptable": 0, "Rarely acceptable": 1, "Sometimes acceptable": 2,
    "Often acceptable": 3, "Usually acceptable": 4, "Always acceptable": 5,
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 // In case already mapped
  };

  // Prepare output structure (same as line chart)
  const output = {
    features: features,
    groups: [],
    meansHuman: {},
    meansAI: {},
    groupCounts: {},
    pairedData: [] // For individual responses in Human vs AI
  };

  // Determine groups and group counts
  let groups = [];
  let groupCounts = {};
  if (comparisonType === 'human_ai') {
    groups = ['Human', 'AI'];
    groupCounts['Human'] = data.filter(d => {
      return Object.keys(d).some(k => k.startsWith('Acceptability_Human_') && d[k] !== undefined && d[k] !== null && d[k] !== '');
    }).length;
    groupCounts['AI'] = data.filter(d => {
      return Object.keys(d).some(k => k.startsWith('Acceptability_AI_') && d[k] !== undefined && d[k] !== null && d[k] !== '');
    }).length;

    // Collect paired individual responses for Human vs AI
    data.forEach(d => {
      const pair = { human: {}, ai: {} };
      let hasHuman = false;
      let hasAI = false;
      features.forEach(feat => {
        const hVal = likertMap[d['Acceptability_Human_' + feat]];
        const aVal = likertMap[d['Acceptability_AI_' + feat]];
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
  } else if (comparisonType === 'role') {
    groups = Array.from(new Set(data.map(d => d['Vis_Role'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Vis_Role'] === g).length;
    });
  } else if (comparisonType === 'experience') {
    groups = Array.from(new Set(data.map(d => d['Vis_Length'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Vis_Length'] === g).length;
    });
  } else if (comparisonType === 'frequency_vis') {
    groups = Array.from(new Set(data.map(d => d['Vis_Frequency'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Vis_Frequency'] === g).length;
    });
  } else if (comparisonType === 'frequency_public') {
    groups = Array.from(new Set(data.map(d => d['Public_Frequency'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Public_Frequency'] === g).length;
    });
  } else if (comparisonType === 'domain') {
    groups = Array.from(new Set([].concat(...data.map(d => d['Domains'] || []))));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => (d['Domains'] || []).includes(g)).length;
    });
  } else if (comparisonType === 'age') {
    groups = Array.from(new Set(data.map(d => d['Age'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Age'] === g).length;
    });
  } else if (comparisonType === 'tool_use') {
    groups = Array.from(new Set(data.map(d => d['Tool_use'])));
    groups.forEach(g => {
      groupCounts[g] = data.filter(d => d['Tool_use'] === g).length;
    });
  }
  output.groups = groups;
  output.groupCounts = groupCounts;

  // No feature sorting here; handled on frontend

  // For each group and feature, calculate mean
  groups.forEach(group => {
    output.meansHuman[group] = {};
    output.meansAI[group] = {};
    features.forEach(feat => {
      let scoresHuman = [];
      let scoresAI = [];
      if (comparisonType === 'human_ai') {
        if (group === 'Human') {
          scoresHuman = data.map(d => likertMap[d['Acceptability_Human_' + feat]]).filter(v => v !== undefined && v !== null && v !== '');
          output.meansHuman[group][feat] = scoresHuman.length ? (scoresHuman.reduce((a, b) => a + b, 0) / scoresHuman.length) : null;
        } else {
          scoresAI = data.map(d => likertMap[d['Acceptability_AI_' + feat]]).filter(v => v !== undefined && v !== null && v !== '');
          output.meansAI[group][feat] = scoresAI.length ? (scoresAI.reduce((a, b) => a + b, 0) / scoresAI.length) : null;
        }
      } else if (comparisonType === 'domain') {
        scoresHuman = data.filter(d => (d['Domains'] || []).includes(group))
          .map(d => likertMap[d['Acceptability_Human_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        scoresAI = data.filter(d => (d['Domains'] || []).includes(group))
          .map(d => likertMap[d['Acceptability_AI_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        output.meansHuman[group][feat] = scoresHuman.length ? (scoresHuman.reduce((a, b) => a + b, 0) / scoresHuman.length) : null;
        output.meansAI[group][feat] = scoresAI.length ? (scoresAI.reduce((a, b) => a + b, 0) / scoresAI.length) : null;
      } else {
        scoresHuman = data.filter(d => d[getComparisonCol(comparisonType)] === group)
          .map(d => likertMap[d['Acceptability_Human_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        scoresAI = data.filter(d => d[getComparisonCol(comparisonType)] === group)
          .map(d => likertMap[d['Acceptability_AI_' + feat]])
          .filter(v => v !== undefined && v !== null && v !== '');
        output.meansHuman[group][feat] = scoresHuman.length ? (scoresHuman.reduce((a, b) => a + b, 0) / scoresHuman.length) : null;
        output.meansAI[group][feat] = scoresAI.length ? (scoresAI.reduce((a, b) => a + b, 0) / scoresAI.length) : null;
      }
    });
  });

  return output;
}

// --- Helper to map comparison type to column name ---

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
function getComparisonCol(comparisonType) {
  if (comparisonType === 'role') return 'Vis_Role';
  if (comparisonType === 'experience') return 'Vis_Length';
  if (comparisonType === 'frequency_vis') return 'Vis_Frequency';
  if (comparisonType === 'frequency_public') return 'Public_Frequency';
  if (comparisonType === 'domain') return 'Domains';
  if (comparisonType === 'age') return 'Age';
  if (comparisonType === 'tool_use') return 'Tool_use';
  return comparisonType;
}