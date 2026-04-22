// Backend fetch and response normalization for aggregated chart data

const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbwGAibcEAKzTwJ0lK6Kj6gaOA3Q2RU8cFMM-F37yrjijlizPQl37QtjNa-WH4kKQLbj/exec';

function normalizeBackendData(rawData) {
    if (!rawData || typeof rawData !== 'object') rawData = {};
    return {
        groups: Array.isArray(rawData.groups) ? rawData.groups : [],
        features: Array.isArray(rawData.features) ? rawData.features : [],
        data: rawData.data || {},
        stds: rawData.stds || {},
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

function loadJsonp(url) {
    return new Promise((resolve, reject) => {
        const callbackName = `__beautifyVisResultsJsonpCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const callbackUrl = `${url}${url.includes('?') ? '&' : '?'}callback=${callbackName}`;
        const script = document.createElement('script');

        window[callbackName] = (data) => {
            cleanup();
            resolve(data);
        };

        script.src = callbackUrl;
        script.async = true;
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP request failed'));
        };

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timed out'));
        }, 10000);

        function cleanup() {
            clearTimeout(timeout);
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            delete window[callbackName];
        }

        document.head.appendChild(script);
    });
}

async function fetchAggregatedData(chartType, comparisonType, options = {}) {
    const tab = options.tab || 'alterations';
    const view = options.view || 'importance';
    // Stacked bars reuse the same aggregated score payload as box plots, so this
    // remains compatible with the currently deployed Apps Script until it is redeployed.
    const backendChartType = chartType === 'stacked' ? 'box' : chartType;
    const url = `${BACKEND_API_URL}?chartType=${encodeURIComponent(backendChartType)}&comparisonType=${encodeURIComponent(comparisonType)}&tab=${encodeURIComponent(tab)}&view=${encodeURIComponent(view)}`;
    const isLocal = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:'
    );

    if (isLocal) {
        try {
            const rawData = await loadJsonp(url);
            return normalizeBackendData(rawData);
        } catch (jsonpErr) {
            throw new Error(`Unable to load backend data locally via JSONP: ${jsonpErr.message}`);
        }
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const rawData = await response.json();
        return normalizeBackendData(rawData);
    } catch (err) {
        try {
            const rawData = await loadJsonp(url);
            return normalizeBackendData(rawData);
        } catch (jsonpErr) {
            throw new Error(`Backend request failed: ${err.message}. JSONP fallback also failed: ${jsonpErr.message}`);
        }
    }
}

if (typeof window !== 'undefined') {
    window.fetchAggregatedData = fetchAggregatedData;
    window.normalizeBackendData = normalizeBackendData;
}
