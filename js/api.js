// Backend fetch and response normalization for aggregated chart data

const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbwcpIS5j1tKSwJm2zBWoLN-nWlfwG03gqMa8Ffi_Gd7MvB-qvTVUVDjsS3tkTVWmnS2/exec';

function normalizeBackendData(rawData) {
    if (!rawData || typeof rawData !== 'object') rawData = {};
    return {
        groups: Array.isArray(rawData.groups) ? rawData.groups : [],
        features: Array.isArray(rawData.features) ? rawData.features : [],
        data: rawData.data || {},
        dataHuman: rawData.dataHuman || {},
        dataAI: rawData.dataAI || {},
        means: rawData.means || {},
        meansHuman: rawData.meansHuman || {},
        meansAI: rawData.meansAI || {},
        stdsHuman: rawData.stdsHuman || {},
        stdsAI: rawData.stdsAI || {},
        groupCounts: rawData.groupCounts || {},
        pairedData: Array.isArray(rawData.pairedData) ? rawData.pairedData : [],
        humanGroups: Array.isArray(rawData.humanGroups) ? rawData.humanGroups : null,
        aiGroups: Array.isArray(rawData.aiGroups) ? rawData.aiGroups : null
    };
}

async function fetchAggregatedData(chartType, comparisonType) {
    const url = `${BACKEND_API_URL}?chartType=${encodeURIComponent(chartType)}&comparisonType=${encodeURIComponent(comparisonType)}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const rawData = await response.json();
    return normalizeBackendData(rawData);
}

if (typeof window !== 'undefined') {
    window.fetchAggregatedData = fetchAggregatedData;
    window.normalizeBackendData = normalizeBackendData;
}
