// Data melting and mapping utilities for dashboard

/**
 * Melts acceptability columns, maps Likert to numerical, and renames features.
 * @param {Array<Object>} data - Cleaned data array
 * @param {Array<string>} acceptabilityCols - Columns to melt
 * @param {Object} likertMapping - Mapping from Likert string to number
 * @param {string} featurePrefix - Prefix to remove from feature names
 * @param {string|null} groupCol - Optional group column to keep
 * @returns {Array<Object>} Melted data with Feature, Acceptability_Score, Numerical_Score, Feature_Name, and groupCol if given
 */
function meltAndMapAcceptability(data, acceptabilityCols, likertMapping, featurePrefix, groupCol = null) {
    const melted = [];
    data.forEach(row => {
        acceptabilityCols.forEach(col => {
            const meltedRow = {};
            // Always include the group column, and always use the value from cleaned data (already short-name)
            if (groupCol) meltedRow[groupCol] = row[groupCol];
            meltedRow['Feature'] = col;
            meltedRow['Acceptability_Score'] = row[col];
            meltedRow['Numerical_Score'] = likertMapping[row[col]];
            meltedRow['Feature_Name'] = col.replace(featurePrefix, '');
            melted.push(meltedRow);
        });
    });
    return melted;
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.meltAndMapAcceptability = meltAndMapAcceptability;
}
