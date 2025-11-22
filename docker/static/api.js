import { renderSpans, renderTraces, renderLogs, renderMetrics, renderServiceMap, renderStats } from './render.js';

export async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        renderStats(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

export async function loadTraces() {
    try {
        const response = await fetch('/api/traces?limit=50');
        const traces = await response.json();
        renderTraces(traces);
    } catch (error) {
        console.error('Error loading traces:', error);
        document.getElementById('traces-container').innerHTML = '<div class="empty">Error loading traces</div>';
    }
}

export async function loadSpans() {
    try {
        const response = await fetch('/api/spans?limit=50');
        const spans = await response.json();
        renderSpans(spans);
    } catch (error) {
        console.error('Error loading spans:', error);
    }
}

export async function loadLogs(filterTraceId = null) {
    try {
        let url = '/api/logs?limit=100';
        if (filterTraceId) {
            url += `&trace_id=${filterTraceId}`;
        } else {
            const input = document.getElementById('trace-id-filter');
            if (input && input.value) {
                url += `&trace_id=${input.value.trim()}`;
            }
        }

        const response = await fetch(url);
        const logs = await response.json();
        renderLogs(logs, 'logs-container');
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logs-container').innerHTML = '<div class="empty">Error loading logs</div>';
    }
}

export async function loadMetrics() {
    try {
        const response = await fetch('/api/metrics');
        const metrics = await response.json();
        renderMetrics(metrics);
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

export async function loadServiceMap() {
    try {
        const response = await fetch('/api/service-map?limit=100');
        const graph = await response.json();
        renderServiceMap(graph);
    } catch (error) {
        console.error('Error loading service map:', error);
    }
}

export async function fetchTraceDetail(traceId) {
    const response = await fetch(`/api/traces/${traceId}`);
    return await response.json();
}
