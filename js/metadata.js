// Shared frontend metadata: comparison configuration, color palettes, and feature labels

const DEFAULT_COLOR_PALETTE = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];

const PLOTLY_QUALITATIVE_COLORS = [
    '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52',
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

const COMPARISON_CONFIG = {
    summary: {
        column: null,
        label: 'Summary',
        order: null,
        colorMap: { 'Summary': '#1f77b4' }
    },
    human_ai: {
        column: null,
        label: 'Human vs AI',
        order: ['Human', 'AI'],
        colorMap: { 'Human': 'peru', 'AI': 'gray' }
    },
    role: {
        column: 'Vis_Role',
        label: 'Role',
        labelMap: {
            'Creating visualizations is the primary role I perform in my work': 'Viz Practitioner',
            'I work with visualizations created by others, but I do not create or research visualization myself': 'Scientist who uses vis',
            'Researching visualization methods/techniques is my primary role': 'Vis Researcher',
            'I create visualizations to help me in my primary role, which is not visualization-related': 'Scientist who creates vis'
        },
        order: ['Vis Researcher', 'Viz Practitioner', 'Scientist who creates vis', 'Scientist who uses vis'],
        colorMap: {
            'Vis Researcher': 'red',
            'Viz Practitioner': 'orange',
            'Scientist who creates vis': 'blue',
            'Scientist who uses vis': 'green'
        }
    },
    experience: {
        column: 'Vis_Length',
        label: 'Years of vis experience',
        order: ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10-20 years', 'More than 20 years'],
        colorMap: {
            'Less than 1 year': '#5ec962',
            '1-3 years': '#3fbc73',
            '3-5 years': '#21918c',
            '5-10 years': '#31688e',
            '10-20 years': '#443983',
            'More than 20 years': '#440154'
        }
    },
    frequency_vis: {
        column: 'Vis_Frequency',
        label: 'Frequency of visualization',
        order: ['Less than once a year', 'Annually', 'Monthly', 'Weekly', 'Daily'],
        colorMap: {
            'Less than once a year': '#5ec962',
            'Annually': '#27ad81',
            'Monthly': '#21918c',
            'Weekly': '#3b528b',
            'Daily': '#440154'
        }
    },
    frequency_public: {
        column: 'Public_Frequency',
        label: 'Frequency of vis for public communication',
        order: ['Never', 'Rarely', 'Occasionally', 'Frequently', 'This is a primary part of my work'],
        colorMap: {
            'Never': '#e07b7b',
            'Rarely': '#27ad81',
            'Occasionally': '#21918c',
            'Frequently': '#3b528b',
            'This is a primary part of my work': '#440154'
        }
    },
    domain: {
        column: 'Domains',
        label: 'Domain',
        order: null,
        colorMap: null
    },
    age: {
        column: 'Age',
        label: 'Age',
        order: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
        colorMap: {
            '18-24': '#5ec962',
            '25-34': '#3fbc73',
            '35-44': '#21918c',
            '45-54': '#31688e',
            '55-64': '#443983',
            '65+': '#440154'
        }
    },
    tool_use: {
        column: 'Tool_use',
        label: 'Would use an AI tool for beautification',
        order: ['Yes', 'Maybe', 'No'],
        colorMap: {
            'Yes': '#1976d2',
            'Maybe': '#8e24aa',
            'No': '#d32f2f'
        }
    }
};

const FEATURE_LABELS = {
    "CamPos": "Camera Position",
    "Smoothing": "Smoothing",
    "Lighting": "Lighting",
    "Color": "Color Remapping",
    "Errors": "Removing Errors",
    "Details": "Enhancing Details",
    "Textures": "Adding Textures",
    "BgImage": "Background Image",
    "Blur": "Camera Focus/Blur",
    "BgItems": "Background Items",
    "Gaps": "Filling in Gaps",
    "Position": "Changing Positions",
    "FeatureOmission": "Feature Omission",
    "FeatureAddition": "Feature Addition",
    "Shape": "Changing Shape",
    "Use_Cases_1": "Social Media Post",
    "Use_Cases_2": "Research Paper",
    "Use_Cases_3": "Research Conference Slide",
    "Use_Cases_4": "Public Talk Slide",
    "Use_Cases_5": "Press Release",
    "Use_Cases_6": "Grant Proposal",
    "Comfort_1": "Validated by an Expert",
    "Comfort_2": "Understand Data-to-Visual Mapping",
    "Comfort_3": "AI Use Was Disclosed",
    "Comfort_4": "Detailed AI Process Information",
    "Importance_1": "Ability to Revise or Iterate",
    "Importance_2": "Understand What Changed and Why"
};

const RESPONSE_SCALES = {
    acceptability: {
        title: 'Acceptability',
        tickvals: [0, 1, 2, 3, 4, 5],
        ticktext: ["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
        range: [-0.5, 5.5],
        colors: ['#b2182b', '#d6604d', '#f4a582', '#d9f0d3', '#7fbf7b', '#1b7837']
    },
    use_case_acceptability: {
        title: 'Acceptability',
        tickvals: [0, 1, 2, 3, 4],
        ticktext: ["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Always (4)"],
        range: [-0.5, 4.5],
        colors: ['#b2182b', '#ef8a62', '#fddbc7', '#a6dba0', '#1b7837']
    },
    comfort_importance: {
        title: 'Importance',
        tickvals: [0, 1, 2, 3, 4],
        ticktext: [
            "Not at all (0)",
            "Slightly (1)",
            "Moderately (2)",
            "Very (3)",
            "Extremely (4)"
        ],
        range: [-0.5, 4.5],
        colors: ['#dbeafe', '#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8']
    },
    importance: {
        title: 'Importance',
        tickvals: [0, 1, 2, 3, 4],
        ticktext: [
            "Not at all (0)",
            "Slightly (1)",
            "Moderately (2)",
            "Very much (3)",
            "Extremely (4)"
        ],
        range: [-0.5, 4.5],
        colors: ['#dbeafe', '#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8']
    }
};

const CONTEXT_VIEW_CONFIG = {
    use_cases: {
        label: 'Use Cases',
        features: ['Use_Cases_1', 'Use_Cases_2', 'Use_Cases_3', 'Use_Cases_4', 'Use_Cases_5', 'Use_Cases_6'],
        responseScale: 'use_case_acceptability',
        plotTitlePrefix: 'Context',
        combineFeatures: true,
        combinedPlotTitle: 'Acceptability by Context'
    },
    comfort: {
        label: 'Comfort',
        features: ['Comfort_1', 'Comfort_2', 'Comfort_3', 'Comfort_4'],
        responseScale: 'comfort_importance',
        plotTitlePrefix: 'Comfort Condition',
        combineFeatures: true,
        combinedPlotTitle: 'Importance of Comfort Conditions'
    },
    importance: {
        label: 'Importance',
        features: ['Importance_1', 'Importance_2'],
        responseScale: 'importance',
        plotTitlePrefix: 'Process Factor',
        combineFeatures: true,
        combinedPlotTitle: 'Importance of Process Factors'
    }
};

function generateColorScale(legend) {
    const colorMap = {};
    (legend || []).forEach((item, index) => {
        colorMap[item] = DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length];
    });
    return colorMap;
}

function getComparisonConfig(comparisonType) {
    return COMPARISON_CONFIG[comparisonType] || {
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

function getContextViewConfig(view) {
    return CONTEXT_VIEW_CONFIG[view] || {
        label: 'Use Cases',
        features: ['Use_Cases_1', 'Use_Cases_2', 'Use_Cases_3', 'Use_Cases_4', 'Use_Cases_5', 'Use_Cases_6'],
        responseScale: 'use_case_acceptability',
        plotTitlePrefix: 'Context',
        combineFeatures: true,
        combinedPlotTitle: 'Acceptability by Context'
    };
}

if (typeof window !== 'undefined') {
    window.DEFAULT_COLOR_PALETTE = DEFAULT_COLOR_PALETTE;
    window.PLOTLY_QUALITATIVE_COLORS = PLOTLY_QUALITATIVE_COLORS;
    window.COMPARISON_CONFIG = COMPARISON_CONFIG;
    window.FEATURE_LABELS = FEATURE_LABELS;
    window.RESPONSE_SCALES = RESPONSE_SCALES;
    window.CONTEXT_VIEW_CONFIG = CONTEXT_VIEW_CONFIG;
    window.generateColorScale = generateColorScale;
    window.getComparisonConfig = getComparisonConfig;
    window.getComparisonLabel = getComparisonLabel;
    window.getContextViewConfig = getContextViewConfig;
}
