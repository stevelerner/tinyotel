export async function renderMetrics(metricsData) {
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
            <div class="metric-header-cell" style="text-align: right;">Latest Value</div>
            <div class="metric-header-cell" style="text-align: center;">Graph</div>
        </div>
    `;

    container.innerHTML = html;

    // Fetch and display each metric's latest value
    for (const name of metricNames) {
        try {
            const response = await fetch(`/api/metrics/${name}?limit=1`);
            const data = await response.json();
            
            let latestValue = '-';
            let metricType = 'Metric';
            
            if (data.data && data.data.length > 0) {
                const point = data.data[data.data.length - 1];
                
                // Determine metric type and value
                if (point.value !== undefined) {
                    latestValue = typeof point.value === 'number' ? point.value.toFixed(2) : point.value;
                    metricType = 'Gauge';
                } else if (point.count !== undefined) {
                    latestValue = point.count;
                    metricType = 'Counter';
                } else if (point.sum !== undefined) {
                    latestValue = point.sum.toFixed(2);
                    metricType = 'Sum';
                }
            }
            
            // Determine type badge class
            let typeBadgeClass = 'metric-type-gauge';
            if (metricType === 'Counter') typeBadgeClass = 'metric-type-counter';
            else if (metricType === 'Histogram') typeBadgeClass = 'metric-type-histogram';
            
            const row = `
                <div class="metric-row" data-metric-name="${name}">
                    <div class="metric-header">
                        <div class="metric-cell metric-col-name">${name}</div>
                        <div class="metric-cell metric-col-type">
                            <span class="metric-type-badge ${typeBadgeClass}">${metricType}</span>
                        </div>
                        <div class="metric-cell metric-col-value">${latestValue}</div>
                        <div class="metric-cell">
                            <span class="metric-expand-icon">➤</span>
                        </div>
                    </div>
                    <div class="metric-chart-container">
                        <div class="metric-name">${name}</div>
                        <canvas class="metric-chart" id="chart-${name.replace(/[^a-zA-Z0-9]/g, '_')}"></canvas>
                    </div>
                </div>
            `;
            
            container.innerHTML += row;
        } catch (error) {
            console.error(`Error fetching metric ${name}:`, error);
            
            // Still show the metric name even if we can't fetch data
            const row = `
                <div class="metric-row" data-metric-name="${name}">
                    <div class="metric-header">
                        <div class="metric-cell metric-col-name">${name}</div>
                        <div class="metric-cell metric-col-type">
                            <span class="metric-type-badge metric-type-gauge">Metric</span>
                        </div>
                        <div class="metric-cell metric-col-value">-</div>
                        <div class="metric-cell">
                            <span class="metric-expand-icon">➤</span>
                        </div>
                    </div>
                    <div class="metric-chart-container">
                        <div class="metric-name">${name}</div>
                        <canvas class="metric-chart" id="chart-${name.replace(/[^a-zA-Z0-9]/g, '_')}"></canvas>
                    </div>
                </div>
            `;
            
            container.innerHTML += row;
        }
    }
    
    // Add click handlers to toggle metric charts
    container.querySelectorAll('.metric-row').forEach(row => {
        const header = row.querySelector('.metric-header');
        const metricName = row.dataset.metricName;
        
        header.addEventListener('click', async () => {
            const isExpanded = row.classList.contains('expanded');
            
            if (isExpanded) {
                row.classList.remove('expanded');
            } else {
                row.classList.add('expanded');
                
                // Load and render chart if not already loaded
                const chartCanvas = row.querySelector('.metric-chart');
                if (chartCanvas && !chartCanvas.dataset.loaded) {
                    await renderMetricChart(metricName, chartCanvas);
                    chartCanvas.dataset.loaded = 'true';
                }
            }
        });
    });
}

async function renderMetricChart(metricName, canvas) {
    try {
        // Set canvas size explicitly
        canvas.width = canvas.offsetWidth;
        canvas.height = 150;
        
        // Fetch metric data for the last 10 minutes
        const endTime = Date.now() / 1000;
        const startTime = endTime - 600; // 10 minutes ago
        
        const response = await fetch(`/api/metrics/${metricName}?start=${startTime}&end=${endTime}`);
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'var(--text-muted)';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // Prepare chart data
        const labels = data.data.map(point => {
            const date = new Date(point.timestamp * 1000);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        });
        
        const values = data.data.map(point => {
            return point.value !== undefined ? point.value : 
                   point.count !== undefined ? point.count : 
                   point.sum !== undefined ? point.sum : 0;
        });
        
        // Create chart using Chart.js
        new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: metricName,
                    data: values,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 4
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
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            precision: 2
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    } catch (error) {
        console.error(`Error rendering chart for ${metricName}:`, error);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'var(--text-muted)';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading chart', canvas.width / 2, canvas.height / 2);
    }
}
