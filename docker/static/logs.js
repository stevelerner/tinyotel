import { formatTraceId } from './utils.js';

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

    const limitNote = '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">Showing last 50 logs</div>';

    // Build table with headers
    const headerRow = `
        <div style="display: flex; align-items: center; gap: 15px; padding: 8px 12px; border-bottom: 2px solid var(--border-color); background: var(--bg-secondary); font-weight: bold; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
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
            <div class="log-row" style="display: flex; align-items: center; gap: 15px; padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px;">
                <div style="flex: 0 0 100px; font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">${timestamp}</div>
                <div style="flex: 0 0 60px; font-weight: 600; font-size: 10px; color: var(--text-main);">${severity}</div>
                <div style="flex: 0 0 120px; color: var(--text-main); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.service_name || ''}">${log.service_name || '-'}</div>
                <div style="flex: 0 0 180px; font-family: 'JetBrains Mono', monospace; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${traceId || ''}">
                    ${traceId ? `<a class="log-trace-link" data-trace-id="${traceId}" style="color: var(--primary); cursor: pointer; text-decoration: none;">${formatTraceId(traceId)}</a>` : '<span style="color: var(--text-muted);">-</span>'}
                </div>
                <div style="flex: 0 0 140px; font-family: 'JetBrains Mono', monospace; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${spanId || ''}">
                    ${spanId ? `<a class="log-span-link" data-span-id="${spanId}" style="color: var(--primary); cursor: pointer; text-decoration: none;">${formatTraceId(spanId)}</a>` : '<span style="color: var(--text-muted);">-</span>'}
                </div>
                <div style="flex: 1; min-width: 200px; color: var(--text-main); word-break: break-word;">${log.message || ''}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = limitNote + headerRow + logsHtml;
    
    // Add click handlers using event delegation
    container.addEventListener('click', (e) => {
        // Handle trace link clicks
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
            return;
        }
        
        // Handle span link clicks
        const spanLink = e.target.closest('.log-span-link');
        if (spanLink) {
            e.preventDefault();
            const spanId = spanLink.dataset.spanId;
            
            if (spanId) {
                // Switch to spans tab
                if (window.switchTab) {
                    window.switchTab('spans');
                }
                // Wait for spans to load, then find and show the span detail
                setTimeout(async () => {
                    // Load spans data
                    try {
                        const response = await fetch('/api/spans');
                        const spans = await response.json();
                        
                        // Find the span - we need to import from api or do it directly
                        const span = spans.find(s => s.span_id === spanId);
                        if (span) {
                            // We need access to showSpanDetail from spans.js
                            // This creates a circular dependency issue
                            // For now, we'll just switch to the tab and let the user click
                            console.log('Switched to spans tab - click span to view details');
                        }
                    } catch (err) {
                        console.error('Error loading span:', err);
                    }
                }, 200);
            }
        }
    });
}

