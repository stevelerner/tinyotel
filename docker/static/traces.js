import { formatTime, formatTraceId, copyToClipboard, downloadJson } from './utils.js';
import { fetchTraceDetail, loadTraces } from './api.js';

// State variables for traces
let currentTraceId = null;
let currentTraceData = null;
let selectedSpanIndex = null;

// --- Traces Rendering ---
export function renderTraces(traces) {
    const container = document.getElementById('traces-container');

    if (traces.length === 0) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">-</div><div>No traces yet. Send some data to get started!</div></div>';
        return;
    }

    const limitNote = traces.length >= 50 ? '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">Showing last 50 traces (older data available in Redis).</div>' : '';

    const headerRow = `
        <div class="trace-header-row" style="display: flex; align-items: center; gap: 15px; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--bg-secondary); font-weight: bold; font-size: 0.9em; color: var(--text-muted);">
            <div style="flex: 0 0 100px;">Time</div>
            <div style="flex: 0 0 260px;">traceId</div>
            <div style="flex: 0 0 60px; text-align: right;">Spans</div>
            <div style="flex: 0 0 80px;">Duration</div>
            <div style="flex: 0 0 70px;">Method</div>
            <div style="flex: 1;">Route / URL</div>
            <div style="flex: 0 0 60px; text-align: right;">Status</div>
        </div>
    `;

    container.innerHTML = limitNote + headerRow + traces.map(trace => {
        const displayTraceId = formatTraceId(trace.trace_id);
        const startTime = formatTime(trace.start_time);

        // Determine method, route, and status
        const method = trace.root_span_method || '';
        let route = trace.root_span_route || trace.root_span_name;

        // Construct detailed URL info if available
        if (trace.root_span_url) {
            route = trace.root_span_url;
            try {
                const url = new URL(trace.root_span_url);
                route = `<span style="color: var(--text-muted); font-weight: normal;">${url.protocol}//${url.host}</span>${url.pathname}${url.search}`;
            } catch (e) {
                route = trace.root_span_url;
            }
        } else if (trace.root_span_server_name || trace.root_span_host) {
            const scheme = trace.root_span_scheme ? trace.root_span_scheme + '://' : '';
            const host = trace.root_span_host || trace.root_span_server_name || '';
            const target = trace.root_span_target || trace.root_span_route || '';
            if (host) {
                route = `<span style="color: var(--text-muted); font-weight: normal;">${scheme}${host}</span>${target}`;
            }
        }

        let status = trace.root_span_status_code;
        if (!status && trace.root_span_status) {
            if (trace.root_span_status.code === 1) status = 'OK';
            else if (trace.root_span_status.code === 2) status = 'ERR';
        }

        let statusColor = 'var(--text-muted)';
        if (status) {
            const s = String(status);
            if (s.startsWith('2') || s === 'OK') statusColor = 'var(--success)';
            else if (s.startsWith('4')) statusColor = '#f59e0b'; // Orange
            else if (s.startsWith('5') || s === 'ERR') statusColor = 'var(--error)';
        }

        return `
            <div class="trace-item" data-trace-id="${trace.trace_id}" style="display: flex; align-items: center; gap: 15px; padding: 8px 12px;">
                <div class="trace-time" style="font-family: monospace; color: var(--text-muted); flex: 0 0 100px;">${startTime}</div>
                <div class="trace-id" style="flex: 0 0 260px; font-family: monospace; color: var(--text-muted); font-size: 0.9em;">${displayTraceId}</div>
                <div class="trace-spans" style="flex: 0 0 60px; text-align: right; color: var(--text-muted);">${trace.span_count}</div>
                <div class="trace-duration" style="flex: 0 0 80px; color: var(--text-muted);">${trace.duration_ms.toFixed(2)}ms</div>
                <div class="trace-method" style="flex: 0 0 70px; font-weight: bold; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${method}</div>
                <div class="trace-name" style="flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${route}</div>
                <div class="trace-status" style="flex: 0 0 60px; text-align: right; color: ${statusColor}; font-weight: 500;">${status || '-'}</div>
            </div>
        `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.trace-item').forEach(item => {
        item.addEventListener('click', () => showTraceDetail(item.dataset.traceId));
    });
}

export function showTraceDetail(traceId) {
    currentTraceId = traceId;

    // Show detail view, hide list
    document.getElementById('traces-list-view').style.display = 'none';
    document.getElementById('trace-detail-view').style.display = 'block';

    // Load trace details
    fetchTraceDetail(traceId).then(trace => {
        if (trace) {
            renderWaterfall(trace);
        }
    });
}

export function showTracesList() {
    document.getElementById('traces-list-view').style.display = 'block';
    document.getElementById('trace-detail-view').style.display = 'none';
    currentTraceId = null;
    currentTraceData = null;
    loadTraces(); // Refresh list
}

export function toggleTraceJSON() {
    const jsonView = document.getElementById('trace-json-view');
    const jsonContent = document.getElementById('trace-json-content');
    if (jsonView.style.display === 'none') {
        jsonView.style.display = 'block';
        jsonContent.textContent = JSON.stringify(currentTraceData, null, 2);
        // Scroll to JSON view
        jsonView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        jsonView.style.display = 'none';
    }
}

export function copyTraceJSON() {
    const jsonContent = document.getElementById('trace-json-content').textContent;
    const feedback = document.getElementById('copy-trace-feedback');
    copyToClipboard(jsonContent, feedback);
}

export function downloadTraceJSON() {
    downloadJson(currentTraceData, `trace-${currentTraceId}.json`);
}

export function showLogsForTrace() {
    if (!currentTraceId) return;

    // Actually, we can just use the global switchTab since we exposed it in tinyolly.js
    // Or better, just manipulate the DOM directly since this is a view logic

    // Actually, we can just use the global switchTab since we exposed it in tinyolly.js
    if (window.switchTab) {
        window.switchTab('logs');
    }

    // Set filter and load logs
    const filterInput = document.getElementById('trace-id-filter');
    if (filterInput) {
        filterInput.value = currentTraceId;
    }
    
    // Import loadLogs dynamically to avoid circular dependency
    import('./api.js').then(module => {
        module.loadLogs(currentTraceId);
    });
}

function renderWaterfall(trace) {
    const spans = trace.spans;
    currentTraceData = trace;
    selectedSpanIndex = null;

    // Find trace bounds
    const startTimes = spans.map(s => s.startTimeUnixNano || s.start_time || 0);
    const endTimes = spans.map(s => s.endTimeUnixNano || s.end_time || 0);
    const traceStart = Math.min(...startTimes);
    const traceEnd = Math.max(...endTimes);
    const traceDuration = traceEnd - traceStart;
    const traceDurationMs = traceDuration / 1_000_000;

    const container = document.getElementById('trace-detail-container');
    const displayTraceId = formatTraceId(trace.trace_id);

    // Create time markers
    const timeMarkers = [0, 0.25, 0.5, 0.75, 1.0].map(fraction => {
        const timeMs = traceDurationMs * fraction;
        let className = 'time-marker';
        let positionStyle = `left: ${fraction * 100}%;`;

        if (fraction === 0) className += ' first';
        else if (fraction === 1.0) {
            className += ' last';
            positionStyle = '';
        }

        return `<div class="${className}" style="${positionStyle}">${timeMs.toFixed(2)}ms</div>`;
    }).join('');

    container.innerHTML = `
        <h2>Trace: ${displayTraceId}</h2>
        <p>${trace.span_count} spans - ${traceDurationMs.toFixed(2)}ms total</p>
        <div class="waterfall">
            ${spans.map((span, idx) => {
        const startTime = span.startTimeUnixNano || span.start_time || 0;
        const endTime = span.endTimeUnixNano || span.end_time || 0;
        const duration = endTime - startTime;
        const offset = startTime - traceStart;

        const leftPercent = (offset / traceDuration) * 100;
        const widthPercent = (duration / traceDuration) * 100;

        return `
                    <div class="span-row">
                        <div class="span-info">
                            <div class="span-name" title="${span.name}">${span.name}</div>
                            <div class="span-timeline">
                                <div class="span-bar" data-span-index="${idx}" style="left: ${leftPercent}%; width: ${widthPercent}%;">
                                    ${duration > traceDuration * 0.1 ? (duration / 1_000_000).toFixed(2) + 'ms' : ''}
                                </div>
                            </div>
                            <div class="span-duration">${(duration / 1_000_000).toFixed(2)}ms</div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
        <div class="time-axis">
            <div class="time-markers">
                ${timeMarkers}
            </div>
        </div>
        <div id="span-json-container"></div>
    `;

    // Add click handlers
    container.querySelectorAll('.span-bar').forEach(bar => {
        bar.addEventListener('click', (e) => {
            const spanIndex = parseInt(e.currentTarget.getAttribute('data-span-index'));
            showSpanJson(spanIndex);
        });
    });
}

function showSpanJson(spanIndex) {
    if (!currentTraceData || !currentTraceData.spans[spanIndex]) return;

    const span = currentTraceData.spans[spanIndex];
    const container = document.getElementById('span-json-container');

    document.querySelectorAll('.span-bar').forEach((bar, idx) => {
        bar.classList.toggle('selected', idx === spanIndex);
    });

    selectedSpanIndex = spanIndex;

    container.innerHTML = `
        <div class="span-json-view" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div style="font-size: 14px; font-weight: 600; color: var(--text-main);">
                    Span: ${span.name} 
                    <span style="font-weight: normal; color: var(--text-muted); font-size: 0.9em; margin-left: 8px; font-family: 'JetBrains Mono', monospace;">
                        (spanId: ${span.spanId || span.span_id})
                    </span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="copy-span-json-btn" style="padding: 6px 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px; font-size: 12px;">
                        Copy JSON
                    </button>
                    <button id="download-span-json-btn" style="padding: 6px 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px; font-size: 12px;">
                        Download JSON
                    </button>
                    <button id="close-span-json-btn" style="padding: 6px 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px; font-size: 12px;">
                        Close
                    </button>
                    <span id="copy-span-json-feedback" style="color: var(--success); font-size: 12px; display: none; margin-left: 8px;">Copied!</span>
                </div>
            </div>
            <div style="background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; overflow: auto; max-height: 500px;">
                <pre style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-main); margin: 0; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5;">${JSON.stringify(span, null, 2)}</pre>
            </div>
        </div>
    `;

    // Attach handlers for the buttons
    document.getElementById('copy-span-json-btn').onclick = () => {
        const feedback = document.getElementById('copy-span-json-feedback');
        copyToClipboard(JSON.stringify(span, null, 2), feedback);
    };
    
    document.getElementById('download-span-json-btn').onclick = () => {
        const spanId = span.spanId || span.span_id;
        downloadJson(span, `span-${spanId}.json`);
    };
    
    document.getElementById('close-span-json-btn').onclick = () => {
        container.innerHTML = '';
        document.querySelectorAll('.span-bar').forEach(bar => bar.classList.remove('selected'));
        selectedSpanIndex = null;
    };
}

