import { loadMetrics, loadServiceMap } from './api.js';

export function initTheme() {
    const savedTheme = localStorage.getItem('tinyolly-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}

export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

export function setTheme(theme) {
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
    // We need to import currentTab from somewhere or pass it in, 
    // but for now let's rely on the global currentTab if possible or just re-render active tab
    const activeTab = localStorage.getItem('tinyolly-active-tab');
    if (activeTab === 'map') {
        loadServiceMap();
    } else if (activeTab === 'metrics') {
        loadMetrics();
    }
}
