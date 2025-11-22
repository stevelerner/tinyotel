import { formatTime, formatTraceId, getLogStableId, copyToClipboard, downloadJson } from './utils.js';
import { fetchTraceDetail, loadLogs, loadTraces } from './api.js';

// State variables needed for rendering
let currentTraceId = null;
let currentTraceData = null;
let traceJsonOpen = false;
let selectedSpanIndex = null;
let mapNodes = [];
let mapEdges = [];

// --- Stats Rendering ---
export function renderStats(stats) {
    // Stats are no longer displayed in the UI
}

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

// --- Spans Rendering ---
let currentSpanDetail = null;
let currentSpanData = null;

export function renderSpans(spans) {
    const container = document.getElementById('spans-container');
    if (!container) return;

    if (spans.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No spans found</div>';
        return;
    }

    const limitNote = `
        <div style="padding: 8px 12px; background: var(--bg-hover); border-bottom: 1px solid var(--border); font-size: 0.85em; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
            <span>ℹ️ Showing last 50 spans</span>
        </div>
    `;

    const headerRow = `
        <div class="trace-header-row" style="display: flex; align-items: center; gap: 15px; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--bg-secondary); font-weight: bold; font-size: 0.9em; color: var(--text-muted);">
            <div style="flex: 0 0 100px;">Time</div>
            <div style="flex: 0 0 260px;">traceId</div>
            <div style="flex: 0 0 180px;">spanId</div>
            <div style="flex: 0 0 80px;">Duration</div>
            <div style="flex: 0 0 70px;">Method</div>
            <div style="flex: 1;">Route / URL</div>
            <div style="flex: 0 0 60px; text-align: right;">Status</div>
        </div>
    `;

    container.innerHTML = limitNote + headerRow + spans.map(span => {
        const displayTraceId = formatTraceId(span.trace_id);
        const displaySpanId = formatTraceId(span.span_id);
        const startTime = formatTime(span.start_time);

        const method = span.method || '';
        let route = span.route || span.name;

        if (span.url) {
            route = span.url;
            try {
                const url = new URL(span.url);
                route = `<span style="color: var(--text-muted); font-weight: normal;">${url.protocol}//${url.host}</span>${url.pathname}${url.search}`;
            } catch (e) {
                route = span.url;
            }
        } else if (span.server_name || span.host) {
            const scheme = span.scheme ? span.scheme + '://' : '';
            const host = span.host || span.server_name || '';
            const target = span.target || span.route || '';
            if (host) {
                route = `<span style="color: var(--text-muted); font-weight: normal;">${scheme}${host}</span>${target}`;
            }
        }

        let status = span.status_code;
        if (!status && span.status) {
            if (span.status.code === 1) status = 'OK';
            else if (span.status.code === 2) status = 'ERR';
        }

        let statusColor = 'var(--text-muted)';
        if (status) {
            const s = String(status);
            if (s.startsWith('2') || s === 'OK') statusColor = 'var(--success)';
            else if (s.startsWith('4')) statusColor = '#f59e0b';
            else if (s.startsWith('5') || s === 'ERR') statusColor = 'var(--error)';
        }

        return `
            <div class="trace-item" data-span-id="${span.span_id}" style="display: flex; align-items: center; gap: 15px; padding: 8px 12px; cursor: pointer;">
                <div class="trace-time" style="font-family: monospace; color: var(--text-muted); flex: 0 0 100px;">${startTime}</div>
                <div class="trace-id" style="flex: 0 0 260px; font-family: monospace; color: var(--text-muted); font-size: 0.9em;">${displayTraceId}</div>
                <div class="span-id" style="flex: 0 0 180px; font-family: monospace; color: var(--text-muted); font-size: 0.9em;">${displaySpanId}</div>
                <div class="trace-duration" style="flex: 0 0 80px; color: var(--text-muted);">${span.duration_ms.toFixed(2)}ms</div>
                <div class="trace-method" style="flex: 0 0 70px; font-weight: bold; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${method}</div>
                <div class="trace-name" style="flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${route}</div>
                <div class="trace-status" style="flex: 0 0 60px; text-align: right; color: ${statusColor}; font-weight: 500;">${status || '-'}</div>
            </div>
        `;
    }).join('');

    // Add click handlers (same pattern as traces)
    container.querySelectorAll('.trace-item').forEach(item => {
        item.addEventListener('click', () => {
            const spanId = item.dataset.spanId;
            const span = spans.find(s => s.span_id === spanId);
            if (span) {
                currentSpanData = span;
                showSpanDetail(spanId, spans);
            }
        });
    });
    
    // Restore span detail if one was showing and span still exists
    if (currentSpanDetail && currentSpanData) {
        const stillExists = spans.find(s => s.span_id === currentSpanDetail);
        if (stillExists) {
            setTimeout(() => showSpanDetail(currentSpanDetail, spans), 10);
        }
    }
}

function showSpanDetail(spanId, spans) {
    let span = currentSpanData;
    if (!span || span.span_id !== spanId) {
        span = spans.find(s => s.span_id === spanId);
    }
    if (!span) return;
    
    currentSpanDetail = spanId;
    currentSpanData = span;
    const detailContainer = document.getElementById('span-detail-container');
    if (!detailContainer) return;
    
    detailContainer.style.display = 'block';
    detailContainer.innerHTML = `
        <div class="span-json-container" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
            <div class="span-json-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div class="span-json-title" style="font-size: 13px; font-weight: 600; color: var(--text-main);">
                    Span: ${span.name} 
                    <span style="font-weight: normal; color: var(--text-muted); font-size: 0.9em; margin-left: 8px; font-family: 'JetBrains Mono', monospace;">
                        (spanId: ${formatTraceId(span.span_id)})
                    </span>
                </div>
                <div class="span-json-actions" style="display: flex; gap: 8px;">
                    <button id="copy-span-btn" style="background: var(--border-color); border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; color: var(--text-muted);">
                        Copy JSON
                    </button>
                    <button id="download-span-btn" style="background: var(--border-color); border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; color: var(--text-muted);">
                        Download JSON
                    </button>
                    <button id="close-span-btn" style="background: var(--border-color); border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; color: var(--text-muted);">
                        Close
                    </button>
                </div>
            </div>
            <div style="background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; overflow: auto; max-height: 500px;">
                <pre style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-main); margin: 0; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(span, null, 2)}</pre>
            </div>
        </div>
    `;
    
    // Attach event handlers
    document.getElementById('copy-span-btn').addEventListener('click', () => {
        copyToClipboard(JSON.stringify(span, null, 2), { 
            style: { display: 'none' },
            textContent: 'Copied!'
        });
        const btn = document.getElementById('copy-span-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = 'var(--border-color)';
            btn.style.color = 'var(--text-muted)';
        }, 2000);
    });
    
    document.getElementById('download-span-btn').addEventListener('click', () => {
        downloadJson(span, `span-${span.span_id}.json`);
    });
    
    document.getElementById('close-span-btn').addEventListener('click', () => {
        detailContainer.style.display = 'none';
        detailContainer.innerHTML = '';
        currentSpanDetail = null;
        currentSpanData = null;
    });
}

export function preserveSpanDetail() {
    // Called after rendering to restore the span detail if one was open
    if (currentSpanDetail) {
        const detailContainer = document.getElementById('span-detail-container');
        if (detailContainer && detailContainer.innerHTML) {
            // Detail is already showing, keep it
            return;
        }
    }
}

// --- Logs Rendering ---
export function renderLogs(logs, containerId = 'logs-container') {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    if (logs.length === 0) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">📝</div><div>No logs found</div></div>';
        return;
    }

    // Build table with headers
    const headerRow = `
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 2px solid var(--border-color); background: var(--bg-secondary); font-weight: bold; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
            <div style="flex: 0 0 100px;">Time</div>
            <div style="flex: 0 0 60px;">Severity</div>
            <div style="flex: 0 0 120px;">Service</div>
            <div style="flex: 0 0 180px;">traceId</div>
            <div style="flex: 0 0 140px;">spanId</div>
            <div style="flex: 1; min-width: 200px;">Message</div>
        </div>
    `;

    const logsHtml = logs.map(log => {
        const timestamp = new Date(log.timestamp * 1000).toLocaleTimeString([], { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            fractionalSecondDigits: 3 
        });
        
        const severity = log.severity || 'INFO';
        const traceId = log.traceId || log.trace_id;
        const spanId = log.spanId || log.span_id;
        
        return `
            <div class="log-row" style="display: flex; align-items: flex-start; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px;">
                <div style="flex: 0 0 100px; font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">${timestamp}</div>
                <div style="flex: 0 0 60px;">
                    <span class="log-severity ${severity}" style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-weight: 600; font-size: 10px; text-align: center;">${severity}</span>
                </div>
                <div style="flex: 0 0 120px; color: var(--text-main); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.service_name || ''}">${log.service_name || '-'}</div>
                <div style="flex: 0 0 180px; font-family: 'JetBrains Mono', monospace; font-size: 10px;">
                    ${traceId ? `<a class="log-trace-link" data-trace-id="${traceId}" style="color: var(--primary); cursor: pointer; text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${traceId}">${formatTraceId(traceId)}</a>` : '<span style="color: var(--text-muted);">-</span>'}
                </div>
                <div style="flex: 0 0 140px; font-family: 'JetBrains Mono', monospace; font-size: 10px;">
                    ${spanId ? `<span style="color: var(--text-muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${spanId}">${formatTraceId(spanId)}</span>` : '<span style="color: var(--text-muted);">-</span>'}
                </div>
                <div style="flex: 1; min-width: 200px; color: var(--text-main); word-break: break-word;">${log.message || ''}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = headerRow + logsHtml;
    
    // Add click handlers for trace links using event delegation
    container.addEventListener('click', (e) => {
        const traceLink = e.target.closest('.log-trace-link');
        if (traceLink) {
            e.preventDefault();
            const traceId = traceLink.dataset.traceId;
            if (traceId && window.showTraceDetail) {
                // Switch to traces tab first
                if (window.switchTab) {
                    window.switchTab('traces');
                }
                // Then show the trace detail
                setTimeout(() => window.showTraceDetail(traceId), 100);
            }
        }
    });
}

// --- Metrics Rendering ---
export function renderMetrics(metricsData) {
    const container = document.getElementById('metrics-container');

    if (!metricsData || !metricsData.names || metricsData.names.length === 0) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div>No metrics collected yet</div></div>';
        return;
    }

    const metricNames = metricsData.names;

    // Build table header
    let html = `
        <div class="metrics-table-header">
            <div class="metric-header-cell">Metric Name</div>
            <div class="metric-header-cell">Type</div>
            <div class="metric-header-cell">Latest Value</div>
            <div class="metric-header-cell">⚙️</div>
        </div>
    `;

    // For now, show metric names - we'd need to fetch individual metric data to show values
    metricNames.forEach(name => {
        html += `
            <div class="metric-row" data-metric-name="${name.toLowerCase()}">
                <div class="metric-header">
                    <div class="metric-cell metric-col-name">${name}</div>
                    <div class="metric-cell metric-col-type">
                        <span class="metric-type-badge metric-type-gauge">Metric</span>
                    </div>
                    <div class="metric-cell metric-col-value">-</div>
                    <div class="metric-cell">➤</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// --- Service Map Rendering ---
export function renderServiceMap(graph) {
    const canvas = document.getElementById('service-map-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    document.getElementById('map-loading').style.display = 'none';

    // Resize canvas
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize nodes if needed
    if (mapNodes.length === 0 || JSON.stringify(mapNodes.map(n => n.id)) !== JSON.stringify(graph.nodes.map(n => n.id))) {
        mapNodes = graph.nodes.map(n => ({
            ...n,
            x: Math.random() * width,
            y: Math.random() * height,
            vx: 0,
            vy: 0
        }));
    }

    mapEdges = graph.edges;

    // Run simulation
    for (let i = 0; i < 50; i++) {
        simulateForceLayout(width, height);
    }

    // Draw
    ctx.clearRect(0, 0, width, height);

    // Draw edges
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;

    mapEdges.forEach(edge => {
        const source = mapNodes.find(n => n.id === edge.source);
        const target = mapNodes.find(n => n.id === edge.target);

        if (source && target) {
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();

            // Draw arrow
            const angle = Math.atan2(target.y - source.y, target.x - source.x);
            const headLen = 10;
            ctx.beginPath();
            ctx.moveTo(target.x - headLen * Math.cos(angle - Math.PI / 6), target.y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(target.x, target.y);
            ctx.lineTo(target.x - headLen * Math.cos(angle + Math.PI / 6), target.y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.fillStyle = '#999';
            ctx.fill();

            // Draw label
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            ctx.fillStyle = '#666';
            ctx.font = '10px Arial';
            ctx.fillText(edge.value, midX, midY);
        }
    });

    // Draw nodes
    mapNodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#2c5aa0';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + 35);
    });
}

function simulateForceLayout(width, height) {
    const k = 100; // Ideal length
    const repulsion = 5000;

    // Repulsion
    for (let i = 0; i < mapNodes.length; i++) {
        for (let j = i + 1; j < mapNodes.length; j++) {
            const n1 = mapNodes[i];
            const n2 = mapNodes[j];
            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const d2 = dx * dx + dy * dy + 0.1;
            const f = repulsion / d2;
            const fx = f * dx / Math.sqrt(d2);
            const fy = f * dy / Math.sqrt(d2);

            n1.vx += fx;
            n1.vy += fy;
            n2.vx -= fx;
            n2.vy -= fy;
        }
    }

    // Attraction (Edges)
    mapEdges.forEach(edge => {
        const source = mapNodes.find(n => n.id === edge.source);
        const target = mapNodes.find(n => n.id === edge.target);

        if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const f = (d - k) * 0.05;
            const fx = f * dx / d;
            const fy = f * dy / d;

            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
        }
    });

    // Center gravity
    mapNodes.forEach(node => {
        const dx = width / 2 - node.x;
        const dy = height / 2 - node.y;
        node.vx += dx * 0.01;
        node.vy += dy * 0.01;

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Damping
        node.vx *= 0.9;
        node.vy *= 0.9;

        // Bounds
        node.x = Math.max(20, Math.min(width - 20, node.x));
        node.y = Math.max(20, Math.min(height - 20, node.y));
    });
}

// --- Trace Detail Rendering ---
export async function showTraceDetail(traceId) {
    currentTraceId = traceId;

    try {
        const trace = await fetchTraceDetail(traceId);
        currentTraceData = trace;

        // Hide list, show detail
        document.getElementById('traces-list-view').style.display = 'none';
        document.getElementById('trace-detail-view').style.display = 'block';

        // Setup JSON view state
        const jsonView = document.getElementById('trace-json-view');
        if (traceJsonOpen && currentTraceData) {
            jsonView.style.display = 'block';
            document.getElementById('trace-json-content').textContent = JSON.stringify(currentTraceData, null, 2);
        } else {
            jsonView.style.display = 'none';
            traceJsonOpen = false;
        }

        renderWaterfall(trace);

        // Load correlated logs
        try {
            const response = await fetch(`/api/logs?limit=100&trace_id=${traceId}`);
            const logs = await response.json();
            renderLogs(logs, 'trace-logs-container');
        } catch (error) {
            console.error('Error loading trace logs:', error);
            document.getElementById('trace-logs-container').innerHTML = '<div class="empty">No logs found for this trace</div>';
        }

    } catch (error) {
        console.error('Error loading trace detail:', error);
    }
}

export function showLogsForTrace() {
    if (!currentTraceId) return;

    // Switch to logs tab
    // We need to import switchTab from tabs.js, but that creates a circular dependency
    // Instead, let's dispatch a custom event or use the global window.switchTab if available
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
    loadLogs(currentTraceId);
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
        traceJsonOpen = true;
    } else {
        jsonView.style.display = 'none';
        traceJsonOpen = false;
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
        <div class="span-json-container">
            <div class="span-json-header">
                <div class="span-json-title">Span: ${span.name} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.9em; margin-left: 8px;">(${span.spanId || span.span_id})</span></div>
                <div class="span-json-actions">
                    <button onclick="copySpanJson()">Copy JSON</button>
                    <button onclick="closeSpanJson()">Close</button>
                </div>
            </div>
            <pre id="span-json-content">${JSON.stringify(span, null, 2)}</pre>
        </div>
    `;

    // Attach handlers for the new buttons
    container.querySelector('button[onclick="copySpanJson()"]').onclick = () => {
        copyToClipboard(JSON.stringify(span, null, 2), { style: { display: 'none' } }); // Mock feedback
        alert('Copied to clipboard');
    };
    container.querySelector('button[onclick="closeSpanJson()"]').onclick = () => {
        container.innerHTML = '';
        document.querySelectorAll('.span-bar').forEach(bar => bar.classList.remove('selected'));
        selectedSpanIndex = null;
    };
}

// --- Log Helpers ---
export function toggleLogJson(stableId) {
    const jsonDiv = document.getElementById(`log-json-${stableId}`);
    if (jsonDiv) {
        jsonDiv.style.display = jsonDiv.style.display === 'none' ? 'block' : 'none';
    }
}

export function clearLogFilter() {
    document.getElementById('trace-id-filter').value = '';
    loadLogs();
}

export function filterMetrics() {
    const search = document.getElementById('metric-search').value.toLowerCase();
    document.querySelectorAll('.metric-card').forEach(card => {
        const name = card.dataset.metricName;
        card.style.display = name.includes(search) ? 'block' : 'none';
    });
}
