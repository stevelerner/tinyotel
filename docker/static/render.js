// render.js - Main rendering module that re-exports from specialized modules

// Import and re-export from specialized modules
export { renderTraces, showTraceDetail, showTracesList, toggleTraceJSON, copyTraceJSON, downloadTraceJSON, showLogsForTrace } from './traces.js';
export { renderSpans, isSpanDetailOpen } from './spans.js';
export { renderLogs } from './logs.js';
export { renderMetrics } from './metrics.js';
export { renderServiceMap } from './serviceMap.js';

// Legacy compatibility - stats rendering is no longer displayed
export function renderStats(stats) {
    // Stats are no longer displayed in the UI
}
