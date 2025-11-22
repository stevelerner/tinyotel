// State variables for service map
let mapNodes = [];
let mapEdges = [];

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

