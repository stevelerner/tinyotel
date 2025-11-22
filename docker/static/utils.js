export function formatTime(ns) {
    const d = new Date(ns / 1000000);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
}

export function formatTraceId(id) {
    return id.replace(/^0+(?=.)/, '');
}

export function getLogStableId(log) {
    return `${log.timestamp}-${log.message}`.substring(0, 50);
}

export function copyToClipboard(text, feedbackElement) {
    navigator.clipboard.writeText(text).then(() => {
        feedbackElement.style.display = 'inline';
        setTimeout(() => {
            feedbackElement.style.display = 'none';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        feedbackElement.textContent = 'Copy failed';
        feedbackElement.style.color = 'var(--error)';
        feedbackElement.style.display = 'inline';
    });
}

export function downloadJson(data, filename) {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
