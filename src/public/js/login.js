// Login Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize login functionality
    initLogin();
    
    // Initialize password toggle
    initPasswordToggle();
    
    // Check if already logged in
    checkLoginStatus();
});

function initLogin() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginMessage = document.getElementById('loginMessage');
    
    if (!loginForm || !loginBtn || !loginMessage) return;
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // Basic validation
        if (!username || !password) {
            showMessage('Harap isi username dan password', 'error');
            return;
        }
        
        // Set loading state
        setLoadingState(true);
        
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                    rememberMe
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                showMessage('Login berhasil! Mengalihkan ke dashboard...', 'success');
                
                // Store login state
                if (rememberMe) {
                    localStorage.setItem('dashboardAuth', 'true');
                } else {
                    sessionStorage.setItem('dashboardAuth', 'true');
                }
                
                // Redirect to dashboard after short delay
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);
                
            } else {
                showMessage(result.message || 'Username atau password salah', 'error');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Terjadi kesalahan koneksi. Silakan coba lagi.', 'error');
        } finally {
            setLoadingState(false);
        }
    });
}

function initPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (!toggleBtn || !passwordInput) return;
    
    toggleBtn.addEventListener('click', function() {
        const isPassword = passwordInput.type === 'password';
        
        passwordInput.type = isPassword ? 'text' : 'password';
        
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
    });
}

function checkLoginStatus() {
    // Check if user is already logged in
    const isLoggedIn = localStorage.getItem('dashboardAuth') || sessionStorage.getItem('dashboardAuth');
    
    if (isLoggedIn) {
        // Verify with server
        fetch('/auth/status')
            .then(response => response.json())
            .then(result => {
                if (result.authenticated) {
                    // User is already logged in, redirect to dashboard
                    showMessage('Anda sudah login. Mengalihkan ke dashboard...', 'info');
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1000);
                } else {
                    // Clear invalid auth state
                    localStorage.removeItem('dashboardAuth');
                    sessionStorage.removeItem('dashboardAuth');
                }
            })
            .catch(error => {
                console.error('Auth check error:', error);
                // Clear auth state on error
                localStorage.removeItem('dashboardAuth');
                sessionStorage.removeItem('dashboardAuth');
            });
    }
}

function setLoadingState(loading) {
    const loginBtn = document.getElementById('loginBtn');
    const btnIcon = loginBtn.querySelector('i');
    const btnText = loginBtn.querySelector('span');
    
    if (loading) {
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');
        
        if (btnIcon) {
            btnIcon.className = 'fas fa-spinner';
        }
        if (btnText) {
            btnText.textContent = 'Memproses...';
        }
    } else {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        
        if (btnIcon) {
            btnIcon.className = 'fas fa-sign-in-alt';
        }
        if (btnText) {
            btnText.textContent = 'Masuk Dashboard';
        }
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById('loginMessage');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `login-message ${type} show`;
    
    // Auto hide after 5 seconds for success/info messages
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            hideMessage();
        }, 5000);
    }
}

function hideMessage() {
    const messageEl = document.getElementById('loginMessage');
    if (!messageEl) return;
    
    messageEl.classList.remove('show');
    
    setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = 'login-message';
    }, 300);
}

// Handle Enter key in form fields
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm && document.activeElement.form === loginForm) {
            loginForm.dispatchEvent(new Event('submit'));
        }
    }
});

// Auto-focus username field on page load
window.addEventListener('load', function() {
    const usernameField = document.getElementById('username');
    if (usernameField) {
        usernameField.focus();
    }
});

// Form validation feedback
function initFormValidation() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    [usernameInput, passwordInput].forEach(input => {
        if (!input) return;
        
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        setFieldError(field, 'Field ini wajib diisi');
        return false;
    }
    
    if (field.id === 'username' && value.length < 3) {
        setFieldError(field, 'Username minimal 3 karakter');
        return false;
    }
    
    if (field.id === 'password' && value.length < 6) {
        setFieldError(field, 'Password minimal 6 karakter');
        return false;
    }
    
    setFieldSuccess(field);
    return true;
}

function setFieldError(field, message) {
    field.classList.add('error');
    field.classList.remove('success');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error message
    const errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    errorEl.style.cssText = `
        color: var(--danger-color);
        font-size: 0.8rem;
        margin-top: 0.25rem;
        animation: fadeIn 0.3s ease;
    `;
    
    field.parentNode.appendChild(errorEl);
}

function setFieldSuccess(field) {
    field.classList.remove('error');
    field.classList.add('success');
    
    // Remove error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

// Initialize form validation
document.addEventListener('DOMContentLoaded', initFormValidation);

// Security: Prevent multiple login attempts
let loginAttempts = 0;
const maxAttempts = 5;
const lockoutTime = 15 * 60 * 1000; // 15 minutes

function checkLoginAttempts() {
    const attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
    const lastAttempt = parseInt(localStorage.getItem('lastLoginAttempt') || '0');
    const now = Date.now();
    
    // Reset attempts after lockout time
    if (now - lastAttempt > lockoutTime) {
        localStorage.removeItem('loginAttempts');
        localStorage.removeItem('lastLoginAttempt');
        return true;
    }
    
    if (attempts >= maxAttempts) {
        const remainingTime = Math.ceil((lockoutTime - (now - lastAttempt)) / 1000 / 60);
        showMessage(`Terlalu banyak percobaan login. Coba lagi dalam ${remainingTime} menit.`, 'error');
        return false;
    }
    
    return true;
}

function recordLoginAttempt(success) {
    if (success) {
        localStorage.removeItem('loginAttempts');
        localStorage.removeItem('lastLoginAttempt');
    } else {
        const attempts = parseInt(localStorage.getItem('loginAttempts') || '0') + 1;
        localStorage.setItem('loginAttempts', attempts.toString());
        localStorage.setItem('lastLoginAttempt', Date.now().toString());
    }
}

// Console security warning
console.log(`
🔒 SECURITY WARNING
⚠️  Jangan menjalankan kode yang tidak Anda pahami di console ini.
⚠️  Hal ini dapat membahayakan keamanan akun dashboard Anda.
🔐 Dashboard ini dilindungi dengan sistem autentikasi yang aman.
`);

// Disable right-click context menu (optional security measure)
document.addEventListener('contextmenu', function(e) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        e.preventDefault();
    }
});

// Disable common developer shortcuts (optional security measure)
document.addEventListener('keydown', function(e) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // Disable F12, Ctrl+Shift+I, Ctrl+U
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') || 
            (e.ctrlKey && e.key === 'U')) {
            e.preventDefault();
        }
    }
});

// Auto-logout warning for long sessions
let inactivityTimer;
const inactivityTimeout = 30 * 60 * 1000; // 30 minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        showMessage('Session akan berakhir karena tidak aktif. Silakan login kembali.', 'info');
        setTimeout(() => {
            localStorage.removeItem('dashboardAuth');
            sessionStorage.removeItem('dashboardAuth');
            window.location.reload();
        }, 3000);
    }, inactivityTimeout);
}

// Reset timer on user activity
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
});

// Start inactivity timer
resetInactivityTimer();
