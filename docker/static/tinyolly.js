let currentTab = localStorage.getItem('tinyolly-active-tab') || 'logs';
let currentTraceId = null;
let currentTraceData = null;
let autoRefreshInterval = null;
let autoRefreshEnabled = localStorage.getItem('tinyolly-auto-refresh') !== 'false'; // Default to true
let expandedLogs = new Set(); // Track which logs have JSON expanded
let traceJsonOpen = false; // Track if trace JSON view is open

// Generate stable ID for a log entry
function getLogStableId(log) {
    return `${log.timestamp}-${log.message}`.substring(0, 50);
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    // Check theme preference
    const savedTheme = localStorage.getItem('tinyolly-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
    }

    // Restore last active tab
    restoreActiveTab();

    // Update button state based on saved preference
    updateAutoRefreshButton();

    loadStats();
    
    // Start auto-refresh if enabled
    if (autoRefreshEnabled) {
        startAutoRefresh();
    }
});

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tinyolly-theme', theme);

    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');

    if (theme === 'dark') {
        icon.textContent = '☀️';
        text.textContent = 'Light Mode';
    } else {
        icon.textContent = '🌙';
        text.textContent = 'Dark Mode';
    }

    // Re-render charts if they exist (to update colors)
    if (currentTab === 'map') {
        loadServiceMap();
    } else if (currentTab === 'metrics') {
        loadMetrics();
    }
}

function startAutoRefresh() {
    // Stop any existing interval first
    stopAutoRefresh();
    
    // Auto-refresh for all tabs
    console.log('Auto-refresh started');
    autoRefreshInterval = setInterval(() => {
        console.log('Auto-refresh tick - current tab:', currentTab);
        loadStats();
        if (currentTab === 'metrics') {
            console.log('Auto-refreshing metrics');
            loadMetrics();
        } else if (currentTab === 'traces' && !document.getElementById('trace-detail-view').style.display.includes('block')) {
            console.log('Auto-refreshing traces');
            loadTraces(); // Only refresh trace list if not viewing detail
        } else if (currentTab === 'logs') {
            console.log('Auto-refreshing logs');
            loadLogs(); // Auto-refresh logs too
        } else if (currentTab === 'map') {
            console.log('Auto-refreshing service map');
            loadServiceMap();
        }
    }, 5000); // Refresh every 5 seconds
}

function restoreActiveTab() {
    // Activate the saved tab or default to logs
    const savedTab = localStorage.getItem('tinyolly-active-tab') || 'logs';
    currentTab = savedTab;
    
    // Update UI to show correct tab
    document.querySelectorAll('.tab').forEach(t => {
        if (t.textContent.toLowerCase().includes(savedTab)) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(savedTab + '-tab').classList.add('active');
    
    // Load data for the restored tab
    refreshCurrentTab();
}

function switchTab(tab, element) {
    currentTab = tab;
    
    // Save tab selection
    localStorage.setItem('tinyolly-active-tab', tab);

    // Update tab buttons - remove active from all, add to clicked
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');

    // Update tab content - hide all, show selected
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + '-tab').classList.add('active');

    // Load data for tab
    refreshCurrentTab();
}

function refreshCurrentTab() {
    console.log('Refreshing tab:', currentTab);
    
    // Refresh stats
    loadStats();
    
    // Load current tab data
    if (currentTab === 'traces' && !document.getElementById('trace-detail-view').style.display.includes('block')) {
        console.log('Loading traces...');
        loadTraces();
    } else if (currentTab === 'logs') {
        console.log('Loading logs...');
        loadLogs();
    } else if (currentTab === 'metrics') {
        console.log('Loading metrics...');
        loadMetrics();
    } else if (currentTab === 'map') {
        console.log('Loading service map...');
        loadServiceMap();
    }
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    localStorage.setItem('tinyolly-auto-refresh', autoRefreshEnabled);
    
    if (autoRefreshEnabled) {
        console.log('Auto-refresh enabled');
        startAutoRefresh();
    } else {
        console.log('Auto-refresh paused');
        stopAutoRefresh();
    }
    
    updateAutoRefreshButton();
}

function updateAutoRefreshButton() {
    const btn = document.getElementById('auto-refresh-btn');
    const icon = document.getElementById('refresh-icon');
    
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

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        document.getElementById('stat-traces').textContent = stats.traces;
        document.getElementById('stat-logs').textContent = stats.logs;
        
        // Show cardinality info for metrics
        let metricsText = stats.metrics;
        if (stats.metrics_max) {
            metricsText += ` / ${stats.metrics_max}`;
        }
        if (stats.metrics_dropped && stats.metrics_dropped > 0) {
            metricsText += ` (${stats.metrics_dropped} dropped)`;
        }
        document.getElementById('stat-metrics').textContent = metricsText;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadTraces() {
    try {
        const response = await fetch('/api/traces?limit=50');
        const traces = await response.json();

        const container = document.getElementById('traces-container');

        if (traces.length === 0) {
            container.innerHTML = '<div class="empty"><div class="empty-icon">-</div><div>No traces yet. Send some data to get started!</div></div>';
            return;
        }

        const limitNote = traces.length >= 50 ? '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">Showing last 50 traces (older data available in Redis)</div>' : '';

        container.innerHTML = limitNote + traces.map(trace => {
            const displayTraceId = trace.trace_id.replace(/^0+(?=.)/, '');

            return `
                <div class="trace-item" onclick="showTraceDetail('${trace.trace_id}')">
                    <div class="trace-header">
                        <div class="trace-name">${trace.root_span_name}</div>
                        <div class="trace-duration">${trace.duration_ms.toFixed(2)}ms</div>
                    </div>
                    <div class="trace-meta">
                        <span>${trace.span_count} spans</span>
                        <span class="trace-id">${displayTraceId}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading traces:', error);
        document.getElementById('traces-container').innerHTML = '<div class="empty">Error loading traces</div>';
    }
}

async function showTraceDetail(traceId) {
    currentTraceId = traceId;

    try {
        const response = await fetch(`/api/traces/${traceId}`);
        const trace = await response.json();
        currentTraceData = trace;

        // Hide list, show detail
        document.getElementById('traces-list-view').style.display = 'none';
        document.getElementById('trace-detail-view').style.display = 'block';

        // Keep JSON view state if it was open, otherwise hide it
        const jsonView = document.getElementById('trace-json-view');
        if (traceJsonOpen && currentTraceData) {
            jsonView.style.display = 'block';
            jsonView.innerHTML = '<pre>' + JSON.stringify(currentTraceData, null, 2) + '</pre>';
        } else {
            jsonView.style.display = 'none';
            traceJsonOpen = false;
        }
        // Keep JSON view state if it was open, otherwise hide it
        if (!traceJsonOpen) {
            document.getElementById('trace-json-view').style.display = 'none';
        }

        renderWaterfall(trace);
        loadTraceLog(traceId);
    } catch (error) {
        console.error('Error loading trace detail:', error);
    }
}

// Service Map Visualization
let mapNodes = [];
let mapEdges = [];
let mapSimulation = null;

async function loadServiceMap() {
    try {
        const response = await fetch('/api/service-map?limit=100');
        const graph = await response.json();

        document.getElementById('stat-dependencies').textContent = graph.edges.length;
        document.getElementById('map-loading').style.display = 'none';

        renderServiceMap(graph);
    } catch (error) {
        console.error('Error loading service map:', error);
    }
}

function renderServiceMap(graph) {
    const canvas = document.getElementById('service-map-canvas');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // Resize canvas
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    // Simple force-directed layout simulation
    // Initialize positions if new
    if (mapNodes.length === 0 || JSON.stringify(mapNodes.map(n => n.id)) !== JSON.stringify(graph.nodes.map(n => n.id))) {
        mapNodes = graph.nodes.map(n => ({
            ...n,
            x: Math.random() * width,
            y: Math.random() * height,
            vx: 0,
            vy: 0
        }));
    } else {
        // Update existing nodes
        // This is a simplification, ideally we'd merge
    }

    mapEdges = graph.edges;

    // Run simulation step
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

function toggleTraceJSON() {
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

function copyTraceJSON() {
    const jsonContent = document.getElementById('trace-json-content').textContent;
    const feedback = document.getElementById('copy-trace-feedback');
    navigator.clipboard.writeText(jsonContent).then(() => {
        feedback.style.display = 'inline';
    }).catch(err => {
        console.error('Failed to copy:', err);
        feedback.textContent = 'Copy failed';
        feedback.style.color = 'var(--error)';
        feedback.style.display = 'inline';
    });
}

function downloadTraceJSON() {
    const jsonContent = document.getElementById('trace-json-content').textContent;
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-${currentTraceId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showLogsForTrace() {
    if (!currentTraceId) return;

    // Switch to logs tab
    currentTab = 'logs';
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        if (t.getAttribute('data-tab') === 'logs') {
            t.classList.add('active');
        }
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('logs-tab').classList.add('active');

    // Set filter and load logs
    document.getElementById('trace-id-filter').value = currentTraceId;
    loadLogs();
}

function showTracesList() {
    document.getElementById('traces-list-view').style.display = 'block';
    document.getElementById('trace-detail-view').style.display = 'none';
    currentTraceId = null;
    currentTraceData = null;
}

// Track selected span for JSON view
let selectedSpanIndex = null;

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
    const displayTraceId = trace.trace_id.replace(/^0+(?=.)/, '');

    // Create time markers (0%, 25%, 50%, 75%, 100%)
    const timeMarkers = [0, 0.25, 0.5, 0.75, 1.0].map(fraction => {
        const timeMs = traceDurationMs * fraction;
        // For the first and last markers, adjust positioning to prevent overflow
        let className = 'time-marker';
        let positionStyle = `left: ${fraction * 100}%;`;

        if (fraction === 0) {
            className += ' first';
        } else if (fraction === 1.0) {
            className += ' last';
            positionStyle = ''; // Will use right: 0 from CSS
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

    // Add click handlers to span bars
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

    // Update selected state
    document.querySelectorAll('.span-bar').forEach((bar, idx) => {
        if (idx === spanIndex) {
            bar.classList.add('selected');
        } else {
            bar.classList.remove('selected');
        }
    });

    selectedSpanIndex = spanIndex;

    container.innerHTML = `
        <div class="span-json-container">
            <div class="span-json-header">
                <div class="span-json-title">Span: ${span.name}</div>
                <div class="span-json-actions">
                    <button class="span-json-btn" onclick="copySpanJSON(event, ${spanIndex})">Copy</button>
                    <button class="span-json-btn" onclick="downloadSpanJSON(event, ${spanIndex})">Download</button>
                    <button class="span-json-close" onclick="closeSpanJson()">Close</button>
                </div>
            </div>
            <pre class="json-content">${JSON.stringify(span, null, 2)}</pre>
        </div>
    `;

    // Scroll to the JSON view
    setTimeout(() => {
        const jsonContainer = document.querySelector('.span-json-container');
        if (jsonContainer) {
            jsonContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 50);
}

function closeSpanJson() {
    const container = document.getElementById('span-json-container');
    container.innerHTML = '';
    document.querySelectorAll('.span-bar').forEach(bar => {
        bar.classList.remove('selected');
    });
    selectedSpanIndex = null;
}

function copySpanJSON(event, spanIndex) {
    event.stopPropagation();
    
    if (!currentTraceData || !currentTraceData.spans[spanIndex]) return;
    
    const span = currentTraceData.spans[spanIndex];
    const jsonText = JSON.stringify(span, null, 2);
    
    navigator.clipboard.writeText(jsonText).then(() => {
        const button = event.currentTarget;
        const textSpan = button.querySelector('.btn-text');
        if (textSpan) {
            textSpan.textContent = 'Copied!';
        } else {
            button.textContent = 'Copied!';
        }
        
        // Keep the "Copied!" message permanently (don't revert)
    }).catch(err => {
        console.error('Failed to copy:', err);
        const button = event.currentTarget;
        const textSpan = button.querySelector('.btn-text');
        if (textSpan) {
            textSpan.textContent = 'Failed';
        } else {
            button.textContent = 'Failed';
        }
    });
}

function downloadSpanJSON(event, spanIndex) {
    event.stopPropagation();
    
    if (!currentTraceData || !currentTraceData.spans[spanIndex]) return;
    
    const span = currentTraceData.spans[spanIndex];
    const jsonText = JSON.stringify(span, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `span-${span.spanId || span.span_id || 'unknown'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const button = event.currentTarget;
    const textSpan = button.querySelector('.btn-text');
    if (textSpan) {
        textSpan.textContent = 'Downloaded!';
    } else {
        button.textContent = 'Downloaded!';
    }
    
    // Keep the "Downloaded!" message permanently (don't revert)
}


async function loadLogs() {
    const traceIdFilter = document.getElementById('trace-id-filter').value.trim();
    const url = traceIdFilter ? `/api/logs?trace_id=${traceIdFilter}` : '/api/logs?limit=100';

    try {
        const response = await fetch(url);
        const logs = await response.json();

        const container = document.getElementById('logs-container');

        if (logs.length === 0) {
            container.innerHTML = '<div class="empty"><div class="empty-icon">-</div><div>No logs found</div></div>';
            return;
        }

        const limitNote = !traceIdFilter && logs.length >= 100 ? '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">Showing last 100 logs (older data available in Redis)</div>' : '';

        container.innerHTML = limitNote + logs.map((log, idx) => {
            const stableId = getLogStableId(log);
            const logId = `log-${idx}-${stableId.replace(/[^a-zA-Z0-9]/g, '')}`;
            const timestamp = new Date(log.timestamp * 1000).toISOString();
            const severity = log.severity || 'INFO';
            const traceId = log.trace_id || log.traceId || '';
            const spanId = log.span_id || log.spanId || '';
            const serviceName = log.service_name || '';
            const message = log.message || '';

            // Check if this log's JSON should be expanded
            const isExpanded = expandedLogs.has(stableId);

            // Remove leading zeros but keep at least one digit
            const displayTraceId = traceId ? traceId.replace(/^0+(?=.)/, '') : '';
            const displaySpanId = spanId ? spanId.replace(/^0+(?=.)/, '') : '';

            return `
                <div class="log-item">
                    <div>
                        <span class="log-timestamp">${timestamp}</span>
                        <span class="log-severity ${severity}">${severity}</span>
                        ${serviceName ? `<span class="log-service">${serviceName}</span>` : ''}
                        ${traceId ? `<span class="log-trace-link" onclick="showTraceFromLog('${traceId}')">trace: <span class="log-trace-id">${displayTraceId}</span></span>` : ''}
                        ${spanId ? `<span class="log-span-id">span: ${displaySpanId}</span>` : ''}
                        <span class="log-json-toggle" onclick="toggleLogJSON('${logId}', '${stableId}')">view log json</span>
                    </div>
                    <div class="log-message">${message}</div>
                    <div id="${logId}" class="json-view" style="display: ${isExpanded ? 'block' : 'none'};">
                        <div style="display: flex; gap: 10px; margin-bottom: 10px; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 10px;">
                                <button onclick="event.stopPropagation(); copyLogJSON('${logId}')" style="padding: 5px 10px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px;">
                                    Copy
                                </button>
                                <button onclick="event.stopPropagation(); downloadLogJSON('${logId}', '${timestamp}')" style="padding: 5px 10px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px;">
                                    Download
                                </button>
                            </div>
                            <button onclick="event.stopPropagation(); toggleLogJSON('${logId}', '${stableId}')" style="padding: 5px 10px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px;">
                                Close
                            </button>
                        </div>
                        <pre>${JSON.stringify(log, null, 2)}</pre>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logs-container').innerHTML = '<div class="empty">Error loading logs</div>';
    }
}

function toggleLogJSON(logId, stableId) {
    const jsonView = document.getElementById(logId);
    if (jsonView.style.display === 'none') {
        jsonView.style.display = 'block';
        expandedLogs.add(stableId);
    } else {
        jsonView.style.display = 'none';
        expandedLogs.delete(stableId);
    }
}

function copyLogJSON(logId) {
    const jsonView = document.getElementById(logId);
    const preElement = jsonView.querySelector('pre');
    const jsonContent = preElement.textContent;
    const button = event.target;
    
    navigator.clipboard.writeText(jsonContent).then(() => {
        button.textContent = 'Copied!';
        button.style.background = 'var(--success)';
        button.style.color = 'white';
    }).catch(err => {
        console.error('Failed to copy:', err);
        button.textContent = 'Failed';
        button.style.background = 'var(--error)';
        button.style.color = 'white';
    });
}

function downloadLogJSON(logId, timestamp) {
    const jsonView = document.getElementById(logId);
    const preElement = jsonView.querySelector('pre');
    const jsonContent = preElement.textContent;
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function loadTraceLog(traceId) {
    try {
        const response = await fetch(`/api/logs?trace_id=${traceId}`);
        const logs = await response.json();

        const container = document.getElementById('trace-logs-container');

        if (logs.length === 0) {
            container.innerHTML = '<div class="empty" style="padding: 12px;">No logs for this trace</div>';
            return;
        }

        container.innerHTML = logs.map((log, idx) => {
            const logId = `trace-log-${idx}`;
            const timestamp = new Date(log.timestamp * 1000).toISOString();
            const severity = log.severity || 'INFO';
            const message = log.message || '';
            const traceId = log.trace_id || log.traceId || '';
            const spanId = log.span_id || log.spanId || '';
            const serviceName = log.service_name || '';

            // Remove leading zeros but keep at least one digit
            const displayTraceId = traceId ? traceId.replace(/^0+(?=.)/, '') : '';
            const displaySpanId = spanId ? spanId.replace(/^0+(?=.)/, '') : '';

            return `
                <div class="log-item">
                    <div>
                        <span class="log-timestamp">${timestamp}</span>
                        <span class="log-severity ${severity}">${severity}</span>
                        ${serviceName ? `<span class="log-service">${serviceName}</span>` : ''}
                        ${traceId ? `<span class="log-trace-link" style="cursor: default; pointer-events: none;">trace: <span class="log-trace-id">${displayTraceId}</span></span>` : ''}
                        ${spanId ? `<span class="log-span-id">span: ${displaySpanId}</span>` : ''}
                        <span class="log-json-toggle" onclick="toggleLogJSON('${logId}')">view log json</span>
                    </div>
                    <div class="log-message">${message}</div>
                    <div id="${logId}" class="json-view" style="display: none;">
                        <div style="display: flex; gap: 10px; margin-bottom: 10px; justify-content: flex-end;">
                            <button onclick="event.stopPropagation(); toggleLogJSON('${logId}')" style="padding: 5px 10px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px;">
                                Close
                            </button>
                        </div>
                        <pre>${JSON.stringify(log, null, 2)}</pre>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading trace logs:', error);
    }
}

function showTraceFromLog(traceId) {
    // Reset trace JSON state when navigating from log
    traceJsonOpen = false;

    // Switch to traces tab
    currentTab = 'traces';
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        if (t.getAttribute('data-tab') === 'traces') {
            t.classList.add('active');
        }
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('traces-tab').classList.add('active');

    // Show trace detail
    setTimeout(() => showTraceDetail(traceId), 100);
}

function clearLogFilter() {
    // Clear the filter input
    document.getElementById('trace-id-filter').value = '';
    // Reload all logs
    loadLogs();
}

let currentMetricNames = [];
let metricCharts = {}; // Store Chart.js instances
let histogramBucketCharts = {}; // Store bucket bar charts for histograms

let expandedMetrics = new Set(); // Track which metrics are expanded
let metricLatestValues = {}; // Store latest values for each metric
let metricTypes = {}; // Store metric types
let metricSortColumn = 'name'; // 'name', 'type', or 'value'
let metricSortDirection = 'asc'; // 'asc' or 'desc'

async function loadMetrics() {
    try {
        const response = await fetch('/api/metrics?limit=500');
        const data = await response.json();
        
        const metricNames = data.names || [];
        const cardinality = data.cardinality || {};

        const container = document.getElementById('metrics-container');

        // Show cardinality warning if needed
        const cardinalityPercent = (cardinality.current / cardinality.max) * 100;
        let warningHtml = '';
        
        if (cardinalityPercent > 90) {
            warningHtml = `<div style="padding: 10px; background: #ff4444; color: white; border-radius: 4px; margin-bottom: 10px;">
                ⚠️ High cardinality: ${cardinality.current}/${cardinality.max} metrics (${cardinalityPercent.toFixed(0)}%)
                ${cardinality.dropped_count > 0 ? ` - ${cardinality.dropped_count} metrics dropped` : ''}
            </div>`;
        } else if (cardinalityPercent > 70) {
            warningHtml = `<div style="padding: 10px; background: #ff9800; color: white; border-radius: 4px; margin-bottom: 10px;">
                ⚠️ Cardinality: ${cardinality.current}/${cardinality.max} metrics (${cardinalityPercent.toFixed(0)}%)
            </div>`;
        }

        if (metricNames.length === 0) {
            container.innerHTML = warningHtml + '<div class="empty"><div class="empty-icon">-</div><div>No metrics yet</div></div>';
            currentMetricNames = [];
            return;
        }
        
        // Show info about limited display
        if (metricNames.length >= 500) {
            warningHtml += `<div style="padding: 8px; background: #2196F3; color: white; border-radius: 4px; margin-bottom: 10px; font-size: 12px;">
                ℹ️ Showing first 500 of ${cardinality.current} metrics
            </div>`;
        }

        // Fetch metric types and values for all metrics
        for (const name of metricNames) {
            await fetchMetricTypeAndValue(name);
        }

        // Check if metric list has changed
        const metricsChanged = JSON.stringify(metricNames.sort()) !== JSON.stringify(currentMetricNames.sort());

        if (metricsChanged) {
            console.log('Metrics list changed, recreating table');
            currentMetricNames = metricNames;
        }

        // Render table with sorting
        renderMetricsTable(warningHtml, container);

    } catch (error) {
        console.error('Error loading metrics:', error);
        container.innerHTML = '<div class="empty">Error loading metrics</div>';
        currentMetricNames = [];
    }
}

async function fetchMetricTypeAndValue(name) {
    try {
        const response = await fetch(`/api/metrics/${encodeURIComponent(name)}`);
        const data = await response.json();
        
        // API returns {name: ..., data: [...]}
        const points = data.data || [];
        
        if (points && points.length > 0) {
            // Get the most recent point
            const point = points[points.length - 1];
            
            // Get the metric type from the stored data
            let type = point.type || 'counter';
            let value = point.value || 0;
            
            // For histograms, use the average value
            if (type === 'histogram' && point.histogram) {
                const hist = point.histogram;
                value = hist.average || ((hist.sum && hist.count) ? hist.sum / hist.count : 0);
            }
            
            metricTypes[name] = type;
            metricLatestValues[name] = {
                type: type,
                value: value,
                rawPoint: point
            };
        }
    } catch (err) {
        console.error(`Error fetching metric type for ${name}:`, err);
    }
}

function renderMetricsTable(warningHtml, container) {
    // Sort metrics
    const sortedMetrics = [...currentMetricNames].sort((a, b) => {
        let comparison = 0;
        
        if (metricSortColumn === 'name') {
            comparison = a.localeCompare(b);
        } else if (metricSortColumn === 'type') {
            const typeA = metricTypes[a] || 'counter';
            const typeB = metricTypes[b] || 'counter';
            comparison = typeA.localeCompare(typeB);
            // Secondary sort by name
            if (comparison === 0) {
                comparison = a.localeCompare(b);
            }
        } else if (metricSortColumn === 'value') {
            const valueA = metricLatestValues[a]?.value || 0;
            const valueB = metricLatestValues[b]?.value || 0;
            comparison = valueA - valueB;
        }
        
        return metricSortDirection === 'asc' ? comparison : -comparison;
    });

    // Render table header
    const tableHeader = `
        <div class="metrics-table-header">
            <div class="metric-header-cell metric-col-name" onclick="sortMetrics('name')">
                Metric Name ${metricSortColumn === 'name' ? (metricSortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div class="metric-header-cell metric-col-type" onclick="sortMetrics('type')">
                Type ${metricSortColumn === 'type' ? (metricSortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div class="metric-header-cell metric-col-value" onclick="sortMetrics('value')">
                Value ${metricSortColumn === 'value' ? (metricSortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
        </div>
    `;

    // Render metric rows
    const metricsHtml = sortedMetrics.map(name => {
        const safeId = name.replace(/[^a-zA-Z0-9]/g, '-');
        const isExpanded = expandedMetrics.has(name);
        const type = metricTypes[name] || 'counter';
        const latestData = metricLatestValues[name];
        const value = latestData?.value !== undefined ? formatMetricValue(latestData.value, type) : '-';
        
        return `
            <div class="metric-row ${isExpanded ? 'expanded' : ''}" id="metric-row-${safeId}" data-metric-name="${name}">
                <div class="metric-header" onclick="toggleMetric('${name}')">
                    <div class="metric-cell metric-col-name">${name}</div>
                    <div class="metric-cell metric-col-type">
                        <span class="metric-type-badge metric-type-${type}">${type}</span>
                    </div>
                    <div class="metric-cell metric-col-value" id="metric-value-${safeId}">${value}</div>
                    <div class="metric-expand-icon">▶</div>
                </div>
                <div class="metric-chart-container">
                    <div class="metric-chart" id="metric-${safeId}" data-metric-name="${name}" style="height: 200px;">
                        <canvas></canvas>
                    </div>
                    <div class="histogram-info" id="histogram-${safeId}" style="display: none; margin-top: 15px;">
                        <div class="histogram-stats">
                            <div class="histogram-stat">
                                <span class="histogram-stat-label">Min:</span>
                                <span class="histogram-stat-value" id="hist-min-${safeId}">-</span>
                            </div>
                            <div class="histogram-stat">
                                <span class="histogram-stat-label">Avg:</span>
                                <span class="histogram-stat-value" id="hist-avg-${safeId}">-</span>
                            </div>
                            <div class="histogram-stat">
                                <span class="histogram-stat-label">Max:</span>
                                <span class="histogram-stat-value" id="hist-max-${safeId}">-</span>
                            </div>
                            <div class="histogram-stat">
                                <span class="histogram-stat-label">Count:</span>
                                <span class="histogram-stat-value" id="hist-count-${safeId}">-</span>
                            </div>
                        </div>
                        <div class="histogram-bucket-chart" id="histogram-bucket-${safeId}" style="height: 150px;">
                            <canvas></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Combine warning, header, and metrics HTML
    container.innerHTML = warningHtml + tableHeader + metricsHtml;

    // Initialize charts only for expanded metrics
    expandedMetrics.forEach(name => {
        if (currentMetricNames.includes(name)) {
            initMetricChart(name);
        }
    });
}

function sortMetrics(column) {
    if (metricSortColumn === column) {
        // Toggle direction
        metricSortDirection = metricSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        metricSortColumn = column;
        metricSortDirection = 'asc';
    }
    
    // Re-render the table
    const container = document.getElementById('metrics-container');
    const warnings = container.querySelector('[style*="background"]')?.outerHTML || '';
    renderMetricsTable(warnings, container);
}

function formatMetricValue(value, type) {
    if (value === null || value === undefined) return '-';
    
    // Format based on type
    if (type === 'histogram' || type === 'gauge') {
        // Show decimal places for histograms and gauges
        return value.toFixed(2);
    } else {
        // Counters: show as integer if it's a whole number
        if (Number.isInteger(value)) {
            return value.toLocaleString();
        }
        return value.toFixed(2);
    }
}

function toggleMetric(name) {
    const safeId = name.replace(/[^a-zA-Z0-9]/g, '-');
    const row = document.getElementById(`metric-row-${safeId}`);
    
    if (expandedMetrics.has(name)) {
        // Collapse
        expandedMetrics.delete(name);
        row.classList.remove('expanded');
        
        // Destroy chart to save resources
        if (metricCharts[name]) {
            metricCharts[name].destroy();
            delete metricCharts[name];
        }
        if (histogramBucketCharts[name]) {
            histogramBucketCharts[name].destroy();
            delete histogramBucketCharts[name];
        }
    } else {
        // Expand
        expandedMetrics.add(name);
        row.classList.add('expanded');
        
        // Initialize chart
        setTimeout(() => {
            initMetricChart(name);
            updateMetricData(name);
        }, 100);
    }
}

function filterMetrics() {
    const searchTerm = document.getElementById('metric-search').value.toLowerCase();
    const rows = document.querySelectorAll('.metric-row');
    
    rows.forEach(row => {
        const metricName = row.dataset.metricName.toLowerCase();
        if (metricName.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

async function updateMetricRowData(name) {
    const safeId = name.replace(/[^a-zA-Z0-9]/g, '-');
    
    try {
        const response = await fetch(`/api/metrics/${encodeURIComponent(name)}`);
        const data = await response.json();
        
        // API returns {name: ..., data: [...]}
        const points = data.data || [];
        
        if (points && points.length > 0) {
            // Get the most recent point
            const point = points[points.length - 1];
            
            // Get the metric type from the stored data
            let type = point.type || 'counter';
            let value = point.value || 0;
            
            // For histograms, use the average value
            if (type === 'histogram' && point.histogram) {
                const hist = point.histogram;
                value = hist.average || ((hist.sum && hist.count) ? hist.sum / hist.count : 0);
            }
            
            metricTypes[name] = type;
            metricLatestValues[name] = {
                type: type,
                value: value,
                rawPoint: point
            };
            
            // Update value display
            const valueEl = document.getElementById(`metric-value-${safeId}`);
            if (valueEl) {
                valueEl.textContent = formatMetricValue(value, type);
            }
        }
        
        // If expanded, update the chart
        if (expandedMetrics.has(name)) {
            updateMetricData(name);
        }
    } catch (error) {
        console.error(`Error updating metric ${name}:`, error);
    }
}

const MAX_POINTS = 30;
let lastTimestamps = {}; // Track last timestamp for each metric

function initMetricChart(name) {
    const chartId = `metric-${name.replace(/\./g, '-')}`;
    const canvas = document.querySelector(`#${chartId} canvas`);
    if (!canvas) return;

    lastTimestamps[name] = null; // Initialize timestamp tracking

    const ctx = canvas.getContext('2d');
    metricCharts[name] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: name,
                data: [],
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuad'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'Value: ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        font: {
                            size: 9
                        },
                        color: '#666'
                    },
                    grid: {
                        color: '#e0e0e0'
                    }
                }
            }
        }
    });
}

async function updateMetricData(name) {
    try {
        const response = await fetch(`/api/metrics/${name}`);
        const data = await response.json();

        if (data.data.length === 0 || !metricCharts[name]) return;

        const chart = metricCharts[name];

        // Get all new points since last update
        const lastTimestamp = lastTimestamps[name] || 0;
        const newPoints = data.data.filter(point => point.timestamp > lastTimestamp);

        if (newPoints.length === 0) return; // No new data

        // Check if this is a histogram metric
        const latestPoint = data.data[data.data.length - 1];
        const isHistogram = latestPoint && latestPoint.histogram;

        // Show/hide histogram info
        const histogramInfoId = `histogram-${name.replace(/\./g, '-')}`;
        const histogramInfo = document.getElementById(histogramInfoId);
        if (histogramInfo) {
            histogramInfo.style.display = isHistogram ? 'block' : 'none';
        }

        // Add all new points
        let addedCount = 0;
        for (const point of newPoints) {
            const timestamp = new Date(point.timestamp * 1000).toLocaleTimeString();
            const value = parseFloat(point.value);

            // For metrics with labels, aggregate by taking the sum of all label values at this timestamp
            const existingIndex = chart.data.labels.indexOf(timestamp);
            if (existingIndex >= 0) {
                // Same timestamp, add to existing value (aggregate across labels)
                chart.data.datasets[0].data[existingIndex] += value;
            } else {
                // New timestamp, add new point
                chart.data.labels.push(timestamp);
                chart.data.datasets[0].data.push(value);
                addedCount++;
            }
        }

        // Update last timestamp to the latest point
        if (newPoints.length > 0) {
            lastTimestamps[name] = Math.max(...newPoints.map(p => p.timestamp));
        }

        console.log(`${name}: Added ${addedCount} new points`);

        // Keep only last MAX_POINTS
        while (chart.data.labels.length > MAX_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update();

        // Update histogram visualization if applicable
        if (isHistogram && latestPoint.histogram) {
            updateHistogramDisplay(name, latestPoint.histogram);
        }

    } catch (error) {
        console.error(`Error updating metric ${name}:`, error);
    }
}

function updateHistogramDisplay(name, histogramData) {
    const safeName = name.replace(/\./g, '-');

    // Update stats
    if (histogramData.min !== null && histogramData.min !== undefined) {
        document.getElementById(`hist-min-${safeName}`).textContent = histogramData.min.toFixed(2);
    }
    if (histogramData.average !== null && histogramData.average !== undefined) {
        document.getElementById(`hist-avg-${safeName}`).textContent = histogramData.average.toFixed(2);
    }
    if (histogramData.max !== null && histogramData.max !== undefined) {
        document.getElementById(`hist-max-${safeName}`).textContent = histogramData.max.toFixed(2);
    }
    if (histogramData.count !== null && histogramData.count !== undefined) {
        document.getElementById(`hist-count-${safeName}`).textContent = histogramData.count;
    }

    // Update bucket chart
    if (histogramData.buckets && histogramData.buckets.length > 0) {
        updateHistogramBuckets(name, histogramData.buckets);
    }
}

function updateHistogramBuckets(name, buckets) {
    const safeName = name.replace(/\./g, '-');
    const containerId = `histogram-bucket-${safeName}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    // Get or create canvas
    let canvas = container.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        container.appendChild(canvas);
    }

    // Destroy existing chart if it exists
    if (histogramBucketCharts[name]) {
        histogramBucketCharts[name].destroy();
    }

    // Prepare bucket labels and counts
    // In OTLP: bucket i contains values in range [explicit_bounds[i-1], explicit_bounds[i])
    // Bucket 0 is (-inf, explicit_bounds[0]), last bucket is [explicit_bounds[N-1], +inf)
    const labels = buckets.map((bucket, i) => {
        if (bucket.bound === null) {
            // This is the +Inf bucket (last bucket)
            if (i > 0 && buckets[i - 1].bound !== null) {
                return `≥${buckets[i - 1].bound}`;
            }
            return '+Inf';
        } else if (i === 0) {
            // First bucket: (-inf, bound)
            return `<${bucket.bound}`;
        } else {
            // Middle buckets: [prev_bound, bound)
            const prevBound = buckets[i - 1].bound;
            if (prevBound === null) {
                return `<${bucket.bound}`;
            }
            return `${prevBound}-${bucket.bound}`;
        }
    });
    const counts = buckets.map(b => b.count);

    // Create bar chart
    const ctx = canvas.getContext('2d');
    histogramBucketCharts[name] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Count',
                data: counts,
                backgroundColor: 'rgba(44, 90, 160, 0.6)',
                borderColor: 'rgba(44, 90, 160, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: 8 },
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        font: { size: 7 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

