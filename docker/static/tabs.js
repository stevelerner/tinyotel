import { loadLogs, loadSpans, loadTraces, loadMetrics, loadServiceMap } from './api.js';
import { showTracesList, isSpanDetailOpen } from './render.js';

let currentTab = 'traces';
let autoRefreshInterval = null;
let autoRefreshEnabled = localStorage.getItem('tinyolly-auto-refresh') !== 'false';

export function initTabs() {
    const savedTab = localStorage.getItem('tinyolly-active-tab') || 'logs';
    switchTab(savedTab, null);
    updateAutoRefreshButton();
}

export function switchTab(tabName, element) {
    currentTab = tabName;
    localStorage.setItem('tinyolly-active-tab', tabName);

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        const btn = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');
    }

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const contentId = `${tabName}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.classList.add('active');
    }

    // Load data
    if (tabName === 'logs') loadLogs();
    else if (tabName === 'spans') loadSpans();
    else if (tabName === 'traces') {
        // Reset to list view when switching to traces tab
        showTracesList();
    }
    else if (tabName === 'metrics') loadMetrics();
    else if (tabName === 'map') loadServiceMap();
}

export function startAutoRefresh() {
    stopAutoRefresh();
    console.log('Auto-refresh started');

    autoRefreshInterval = setInterval(() => {
        // Don't refresh if a span detail is open
        if (currentTab === 'spans' && isSpanDetailOpen()) {
            console.log('Skipping refresh - span detail is open');
            return;
        }
        
        // Don't refresh metrics if a chart is open
        if (currentTab === 'metrics') {
            import('./metrics.js').then(module => {
                if (module.isMetricChartOpen && module.isMetricChartOpen()) {
                    console.log('Skipping refresh - metric chart is open');
                } else {
                    loadMetrics();
                }
            });
        } else if (currentTab === 'traces' && !document.getElementById('trace-detail-view').style.display.includes('block')) {
            loadTraces();
        } else if (currentTab === 'spans') {
            loadSpans();
        } else if (currentTab === 'logs') {
            loadLogs();
        } else if (currentTab === 'map') {
            loadServiceMap();
        }

        // Also refresh stats
        import('./api.js').then(module => module.loadStats());

    }, 5000);
}

export function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

export function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    localStorage.setItem('tinyolly-auto-refresh', autoRefreshEnabled);

    if (autoRefreshEnabled) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
    updateAutoRefreshButton();
}

function updateAutoRefreshButton() {
    const btn = document.getElementById('auto-refresh-btn');
    const icon = document.getElementById('refresh-icon');

    if (!btn || !icon) return;

    if (autoRefreshEnabled) {
        icon.textContent = '⏸';
        btn.title = 'Pause auto-refresh';
        btn.style.background = 'var(--primary)';
    } else {
        icon.textContent = '▶';
        btn.title = 'Resume auto-refresh';
        btn.style.background = '#6b7280';
    }
}
