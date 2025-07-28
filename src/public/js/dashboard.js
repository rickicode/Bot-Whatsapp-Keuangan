// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initDashboard();
    
    // Initialize navigation
    initNavigation();
    
    // Initialize auth check
    checkAuthentication();
    
    // Initialize periodic updates
    initPeriodicUpdates();
    
    // Initialize modal
    initModal();
    
    // Load initial data
    loadDashboardData();
});

let currentSection = 'overview';
let refreshInterval;
let charts = {};

// Authentication Check
function checkAuthentication() {
    const isLoggedIn = localStorage.getItem('dashboardAuth') || sessionStorage.getItem('dashboardAuth');
    
    if (!isLoggedIn) {
        window.location.href = '/login';
        return;
    }
    
    // Verify with server
    fetch('/auth/status')
        .then(response => response.json())
        .then(result => {
            if (!result.authenticated) {
                localStorage.removeItem('dashboardAuth');
                sessionStorage.removeItem('dashboardAuth');
                window.location.href = '/login';
            }
        })
        .catch(error => {
            console.error('Auth check error:', error);
            // Keep user logged in on network error
        });
}

// Dashboard Initialization
function initDashboard() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Sidebar toggle
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && 
                !sidebar.contains(e.target) && 
                !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }
    
    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshDashboard();
        });
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
        });
    }
    
    // Quick action buttons
    initQuickActions();
}

// Navigation Initialization
function initNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav a[data-section]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            switchSection(section);
            
            // Close sidebar on mobile after navigation
            if (window.innerWidth <= 1024) {
                document.querySelector('.sidebar').classList.remove('open');
            }
        });
    });
}

// Switch Dashboard Section
function switchSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        li.classList.remove('active');
    });
    
    document.querySelector(`[data-section="${sectionName}"]`).parentElement.classList.add('active');
    
    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update header
    updateSectionHeader(sectionName);
    
    // Load section-specific data
    loadSectionData(sectionName);
    
    currentSection = sectionName;
}

// Update Section Header
function updateSectionHeader(sectionName) {
    const titles = {
        overview: 'Dashboard Overview',
        whatsapp: 'WhatsApp Status',
        qrscan: 'QR Code Scanner',
        users: 'User Statistics',
        system: 'System Monitor',
        api: 'API Statistics',
        logs: 'Activity Logs'
    };
    
    const subtitles = {
        overview: 'Monitor status dan statistik bot secara real-time',
        whatsapp: 'Status koneksi dan metrik WhatsApp',
        qrscan: 'Scan QR code untuk menghubungkan WhatsApp',
        users: 'Statistik pengguna dan aktivitas',
        system: 'Monitor sistem dan layanan',
        api: 'Statistik penggunaan API',
        logs: 'Log aktivitas dan sistem'
    };
    
    document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';
    document.getElementById('pageSubtitle').textContent = subtitles[sectionName] || '';
}

// Load Dashboard Data
async function loadDashboardData() {
    showLoading(true);
    
    try {
        // Load all dashboard data
        await Promise.all([
            loadOverviewData(),
            loadWhatsAppData(),
            loadUserData(),
            loadSystemData(),
            loadAPIData(),
            loadLogsData()
        ]);
        
        updateLastUpdated();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    } finally {
        showLoading(false);
    }
}

// Load Section-Specific Data
async function loadSectionData(sectionName) {
    try {
        switch (sectionName) {
            case 'overview':
                await loadOverviewData();
                break;
            case 'whatsapp':
                await loadWhatsAppData();
                break;
            case 'qrscan':
                await loadQRScanData();
                break;
            case 'users':
                await loadUserData();
                break;
            case 'system':
                await loadSystemData();
                break;
            case 'api':
                await loadAPIData();
                break;
            case 'logs':
                await loadLogsData();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${sectionName} data:`, error);
    }
}

// Load Overview Data
async function loadOverviewData() {
    try {
        // Get health data
        const healthResponse = await fetch('/health');
        const healthData = await healthResponse.json();
        
        // Get dashboard stats
        const statsResponse = await fetch('/api/dashboard/stats');
        const statsData = await statsResponse.json();
        
        // Update overview stats
        updateOverviewStats(healthData, statsData);
        
        // Update charts
        updateOverviewCharts(statsData);
        
    } catch (error) {
        console.error('Error loading overview data:', error);
        updateOverviewStats({}, {});
    }
}

// Update Overview Stats
function updateOverviewStats(health, stats) {
    // WhatsApp Status
    const whatsappStatus = document.getElementById('whatsappStatus');
    if (whatsappStatus) {
        const isConnected = health.whatsapp?.connected || false;
        const statusIndicator = whatsappStatus.querySelector('.status-indicator');
        const statusText = whatsappStatus.querySelector('span:last-child');
        
        if (isConnected) {
            statusIndicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.className = 'status-indicator disconnected';
            statusText.textContent = 'Disconnected';
        }
    }
    
    // Total Users
    const totalUsers = document.getElementById('totalUsers');
    if (totalUsers && stats.users) {
        totalUsers.querySelector('.number').textContent = stats.users.total || 0;
    }
    
    // Messages Today
    const messagesToday = document.getElementById('messagesToday');
    if (messagesToday && stats.messages) {
        messagesToday.querySelector('.number').textContent = stats.messages.today || 0;
    }
    
    // System Uptime
    const systemUptime = document.getElementById('systemUptime');
    if (systemUptime && health.uptime) {
        const hours = Math.floor(health.uptime / 3600);
        systemUptime.querySelector('.number').textContent = hours;
    }
}

// Update Overview Charts
function updateOverviewCharts(stats) {
    // User Growth Chart
    const userGrowthCtx = document.getElementById('userGrowthChart');
    if (userGrowthCtx && stats.userGrowth) {
        if (charts.userGrowth) {
            charts.userGrowth.destroy();
        }
        
        charts.userGrowth = new Chart(userGrowthCtx, {
            type: 'line',
            data: {
                labels: stats.userGrowth.labels || [],
                datasets: [{
                    label: 'New Users',
                    data: stats.userGrowth.data || [],
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    // Message Volume Chart
    const messageVolumeCtx = document.getElementById('messageVolumeChart');
    if (messageVolumeCtx && stats.messageVolume) {
        if (charts.messageVolume) {
            charts.messageVolume.destroy();
        }
        
        charts.messageVolume = new Chart(messageVolumeCtx, {
            type: 'bar',
            data: {
                labels: stats.messageVolume.labels || [],
                datasets: [{
                    label: 'Messages',
                    data: stats.messageVolume.data || [],
                    backgroundColor: 'rgba(249, 115, 22, 0.8)',
                    borderColor: 'rgb(249, 115, 22)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Load WhatsApp Data
async function loadWhatsAppData() {
    try {
        // Get WhatsApp status
        const qrResponse = await fetch('/qrscan/status');
        const qrData = await qrResponse.json();
        
        // Get WhatsApp metrics
        const metricsResponse = await fetch('/api/dashboard/whatsapp');
        const metricsData = await metricsResponse.json();
        
        updateWhatsAppStatus(qrData, metricsData);
        
    } catch (error) {
        console.error('Error loading WhatsApp data:', error);
        updateWhatsAppStatus({}, {});
    }
}

// Update WhatsApp Status
function updateWhatsAppStatus(qrData, metrics) {
    const connectionStatus = document.getElementById('connectionStatus');
    const phoneInfo = document.getElementById('phoneInfo');
    const sessionInfo = document.getElementById('sessionInfo');
    const qrSection = document.getElementById('qrSection');
    const qrDisplay = document.getElementById('qrDisplay');
    
    if (connectionStatus) {
        const indicator = connectionStatus.querySelector('.status-indicator');
        const text = connectionStatus.querySelector('.status-text');
        
        if (qrData.connected) {
            indicator.className = 'status-indicator connected';
            text.textContent = 'WhatsApp Connected';
            
            if (qrSection) qrSection.style.display = 'none';
        } else if (qrData.qr) {
            indicator.className = 'status-indicator loading';
            text.textContent = 'Waiting for QR scan';
            
            if (qrSection) qrSection.style.display = 'block';
            if (qrDisplay) {
                qrDisplay.innerHTML = `<img src="data:image/png;base64,${qrData.qr}" alt="QR Code" style="max-width: 250px; width: 100%; height: auto; border-radius: 12px;">`;
            }
        } else {
            indicator.className = 'status-indicator disconnected';
            text.textContent = 'WhatsApp Disconnected';
            
            if (qrSection) qrSection.style.display = 'none';
        }
    }
    
    // Update phone info
    if (phoneInfo && metrics.phoneNumber) {
        phoneInfo.querySelector('span').textContent = `Phone: ${metrics.phoneNumber}`;
    }
    
    // Update session info
    if (sessionInfo && metrics.connectedAt) {
        const connectedDate = new Date(metrics.connectedAt);
        sessionInfo.querySelector('span').textContent = `Connected: ${connectedDate.toLocaleString()}`;
    }
    
    // Update metrics
    updateElement('messagesSent', metrics.messagesSent || 0);
    updateElement('messagesReceived', metrics.messagesReceived || 0);
    updateElement('failedMessages', metrics.failedMessages || 0);
    updateElement('spamBlocked', metrics.spamBlocked || 0);
}

// Load User Data
async function loadUserData() {
    try {
        const response = await fetch('/api/dashboard/users');
        const data = await response.json();
        
        updateUserStats(data);
        updateUserChart(data);
        updateRecentUsers(data.recentUsers || []);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        updateUserStats({});
    }
}

// Update User Stats
function updateUserStats(data) {
    updateElement('totalRegisteredUsers', data.total || 0);
    updateElement('freePlanUsers', data.freePlan || 0);
    updateElement('premiumUsers', data.premium || 0);
    updateElement('activeThisWeek', data.activeWeek || 0);
    
    // Update percentages
    if (data.total > 0) {
        const freePercentage = Math.round((data.freePlan / data.total) * 100);
        const premiumPercentage = Math.round((data.premium / data.total) * 100);
        
        updateElement('freePercentage', `${freePercentage}%`);
        updateElement('premiumPercentage', `${premiumPercentage}%`);
    }
    
    // Update trends
    updateElement('userTrend', data.trend || '+0%');
    updateElement('activeTrend', data.activeTrend || '+0%');
}

// Update User Chart
function updateUserChart(data) {
    const userActivityCtx = document.getElementById('userActivityChart');
    if (userActivityCtx && data.activityData) {
        if (charts.userActivity) {
            charts.userActivity.destroy();
        }
        
        charts.userActivity = new Chart(userActivityCtx, {
            type: 'doughnut',
            data: {
                labels: ['Free Users', 'Premium Users', 'Inactive'],
                datasets: [{
                    data: [
                        data.freePlan || 0,
                        data.premium || 0,
                        (data.total || 0) - (data.freePlan || 0) - (data.premium || 0)
                    ],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(156, 163, 175, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

// Update Recent Users
function updateRecentUsers(users) {
    const userList = document.getElementById('recentUsersList');
    if (!userList) return;
    
    if (users.length === 0) {
        userList.innerHTML = '<div class="loading-placeholder">No recent users</div>';
        return;
    }
    
    userList.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <h5>${user.name}</h5>
                    <span>${user.phone}</span>
                </div>
            </div>
            <div class="user-time">${formatTime(user.createdAt)}</div>
        </div>
    `).join('');
}

// Load System Data
async function loadSystemData() {
    try {
        const response = await fetch('/api/dashboard/system');
        const data = await response.json();
        
        updateSystemStats(data);
        updateServiceStatus(data.services || []);
        updateSystemLogs(data.logs || []);
        
    } catch (error) {
        console.error('Error loading system data:', error);
        updateSystemStats({});
    }
}

// Update System Stats
function updateSystemStats(data) {
    // Memory usage
    const memoryUsage = document.getElementById('memoryUsage');
    if (memoryUsage && data.memory) {
        const percentage = Math.round((data.memory.used / data.memory.total) * 100);
        memoryUsage.querySelector('span').textContent = `${percentage}%`;
        memoryUsage.style.background = `conic-gradient(var(--primary-color) ${percentage * 3.6}deg, var(--gray-200) 0deg)`;
    }
    
    // Database status
    const databaseStatus = document.getElementById('databaseStatus');
    if (databaseStatus) {
        const badge = databaseStatus.querySelector('.badge');
        if (data.database?.connected) {
            badge.className = 'badge connected';
            badge.textContent = 'Connected';
        } else {
            badge.className = 'badge error';
            badge.textContent = 'Error';
        }
    }
    
    // Active services
    updateElement('activeServices', `${data.activeServices || 0}`);
    
    // Error rate
    updateElement('errorRate', `${data.errorRate || 0}%`);
}

// Update Service Status
function updateServiceStatus(services) {
    const serviceList = document.getElementById('serviceList');
    if (!serviceList) return;
    
    if (services.length === 0) {
        serviceList.innerHTML = '<div class="loading-placeholder">No service data</div>';
        return;
    }
    
    serviceList.innerHTML = services.map(service => `
        <div class="service-item">
            <div class="service-info">
                <span class="status-indicator ${service.status}"></span>
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="service-description">${service.description}</div>
                </div>
            </div>
            <div class="badge ${service.status}">${service.status}</div>
        </div>
    `).join('');
}

// Load API Data
async function loadAPIData() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        updateAPIStats(data);
        updateAPIEndpoints(data.endpoints || []);
        
    } catch (error) {
        console.error('Error loading API data:', error);
        updateAPIStats({});
    }
}

// Update API Stats
function updateAPIStats(data) {
    updateElement('apiCallsToday', data.callsToday || 0);
    updateElement('apiSuccessRate', `${data.successRate || 0}%`);
    updateElement('avgResponseTime', `${data.avgResponseTime || 0}ms`);
    updateElement('rateLimited', data.rateLimited || 0);
}

// Update API Endpoints
function updateAPIEndpoints(endpoints) {
    const endpointList = document.getElementById('endpointList');
    if (!endpointList) return;
    
    if (endpoints.length === 0) {
        endpointList.innerHTML = '<div class="loading-placeholder">No API data</div>';
        return;
    }
    
    endpointList.innerHTML = endpoints.map(endpoint => `
        <div class="endpoint-item">
            <div class="endpoint-info">
                <span class="endpoint-method ${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                <span class="endpoint-path">${endpoint.path}</span>
            </div>
            <div class="endpoint-stats">
                <span>Calls: ${endpoint.calls}</span>
                <span>Avg: ${endpoint.avgTime}ms</span>
            </div>
        </div>
    `).join('');
}

// Load Logs Data
async function loadLogsData() {
    try {
        const response = await fetch('/api/dashboard/logs');
        const data = await response.json();
        
        updateLogs(data.logs || []);
        
    } catch (error) {
        console.error('Error loading logs:', error);
        updateLogs([]);
    }
}

// Update Logs
function updateLogs(logs) {
    const logsContainer = document.getElementById('logsContainer');
    if (!logsContainer) return;
    
    if (logs.length === 0) {
        logsContainer.innerHTML = '<div class="loading-placeholder">No logs available</div>';
        return;
    }
    
    logsContainer.innerHTML = logs.map(log => `
        <div class="log-entry ${log.level}">
            <span class="log-timestamp">${formatTime(log.timestamp)}</span>
            <span class="log-level ${log.level}">${log.level}</span>
            <span class="log-message">${log.message}</span>
        </div>
    `).join('');
    
    // Auto-scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// QR Scan Data Loading and Management
let qrRefreshInterval;
let qrCountdownInterval;
let qrCountdownSeconds = 120;

// Load QR Scan Data
async function loadQRScanData() {
    try {
        // Get QR status from dashboard API
        const response = await fetch('/api/dashboard/qr-status');
        const data = await response.json();
        
        if (data.success) {
            updateQRScanStatus(data.data);
        } else {
            showQRError('Failed to load QR status');
        }
        
        // Initialize QR scan buttons
        initQRScanButtons();
        
        // Start auto-refresh for QR scan section
        if (currentSection === 'qrscan') {
            startQRAutoRefresh();
        }
        
    } catch (error) {
        console.error('Error loading QR scan data:', error);
        showQRError('Failed to connect to server');
    }
}

// Update QR Scan Status
function updateQRScanStatus(data) {
    const connectionStatusBar = document.getElementById('qrConnectionStatus');
    const qrPlaceholder = document.getElementById('qrPlaceholder');
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    const qrConnected = document.getElementById('qrConnected');
    const qrError = document.getElementById('qrError');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    // Hide all states first
    hideAllQRStates();
    
    if (data.connected) {
        // Show connected state
        updateConnectionStatusBar('connected', 'WhatsApp Connected Successfully');
        
        if (qrConnected) {
            qrConnected.style.display = 'block';
            
            // Update connected phone number
            const connectedPhone = document.getElementById('connectedPhone');
            if (connectedPhone && data.phoneNumber) {
                connectedPhone.textContent = data.phoneNumber;
            }
            
            // Update connected time
            const connectedTime = document.getElementById('connectedTime');
            if (connectedTime) {
                connectedTime.textContent = new Date().toLocaleString();
            }
        }
        
        // Show disconnect button
        if (disconnectBtn) {
            disconnectBtn.style.display = 'inline-flex';
        }
        
        // Stop refresh intervals
        stopQRAutoRefresh();
        
    } else if (data.qr) {
        // Show QR code
        updateConnectionStatusBar('loading', 'Waiting for QR Code Scan');
        
        if (qrCodeDisplay) {
            qrCodeDisplay.style.display = 'block';
            
            const qrImage = document.getElementById('qrCodeImage');
            if (qrImage) {
                qrImage.src = `data:image/png;base64,${data.qr}`;
            }
        }
        
        // Start countdown timer
        startQRCountdown();
        
        // Hide disconnect button
        if (disconnectBtn) {
            disconnectBtn.style.display = 'none';
        }
        
    } else {
        // Show loading/disconnected state
        updateConnectionStatusBar('disconnected', 'WhatsApp Disconnected');
        
        if (qrPlaceholder) {
            qrPlaceholder.style.display = 'block';
        }
        
        // Hide disconnect button
        if (disconnectBtn) {
            disconnectBtn.style.display = 'none';
        }
    }
}

// Hide all QR states
function hideAllQRStates() {
    const states = ['qrPlaceholder', 'qrCodeDisplay', 'qrConnected', 'qrError'];
    states.forEach(stateId => {
        const element = document.getElementById(stateId);
        if (element) {
            element.style.display = 'none';
        }
    });
}

// Update connection status bar
function updateConnectionStatusBar(status, text) {
    const statusBar = document.getElementById('qrConnectionStatus');
    if (!statusBar) return;
    
    const indicator = statusBar.querySelector('.status-indicator');
    const statusText = statusBar.querySelector('.status-text');
    
    if (indicator) {
        indicator.className = `status-indicator ${status}`;
    }
    
    if (statusText) {
        statusText.textContent = text;
    }
}

// Show QR Error
function showQRError(message) {
    hideAllQRStates();
    
    const qrError = document.getElementById('qrError');
    const qrErrorMessage = document.getElementById('qrErrorMessage');
    
    if (qrError) {
        qrError.style.display = 'block';
    }
    
    if (qrErrorMessage) {
        qrErrorMessage.textContent = message;
    }
    
    updateConnectionStatusBar('disconnected', 'Connection Error');
}

// Initialize QR Scan Buttons
function initQRScanButtons() {
    // Refresh QR Button
    const refreshQrBtn = document.getElementById('refreshQrBtn');
    if (refreshQrBtn) {
        refreshQrBtn.addEventListener('click', async () => {
            await refreshQRCode();
        });
    }
    
    // Check Connection Button
    const checkConnectionBtn = document.getElementById('checkConnectionBtn');
    if (checkConnectionBtn) {
        checkConnectionBtn.addEventListener('click', async () => {
            await loadQRScanData();
        });
    }
    
    // Disconnect Button
    const disconnectBtn = document.getElementById('disconnectBtn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            showConfirmModal(
                'Disconnect WhatsApp',
                'Are you sure you want to disconnect WhatsApp? You will need to scan QR code again.',
                async () => {
                    await disconnectWhatsApp();
                }
            );
        });
    }
}

// Refresh QR Code
async function refreshQRCode() {
    try {
        const refreshBtn = document.getElementById('refreshQrBtn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
        }
        
        // Call refresh API
        const response = await fetch('/api/dashboard/qr-refresh', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('QR Code refresh initiated');
            
            // Reset countdown
            qrCountdownSeconds = 120;
            
            // Reload QR data after a short delay
            setTimeout(() => {
                loadQRScanData();
            }, 2000);
            
        } else {
            showError('Failed to refresh QR code');
        }
        
    } catch (error) {
        console.error('Error refreshing QR code:', error);
        showError('Failed to refresh QR code');
    } finally {
        const refreshBtn = document.getElementById('refreshQrBtn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh QR Code';
            refreshBtn.disabled = false;
        }
    }
}

// Disconnect WhatsApp
async function disconnectWhatsApp() {
    try {
        // For now, we'll use the restart action which effectively disconnects
        const response = await fetch('/api/dashboard/action/restart-whatsapp', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('WhatsApp disconnected successfully');
            
            // Reload QR data
            setTimeout(() => {
                loadQRScanData();
            }, 2000);
            
        } else {
            showError('Failed to disconnect WhatsApp');
        }
        
    } catch (error) {
        console.error('Error disconnecting WhatsApp:', error);
        showError('Failed to disconnect WhatsApp');
    }
}

// Start QR Auto Refresh
function startQRAutoRefresh() {
    // Clear existing interval
    stopQRAutoRefresh();
    
    // Refresh every 5 seconds
    qrRefreshInterval = setInterval(() => {
        if (currentSection === 'qrscan') {
            loadQRScanData();
        } else {
            stopQRAutoRefresh();
        }
    }, 5000);
}

// Stop QR Auto Refresh
function stopQRAutoRefresh() {
    if (qrRefreshInterval) {
        clearInterval(qrRefreshInterval);
        qrRefreshInterval = null;
    }
    
    if (qrCountdownInterval) {
        clearInterval(qrCountdownInterval);
        qrCountdownInterval = null;
    }
}

// Start QR Countdown Timer
function startQRCountdown() {
    // Clear existing countdown
    if (qrCountdownInterval) {
        clearInterval(qrCountdownInterval);
    }
    
    // Reset countdown
    qrCountdownSeconds = 120;
    
    // Update countdown display
    updateQRCountdown();
    
    // Start countdown
    qrCountdownInterval = setInterval(() => {
        qrCountdownSeconds--;
        updateQRCountdown();
        
        if (qrCountdownSeconds <= 0) {
            clearInterval(qrCountdownInterval);
            // Auto refresh when countdown expires
            refreshQRCode();
        }
    }, 1000);
}

// Update QR Countdown Display
function updateQRCountdown() {
    const countdownElement = document.getElementById('qrCountdown');
    if (countdownElement) {
        countdownElement.textContent = qrCountdownSeconds;
        
        // Change color based on time remaining
        if (qrCountdownSeconds <= 30) {
            countdownElement.style.color = '#ef4444'; // Red
        } else if (qrCountdownSeconds <= 60) {
            countdownElement.style.color = '#f59e0b'; // Orange
        } else {
            countdownElement.style.color = '#f59e0b'; // Default orange
        }
    }
}

// Quick Actions
function initQuickActions() {
    document.getElementById('restartWhatsApp')?.addEventListener('click', () => {
        showConfirmModal('Restart WhatsApp', 'Are you sure you want to restart the WhatsApp connection?', () => {
            performAction('restart-whatsapp');
        });
    });
    
    document.getElementById('clearCache')?.addEventListener('click', () => {
        showConfirmModal('Clear Cache', 'Are you sure you want to clear the system cache?', () => {
            performAction('clear-cache');
        });
    });
    
    document.getElementById('exportData')?.addEventListener('click', () => {
        performAction('export-data');
    });
    
    document.getElementById('viewLogs')?.addEventListener('click', () => {
        switchSection('logs');
    });
}

// Perform Action
async function performAction(action) {
    try {
        const response = await fetch(`/api/dashboard/action/${action}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`Action ${action} completed successfully`);
            if (action === 'restart-whatsapp') {
                setTimeout(() => {
                    loadWhatsAppData();
                }, 3000);
            }
        } else {
            showError(result.message || `Failed to ${action}`);
        }
        
    } catch (error) {
        console.error(`Error performing ${action}:`, error);
        showError(`Failed to ${action}`);
    }
}

// Modal Functions
function initModal() {
    const modal = document.getElementById('actionModal');
    const closeBtn = document.getElementById('modalClose');
    const cancelBtn = document.getElementById('modalCancel');
    
    [closeBtn, cancelBtn].forEach(btn => {
        btn?.addEventListener('click', () => {
            hideModal();
        });
    });
    
    // Close modal when clicking outside
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('actionModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('modalConfirm');
    
    if (modal && modalTitle && modalBody && confirmBtn) {
        modalTitle.textContent = title;
        modalBody.innerHTML = `<p>${message}</p>`;
        
        // Remove existing listeners and add new one
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            hideModal();
            onConfirm();
        });
        
        modal.classList.add('show');
    }
}

function hideModal() {
    const modal = document.getElementById('actionModal');
    modal?.classList.remove('show');
}

// Utility Functions
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('show', show);
    }
}

function showSuccess(message) {
    console.log('Success:', message);
    // You can implement a toast notification here
}

function showError(message) {
    console.error('Error:', message);
    // You can implement a toast notification here
}

function updateLastUpdated() {
    const lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) {
        lastUpdated.textContent = new Date().toLocaleTimeString();
    }
}

// Refresh Dashboard
function refreshDashboard() {
    const refreshBtn = document.getElementById('refreshBtn');
    
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
    }
    
    loadDashboardData().finally(() => {
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
    });
}

// Periodic Updates
function initPeriodicUpdates() {
    // Update every 30 seconds
    refreshInterval = setInterval(() => {
        loadSectionData(currentSection);
        updateLastUpdated();
    }, 30000);
}

// Logout
function logout() {
    fetch('/auth/logout', { method: 'POST' })
        .then(() => {
            localStorage.removeItem('dashboardAuth');
            sessionStorage.removeItem('dashboardAuth');
            window.location.href = '/login';
        })
        .catch(error => {
            console.error('Logout error:', error);
            // Force logout even if request fails
            localStorage.removeItem('dashboardAuth');
            sessionStorage.removeItem('dashboardAuth');
            window.location.href = '/login';
        });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Destroy charts
    Object.values(charts).forEach(chart => {
        if (chart) {
            chart.destroy();
        }
    });
});

// Handle window resize
window.addEventListener('resize', () => {
    // Resize charts
    Object.values(charts).forEach(chart => {
        if (chart) {
            chart.resize();
        }
    });
});

// Console message
console.log(`
📊 WhatsApp Finance Bot Dashboard
🔧 Dashboard loaded successfully
📱 Monitoring WhatsApp connection and user activity
⚡ Real-time updates every 30 seconds

Commands:
- refreshDashboard() - Refresh all data
- switchSection('section') - Switch to section
- logout() - Logout from dashboard
`);
