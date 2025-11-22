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
                
                // Determine metric type - prioritize the 'type' field from OTLP receiver
                if (point.type) {
                    // Normalize type to title case
                    metricType = point.type.charAt(0).toUpperCase() + point.type.slice(1);
                } else if (point.histogram !== undefined) {
                    metricType = 'Histogram';
                } else {
                    // Fallback to name-based heuristics
                    if (name.includes('.active') || name.includes('_active') || 
                        name.includes('.current') || name.includes('_current')) {
                        metricType = 'Gauge';
                    } else if (name.includes('.total') || name.includes('_total') ||
                        name.includes('.count') || name.includes('_count')) {
                        metricType = 'Counter';
                    } else {
                        metricType = 'Gauge';
                    }
                }
                
                // Extract the actual value for display
                if (point.histogram !== undefined) {
                    // For histograms, show count and average
                    const histData = point.histogram;
                    if (histData.count !== undefined && histData.sum !== undefined) {
                        const avg = histData.sum / histData.count;
                        latestValue = `${histData.count} req, avg: ${avg.toFixed(2)}ms`;
                    } else if (histData.count !== undefined) {
                        latestValue = `${histData.count} observations`;
                    } else if (histData.average !== undefined) {
                        latestValue = histData.average.toFixed(2);
                    } else {
                        latestValue = 'Histogram';
                    }
                } else if (point.value !== undefined) {
                    latestValue = typeof point.value === 'number' ? point.value.toFixed(2) : point.value;
                } else {
                    latestValue = '-';
                }
            }
            
            // Determine type badge class
            let typeBadgeClass = 'metric-type-gauge';
            if (metricType === 'Counter') typeBadgeClass = 'metric-type-counter';
            else if (metricType === 'Histogram') typeBadgeClass = 'metric-type-histogram';
            
            const chartId = `chart-${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
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
                        <div style="position: relative; height: 150px; padding: 0;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML += row;
        } catch (error) {
            console.error(`Error fetching metric ${name}:`, error);
            
            const chartId = `chart-${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
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
                        <div style="position: relative; height: 150px; padding: 0;">
                            <canvas id="${chartId}"></canvas>
                        </div>
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
                const chartCanvas = row.querySelector('canvas');
                if (chartCanvas && !chartCanvas.dataset.loaded) {
                    // Get the metric type from the row
                    const typeBadge = row.querySelector('.metric-type-badge');
                    const metricType = typeBadge ? typeBadge.textContent.toLowerCase() : null;
                    await renderMetricChart(metricName, chartCanvas, metricType);
                    chartCanvas.dataset.loaded = 'true';
                }
            }
        });
    });
}

// Store chart instances to properly destroy them
const chartInstances = {};

// Export function to check if any metric chart is expanded
export function isMetricChartOpen() {
    const expandedRow = document.querySelector('.metric-row.expanded');
    return expandedRow !== null;
}

async function renderMetricChart(metricName, canvas, metricType) {
    try {
        // Destroy existing chart instance if it exists
        const chartId = canvas.id;
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        }
        
        // Fetch metric data for the last 10 minutes
        const endTime = Date.now() / 1000;
        const startTime = endTime - 600; // 10 minutes ago
        
        const response = await fetch(`/api/metrics/${metricName}?start=${startTime}&end=${endTime}`);
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'var(--text-muted)';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, 75);
            return;
        }
        
        // Determine the metric type from data if not provided
        const firstPoint = data.data[0];
        const actualType = metricType || firstPoint.type || 'gauge';
        
        // Route to appropriate visualization
        if (actualType.toLowerCase() === 'histogram') {
            renderHistogramChart(metricName, canvas, data.data);
        } else if (actualType.toLowerCase() === 'gauge') {
            renderGaugeChart(metricName, canvas, data.data);
        } else if (actualType.toLowerCase() === 'counter') {
            renderCounterChart(metricName, canvas, data.data);
        } else {
            renderLineChart(metricName, canvas, data.data, actualType);
        }
    } catch (error) {
        console.error(`Error rendering chart for ${metricName}:`, error);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'var(--text-muted)';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading chart', canvas.width / 2, 75);
    }
}

function renderGaugeChart(metricName, canvas, dataPoints) {
    const chartId = canvas.id;
    const latestPoint = dataPoints[dataPoints.length - 1];
    const currentValue = latestPoint.value !== undefined ? latestPoint.value : 0;
    
    // Determine max value from historical data
    const allValues = dataPoints.map(p => p.value || 0);
    const maxValue = Math.max(...allValues, currentValue * 1.2); // Add 20% headroom
    
    // Create a doughnut chart to simulate a gauge
    chartInstances[chartId] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Current', 'Remaining'],
            datasets: [{
                data: [currentValue, Math.max(0, maxValue - currentValue)],
                backgroundColor: [
                    'rgb(59, 130, 246)',
                    'rgba(200, 200, 200, 0.2)'
                ],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
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
                    enabled: false
                },
                title: {
                    display: true,
                    text: metricName,
                    font: {
                        size: 12
                    }
                }
            }
        },
        plugins: [{
            id: 'gaugeText',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
                const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2 + 20;
                
                ctx.save();
                ctx.font = 'bold 24px Inter';
                ctx.fillStyle = 'rgb(59, 130, 246)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(currentValue.toFixed(2), centerX, centerY);
                
                ctx.font = '12px Inter';
                ctx.fillStyle = 'var(--text-muted)';
                ctx.fillText(`/ ${maxValue.toFixed(0)}`, centerX, centerY + 20);
                ctx.restore();
            }
        }]
    });
}

function renderCounterChart(metricName, canvas, dataPoints) {
    const chartId = canvas.id;
    
    // Prepare chart data
    const labels = dataPoints.map(point => {
        const date = new Date(point.timestamp * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    
    let values = dataPoints.map(point => {
        return point.value !== undefined ? point.value : 0;
    });
    
    // For counters, calculate rate (delta between points)
    const rates = [0]; // First point has no previous value
    for (let i = 1; i < values.length; i++) {
        const delta = values[i] - values[i - 1];
        // Handle counter resets (when value drops)
        rates.push(delta >= 0 ? delta : values[i]);
    }
    
    // Create chart using Chart.js and store the instance
    chartInstances[chartId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `${metricName} (rate per interval)`,
                data: rates,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgb(59, 130, 246)',
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
                title: {
                    display: true,
                    text: `${metricName} - Rate of Change`,
                    font: {
                        size: 12
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `Change: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        maxRotation: 0
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grace: '5%',
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        precision: 0
                    },
                    title: {
                        display: true,
                        text: 'Change per interval'
                    }
                }
            }
        }
    });
}

function renderLineChart(metricName, canvas, dataPoints, metricType) {
    const chartId = canvas.id;
    
    // Prepare chart data
    const labels = dataPoints.map(point => {
        const date = new Date(point.timestamp * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    
    const values = dataPoints.map(point => {
        return point.value !== undefined ? point.value : 0;
    });
    
    // Create chart using Chart.js and store the instance
    chartInstances[chartId] = new Chart(canvas, {
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
                        maxTicksLimit: 8,
                        maxRotation: 0
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grace: '5%',
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
}

function renderHistogramChart(metricName, canvas, dataPoints) {
    const chartId = canvas.id;
    const latestPoint = dataPoints[dataPoints.length - 1];
    
    // Get bucket data from histogram structure
    let buckets = [];
    if (latestPoint.histogram && latestPoint.histogram.buckets) {
        buckets = latestPoint.histogram.buckets;
    } else if (latestPoint.buckets) {
        buckets = latestPoint.buckets;
    }
    
    if (buckets.length === 0) {
        // Fallback to line chart showing count over time
        const labels = dataPoints.map(point => {
            const date = new Date(point.timestamp * 1000);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        });
        
        const counts = dataPoints.map(point => {
            if (point.histogram && point.histogram.count !== undefined) {
                return point.histogram.count;
            }
            return point.count || 0;
        });
        
        chartInstances[chartId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Request Count',
                    data: counts,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: `${metricName} - Request Count Over Time`,
                        font: { size: 12 }
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        return;
    }
    
    // Create bar chart for histogram buckets
    const labels = buckets.map(b => {
        const bound = b.bound !== undefined ? b.bound : b.upper_bound !== undefined ? b.upper_bound : b.upperBound;
        if (bound === null || bound === undefined || bound === Infinity) {
            return '∞';
        }
        return bound.toFixed(2);
    });
    
    const counts = buckets.map(b => b.count || 0);
    
    chartInstances[chartId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Count',
                data: counts,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgb(59, 130, 246)',
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
                title: {
                    display: true,
                    text: `${metricName} - Bucket Distribution (Latest)`,
                    font: {
                        size: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label === '∞' ? '> previous bound' : `≤ ${context.label}ms`;
                            return `Count: ${context.parsed.y} ${label}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Upper Bound (ms)'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Request Count'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}
