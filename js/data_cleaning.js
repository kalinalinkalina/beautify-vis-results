// Data cleaning and transformation utilities for dashboard

/**
 * Cleans the teapot survey data (CSV rows as JS objects).
 * @param {Array<Object>} data - Array of row objects from PapaParse or D3.csv
 * @returns {Array<Object>} Cleaned data
 */
function cleanTeapotData(data) {
    // Map long-form Vis_Role values to short-names (like Python legend_labels)
    const visRoleShortNames = {
        "Creating visualizations is the primary role I perform in my work": "Viz Practitioner",
        "I work with visualizations created by others, but I do not create or research visualization myself": "Scientist who uses vis",
        "Researching visualization methods/techniques is my primary role": "Vis Researcher",
        "I create visualizations to help me in my primary role, which is not visualization-related": "Scientist who creates vis"
    };
    // Remove rows based on consent, age, role, and weeder
    const filtered = data.filter(row =>
        row['Consent'] === 'Yes, I consent' &&
        Number(row['Age']) >= 18 &&
        row['Vis_Role'] !== 'I do not have experience with 3D visualization of scientific data' &&
        !['Voxfish', 'OpenATP', 'All of the above'].includes(row['Weeder'])
    );

    // Remove rows where all survey columns are empty
    const surveyCols = [
        'Acceptability_Human_Smoothing', 'Acceptability_Human_Textures', 'Acceptability_Human_CamPos',
        'Acceptability_Human_Blur', 'Acceptability_Human_Details', 'Acceptability_Human_Errors',
        'Acceptability_Human_FeatureAddition', 'Acceptability_Human_FeatureOmission', 'Acceptability_Human_Gaps',
        'Acceptability_Human_Shape', 'Acceptability_Human_Lighting', 'Acceptability_Human_BgItems',
        'Acceptability_Human_BgImage', 'Acceptability_Human_Position', 'Acceptability_Human_Color',
        'Acceptability_Hu_Txt', 'AI_experience', 'Acceptability_AI_Smoothing',
        'Acceptability_AI_Textures', 'Acceptability_AI_CamPos', 'Acceptability_AI_Blur',
        'Acceptability_AI_Details', 'Acceptability_AI_Errors', 'Acceptability_AI_FeatureAddition',
        'Acceptability_AI_FeatureOmission', 'Acceptability_AI_Gaps', 'Acceptability_AI_Shape',
        'Acceptability_AI_Lighting', 'Acceptability_AI_BgItems', 'Acceptability_AI_BgImage',
        'Acceptability_AI_Position', 'Acceptability_AI_Color', 'Acceptability_AI_Txt',
        'Use_Cases_1', 'Use_Cases_2', 'Use_Cases_3', 'Use_Cases_4', 'Use_Cases_5', 'Use_Cases_6',
        'Comfort_1', 'Comfort_2', 'Comfort_3', 'Comfort_4', 'Importance_1', 'Importance_2',
        'Concrete_Elaboration', 'AI-open', 'Tool_use'
    ];
    const nonEmpty = filtered.filter(row =>
        surveyCols.some(col => row[col] !== undefined && row[col] !== null && row[col] !== "")
    );

    // Remove specific responses by ID
    const participantsToRemove = new Set([
        'R_3t6asL5rzmRf0dc', 'R_7FR0CIq9gWcLI9H', 'R_7qCnRUkyPD08zGO', 'R_3e84CRbBQyQBjvX',
        'R_3rvFplrp4hr3iBH', 'R_10ivOzLSu73P1B6', 'R_32M9Pogwo7gP2YM',
        'R_4YysgirTHLontwR', 'R_5rwsIGQ0MS83TRT', 'R_4p8r1FZg0saMUFz', 'R_1Sk3Nm1afmoFlUA', 'R_6n7hKa7m4GZJFAd', 'R_6eamu3XrOX3EveH'
    ]);
    const idCleaned = nonEmpty.filter(row => !participantsToRemove.has(row['ResponseId']));

    // Drop unnecessary columns
    const columnsToDrop = new Set([
        'StartDate', 'EndDate', 'Status', 'IPAddress', 'Progress', 'Weeder', 'Duration (in seconds)',
        'Finished', 'RecordedDate', 'ResponseId', 'RecipientLastName', 'RecipientFirstName',
        'RecipientEmail', 'ExternalReference', 'LocationLatitude', 'LocationLongitude',
        'DistributionChannel', 'UserLanguage', 'Consent', 'Future_research', 'increment_quota'
    ]);
    const openTextColumnsToDrop = new Set([
        'Sex_4_TEXT', 'Employment_4_TEXT', 'Acceptability_Hu_Txt', 'Acceptability_AI_Txt', 'Concrete_Elaboration', 'AI-open', 'Future_research_1_TEXT'
    ]);
    const allDrop = new Set([...columnsToDrop, ...openTextColumnsToDrop]);
    const cleaned = idCleaned.map(row => {
        const newRow = {};
        for (const key in row) {
            if (!allDrop.has(key)) newRow[key] = row[key];
        }
        return newRow;
    });

    // Map multi-response values in 'Ethnicity' to 'Mixed Race'
    cleaned.forEach(row => {
        if ('Ethnicity' in row && typeof row['Ethnicity'] === 'string' && row['Ethnicity'].includes(',')) {
            row['Ethnicity'] = 'Mixed Race';
        }
    });

    // Bucket the Age column into ranges
    cleaned.forEach(row => {
        if ('Age' in row) {
            const age = Number(row['Age']);
            if (!isNaN(age)) {
                if (age >= 18 && age <= 24) row['Age'] = '18-24';
                else if (age <= 34) row['Age'] = '25-34';
                else if (age <= 44) row['Age'] = '35-44';
                else if (age <= 54) row['Age'] = '45-54';
                else if (age <= 64) row['Age'] = '55-64';
                else row['Age'] = '65+';
            }
        }
    });

    // Split comma-separated values in 'Domains'
    cleaned.forEach(row => {
        if ('Domains' in row && typeof row['Domains'] === 'string') {
            row['Domains'] = row['Domains'].split(',').map(s => s.trim()).filter(Boolean);
        }
    });

    // Map Vis_Role to short-names for all rows
    cleaned.forEach(row => {
        if ('Vis_Role' in row && visRoleShortNames[row['Vis_Role']]) {
            row['Vis_Role'] = visRoleShortNames[row['Vis_Role']];
        }
    });
    return cleaned;
}

/**
 * Preprocesses the Domains column: explodes comma-separated lists into multiple rows.
 * @param {Array<Object>} data - Cleaned data
 * @param {string} [domainsCol="Domains"]
 * @returns {Array<Object>} Data with one row per domain
 */
function preprocessDomainsColumn(data, domainsCol = "Domains") {
    const exploded = [];
    data.forEach(row => {
        if (Array.isArray(row[domainsCol])) {
            row[domainsCol].forEach(domain => {
                const newRow = { ...row };
                newRow[domainsCol] = domain;
                exploded.push(newRow);
            });
        } else {
            exploded.push({ ...row });
        }
    });
    return exploded;
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.cleanTeapotData = cleanTeapotData;
    window.preprocessDomainsColumn = preprocessDomainsColumn;
}
