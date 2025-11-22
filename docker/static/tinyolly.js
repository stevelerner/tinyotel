import { initTabs, startAutoRefresh, switchTab, toggleAutoRefresh } from './tabs.js';
import { loadStats, loadLogs } from './api.js';
import { initTheme, toggleTheme } from './theme.js';
import {
    showTraceDetail,
    showTracesList,
    toggleTraceJSON,
    copyTraceJSON,
    downloadTraceJSON,
    showLogsForTrace,
    toggleLogJson,
    clearLogFilter,
    filterMetrics
} from './render.js';

// Expose functions to global scope for HTML onclick handlers
window.switchTab = switchTab;
window.toggleTheme = toggleTheme;
window.toggleAutoRefresh = toggleAutoRefresh;
window.showTraceDetail = showTraceDetail;
window.showTracesList = showTracesList;
window.toggleTraceJSON = toggleTraceJSON;
window.copyTraceJSON = copyTraceJSON;
window.downloadTraceJSON = downloadTraceJSON;
window.showLogsForTrace = showLogsForTrace;
window.toggleLogJson = toggleLogJson;
window.clearLogFilter = clearLogFilter;
window.loadLogs = loadLogs; // Needed for filter button
window.filterMetrics = filterMetrics;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    loadStats();

    if (localStorage.getItem('tinyolly-auto-refresh') !== 'false') {
        startAutoRefresh();
    }
});
