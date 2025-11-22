import { formatTime, formatTraceId, copyToClipboard, downloadJson } from './utils.js';

// State variables for spans
let currentSpanDetail = null;
let currentSpanData = null;

// Export function to check if span detail is open
export function isSpanDetailOpen() {
    return currentSpanDetail !== null;
}

export function renderSpans(spans) {
    const container = document.getElementById('spans-container');
    if (!container) return;

    if (spans.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No spans found</div>';
        return;
    }

    const limitNote = '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">Showing last 50 spans</div>';

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

    const spansHtml = spans.map(span => {
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
            <div class="span-row-wrapper">
                <div class="trace-item" data-span-id="${span.span_id}" style="display: flex; align-items: center; gap: 15px; padding: 8px 12px; cursor: pointer;">
                    <div class="trace-time" style="font-family: monospace; color: var(--text-muted); flex: 0 0 100px;">${startTime}</div>
                    <div class="trace-id" style="flex: 0 0 260px; font-family: monospace; color: var(--text-muted); font-size: 0.9em;">${displayTraceId}</div>
                    <div class="span-id" style="flex: 0 0 180px; font-family: monospace; color: var(--text-muted); font-size: 0.9em;">${displaySpanId}</div>
                    <div class="trace-duration" style="flex: 0 0 80px; color: var(--text-muted);">${span.duration_ms.toFixed(2)}ms</div>
                    <div class="trace-method" style="flex: 0 0 70px; font-weight: bold; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${method}</div>
                    <div class="trace-name" style="flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${route}</div>
                    <div class="trace-status" style="flex: 0 0 60px; text-align: right; color: ${statusColor}; font-weight: 500;">${status || '-'}</div>
                </div>
                <div class="span-detail-inline" id="span-detail-${span.span_id}" style="display: none;"></div>
            </div>
        `;
    }).join('');

    container.innerHTML = limitNote + headerRow + spansHtml;

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
    
    // Close all other span details
    document.querySelectorAll('.span-detail-inline').forEach(el => {
        if (el.id !== `span-detail-${spanId}`) {
            el.style.display = 'none';
            el.innerHTML = '';
        }
    });
    
    const detailContainer = document.getElementById(`span-detail-${spanId}`);
    if (!detailContainer) return;
    
    detailContainer.style.display = 'block';
    detailContainer.innerHTML = `
        <div class="span-json-view" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin: 0 12px 12px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div style="font-size: 14px; font-weight: 600; color: var(--text-main);">
                    Span: ${span.name} 
                    <span style="font-weight: normal; color: var(--text-muted); font-size: 0.9em; margin-left: 8px; font-family: 'JetBrains Mono', monospace;">
                        (spanId: ${formatTraceId(span.span_id)})
                    </span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="copy-span-btn-${spanId}" style="padding: 6px 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px; font-size: 12px;">
                        Copy JSON
                    </button>
                    <button id="download-span-btn-${spanId}" style="padding: 6px 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px; font-size: 12px;">
                        Download JSON
                    </button>
                    <button id="close-span-btn-${spanId}" style="padding: 6px 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 4px; font-size: 12px;">
                        Close
                    </button>
                    <span id="copy-span-feedback-${spanId}" style="color: var(--success); font-size: 12px; display: none; margin-left: 8px;">Copied!</span>
                </div>
            </div>
            <div style="background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; overflow: auto; max-height: 500px;">
                <pre style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-main); margin: 0; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5;">${JSON.stringify(span, null, 2)}</pre>
            </div>
        </div>
    `;
    
    // Scroll to the detail view
    detailContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Attach event handlers
    document.getElementById(`copy-span-btn-${spanId}`).addEventListener('click', () => {
        const feedback = document.getElementById(`copy-span-feedback-${spanId}`);
        copyToClipboard(JSON.stringify(span, null, 2), feedback);
    });
    
    document.getElementById(`download-span-btn-${spanId}`).addEventListener('click', () => {
        downloadJson(span, `span-${span.span_id}.json`);
    });
    
    document.getElementById(`close-span-btn-${spanId}`).addEventListener('click', () => {
        detailContainer.style.display = 'none';
        detailContainer.innerHTML = '';
        currentSpanDetail = null;
        currentSpanData = null;
    });
}

