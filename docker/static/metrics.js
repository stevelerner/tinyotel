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

