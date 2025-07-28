// Main JavaScript for Landing Page
document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation Toggle
    initMobileNav();
    
    // QR Code Management
    initQRCode();
    
    // Counter Animation
    initCounterAnimation();
    
    // Smooth Scrolling
    initSmoothScrolling();
    
    // Navigation Active State
    initNavigation();
});

// Mobile Navigation
function initMobileNav() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
        
        // Close menu when clicking on links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }
}

// QR Code Management
function initQRCode() {
    const qrDisplay = document.getElementById('qr-display');
    const connectionStatus = document.getElementById('connection-status');
    const refreshBtn = document.getElementById('refresh-qr');
    
    if (!qrDisplay || !connectionStatus || !refreshBtn) return;
    
    let isConnected = false;
    
    // Update QR Code
    function updateQRCode() {
        if (isConnected) return;
        
        fetch('/qrscan/status')
            .then(response => response.json())
            .then(data => {
                console.log('QR Status:', data);
                
                const statusIndicator = connectionStatus.querySelector('.status-indicator');
                
                if (data.qr && data.qr.trim() !== '') {
                    // Show QR Code
                    qrDisplay.innerHTML = `<img src="data:image/png;base64,${data.qr}" alt="QR Code" style="max-width: 250px; width: 100%; height: auto; border-radius: 12px;">`;
                    
                    statusIndicator.className = 'status-indicator waiting';
                    statusIndicator.innerHTML = '<i class="fas fa-mobile-alt"></i><span>Scan QR code dengan WhatsApp</span>';
                    
                    isConnected = false;
                } else if (data.connected === true) {
                    // Connected
                    qrDisplay.innerHTML = `
                        <div style="text-align: center;">
                            <div style="font-size: 64px; color: #4ade80; margin-bottom: 1rem;">✅</div>
                            <div style="font-size: 1.5rem; color: #4ade80; font-weight: 600;">Terhubung!</div>
                            <div style="font-size: 1rem; color: #6b7280; margin-top: 0.5rem;">Bot siap digunakan</div>
                        </div>
                    `;
                    
                    statusIndicator.className = 'status-indicator connected';
                    statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>🎉 WhatsApp berhasil terhubung!</span>';
                    
                    isConnected = true;
                } else if (data.error) {
                    // Error
                    qrDisplay.innerHTML = `
                        <div style="text-align: center;">
                            <div style="font-size: 48px; color: #ef4444; margin-bottom: 1rem;">❌</div>
                            <div style="font-size: 1.2rem; color: #ef4444; font-weight: 600;">Error</div>
                            <div style="font-size: 0.9rem; color: #6b7280; margin-top: 0.5rem;">${data.error}</div>
                        </div>
                    `;
                    
                    statusIndicator.className = 'status-indicator error';
                    statusIndicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>❌ Error: ${data.error}</span>`;
                    
                    isConnected = false;
                } else {
                    // Loading
                    qrDisplay.innerHTML = `
                        <div class="qr-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Menginisialisasi koneksi...</p>
                        </div>
                    `;
                    
                    statusIndicator.className = 'status-indicator waiting';
                    statusIndicator.innerHTML = '<i class="fas fa-clock"></i><span>🔄 Menunggu koneksi WhatsApp...</span>';
                    
                    isConnected = false;
                }
            })
            .catch(error => {
                console.error('QR Code Error:', error);
                
                qrDisplay.innerHTML = `
                    <div style="text-align: center;">
                        <div style="font-size: 48px; color: #ef4444; margin-bottom: 1rem;">⚠️</div>
                        <div style="font-size: 1.2rem; color: #ef4444; font-weight: 600;">Koneksi Error</div>
                        <div style="font-size: 0.9rem; color: #6b7280; margin-top: 0.5rem;">Gagal memuat QR code</div>
                    </div>
                `;
                
                const statusIndicator = connectionStatus.querySelector('.status-indicator');
                statusIndicator.className = 'status-indicator error';
                statusIndicator.innerHTML = '<i class="fas fa-wifi"></i><span>❌ Gagal terhubung ke server</span>';
            });
    }
    
    // Refresh QR Code
    function refreshQR() {
        if (isConnected) return;
        
        qrDisplay.innerHTML = `
            <div class="qr-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Memuat ulang QR code...</p>
            </div>
        `;
        
        fetch('/qrscan/refresh', { method: 'POST' })
            .then(() => {
                setTimeout(updateQRCode, 1000);
            })
            .catch(error => {
                console.error('Refresh Error:', error);
                updateQRCode();
            });
    }
    
    // Event Listeners
    refreshBtn.addEventListener('click', refreshQR);
    
    // Auto-update QR Code
    updateQRCode(); // Initial load
    setInterval(updateQRCode, 5000); // Every 5 seconds
}

// Counter Animation
function initCounterAnimation() {
    const counters = document.querySelectorAll('.stat-number');
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.getAttribute('data-target'));
                animateCounter(counter, target);
                observer.unobserve(counter);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => {
        observer.observe(counter);
    });
}

function animateCounter(element, target) {
    let current = 0;
    const increment = target / 50; // 50 steps
    const duration = 2000; // 2 seconds
    const stepTime = duration / 50;
    
    element.classList.add('animated');
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        
        // Format number
        if (target >= 1000) {
            element.textContent = Math.floor(current).toLocaleString();
        } else {
            element.textContent = Math.floor(current);
        }
    }, stepTime);
}

// Smooth Scrolling
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Navigation Active State
function initNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    if (sections.length === 0 || navLinks.length === 0) return;
    
    function updateActiveNav() {
        let current = '';
        const scrollY = window.pageYOffset;
        
        sections.forEach(section => {
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.getBoundingClientRect().top + scrollY - 100;
            
            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    }
    
    // Update on scroll
    window.addEventListener('scroll', updateActiveNav);
    
    // Update on load
    updateActiveNav();
}

// Navbar Scroll Effect
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Animation on Scroll
function initScrollAnimations() {
    const animateElements = document.querySelectorAll('.feature-card, .step, .pricing-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    animateElements.forEach(element => {
        observer.observe(element);
    });
}

// Initialize scroll animations
document.addEventListener('DOMContentLoaded', initScrollAnimations);

// Pricing Button Actions
document.addEventListener('DOMContentLoaded', function() {
    const pricingButtons = document.querySelectorAll('.pricing-card .btn');
    
    pricingButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (this.textContent.includes('Gratis')) {
                // Free plan - scroll to QR section
                document.querySelector('#qr-section').scrollIntoView({
                    behavior: 'smooth'
                });
            } else if (this.textContent.includes('Premium')) {
                // Premium plan - show contact info
                alert('Untuk upgrade ke Premium, silakan hubungi admin melalui WhatsApp setelah scan QR code di bawah! 🚀');
                document.querySelector('#qr-section').scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Copy to clipboard function for future use
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show success message
        const toast = document.createElement('div');
        toast.textContent = 'Copied to clipboard!';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4ade80;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: 600;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Error handling for failed image loads
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('error', function() {
            this.style.display = 'none';
        });
    });
});

// Console welcome message
console.log(`
🤖 WhatsApp Finance Bot
👋 Selamat datang developer!
🔧 Bot ini menggunakan teknologi:
   - Baileys (WhatsApp Multi-Device)
   - AI DeepSeek Indonesia
   - PostgreSQL Database
   - Express.js Server
   - Anti-Spam Protection

📱 Scan QR code untuk mulai menggunakan bot!
`);
