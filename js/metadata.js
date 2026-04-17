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
    "Shape": "Changing Shape"
};

if (typeof window !== 'undefined') {
    window.DEFAULT_COLOR_PALETTE = DEFAULT_COLOR_PALETTE;
    window.PLOTLY_QUALITATIVE_COLORS = PLOTLY_QUALITATIVE_COLORS;
    window.COMPARISON_CONFIG = COMPARISON_CONFIG;
    window.FEATURE_LABELS = FEATURE_LABELS;
}
