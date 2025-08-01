const Logger = require('../utils/Logger');

class IndonesianAIAssistant {
    constructor(database, aiService) {
        this.db = database;
        this.ai = aiService;
        this.logger = new Logger();
    }

    // Helper function to convert text to proper title case for Indonesian
    toTitleCase(text) {
        if (!text || typeof text !== 'string') return text;
        
        // Words that should remain lowercase (Indonesian articles, prepositions, etc.)
        const lowercaseWords = [
            'dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'dengan', 'dalam', 'pada', 'oleh',
            'yang', 'itu', 'ini', 'akan', 'telah', 'sudah', 'adalah', 'ada', 'tidak',
            'per', 'sama', 'juga', 'lagi', 'bisa', 'dapat', 'harus', 'mau', 'ingin',
            'ya', 'sih', 'kok', 'dong', 'deh', 'kan', 'lah', 'kah', 'tuh'
        ];
        
        return text
            .toLowerCase()
            .split(' ')
            .map((word, index) => {
                // Always capitalize first word
                if (index === 0) {
                    return word.charAt(0).toUpperCase() + word.slice(1);
                }
                
                // Keep lowercase words lowercase (except first word)
                if (lowercaseWords.includes(word)) {
                    return word;
                }
                
                // Capitalize other words
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    }

    // Clean and format AI transaction description
    cleanTransactionDescription(description) {
        if (!description || typeof description !== 'string') return description;
        
        // Remove common prefixes that AI might add
        const prefixesToRemove = [
            'habis ', 'sudah ', 'beli ', 'bayar ', 'buat ', 'untuk ',
            'spent ', 'bought ', 'paid ', 'purchase ', 'buy '
        ];
        
        let cleaned = description.toLowerCase();
        
        // Remove prefixes
        for (const prefix of prefixesToRemove) {
            if (cleaned.startsWith(prefix)) {
                cleaned = cleaned.substring(prefix.length);
                break;
            }
        }
        
        // Apply title case
        return this.toTitleCase(cleaned.trim());
    }

    async processMessage(message, userPhone, messageText) {
        try {
            // Update user activity
            await this.db.updateLastActivity(userPhone);
            
            // Check user registration status
            const userStatus = await this.checkUserStatus(userPhone);
            
            // Check if user has an active registration session (in progress)
            if (userStatus.hasActiveRegistrationSession) {
                return await this.handleRegistrationFlow(message, userPhone, messageText);
            }
            
            // If no user record and no active session, start registration
            if (!userStatus.isRegistered) {
                return await this.handleUnregisteredUser(message, userPhone, messageText);
            }
            
            // If user exists but registration not completed, restart registration
            if (!userStatus.registrationCompleted) {
                return await this.handleUnregisteredUser(message, userPhone, messageText);
            }
            
            // User is fully registered, handle authentication and access control
            return await this.handleRegisteredUser(message, userPhone, messageText, userStatus);
            
        } catch (error) {
            this.logger.error('Error in IndonesianAIAssistant:', error);
            await message.reply('⚠️ Sistem sedang maintenance. Silakan coba beberapa saat lagi.');
            return true;
        }
    }

    async checkUserStatus(phone) {
        const user = await this.db.getUserRegistrationStatus(phone);
        const registrationSession = await this.db.getRegistrationSession(phone);
        
        return {
            isRegistered: !!user,
            registrationCompleted: user?.registration_completed || false,
            hasActiveRegistrationSession: !!registrationSession,
            user,
            registrationSession
        };
    }

    async handleUnregisteredUser(message, userPhone, messageText) {
        const botName = process.env.BOT_NAME || 'Bot Keuangan';
        
        // Start registration process
        await message.reply(
            `👋 Selamat datang di ${botName}!\n\n` +
            'Untuk menggunakan bot keuangan ini, Anda perlu mendaftar terlebih dahulu.\n\n' +
            '📝 Mari kita mulai dengan mendaftar akun Anda.'
        );
        
        await this.db.createRegistrationSession(userPhone);
        
        await message.reply(
            '📝 Langkah 1/3\n\n' +
            'Siapa nama Anda?\n\n' +
            '💡 Masukkan nama Anda'
        );
        
        return true;
    }

    async handleRegistrationFlow(message, userPhone, messageText) {
        const session = await this.db.getRegistrationSession(userPhone);
        
        if (!session) {
            // Session expired or doesn't exist, restart registration
            return await this.handleUnregisteredUser(message, userPhone, messageText);
        }

        const sessionData = typeof session.session_data === 'string' 
            ? JSON.parse(session.session_data) 
            : session.session_data;

        switch (session.step) {
            case 'name':
                return await this.handleNameStep(message, userPhone, messageText, sessionData);
            case 'email':
                return await this.handleEmailStep(message, userPhone, messageText, sessionData);
            case 'city':
                return await this.handleCityStep(message, userPhone, messageText, sessionData);
            default:
                // Invalid step, restart
                return await this.handleUnregisteredUser(message, userPhone, messageText);
        }
    }

    async handleNameStep(message, userPhone, messageText, sessionData) {
        const name = messageText.trim();
        
        // Validate name
        const nameValidation = this.validateName(name);
        if (!nameValidation.isValid) {
            await message.reply(
                `❌ ${nameValidation.error}\n\n` +
                'Coba masukkan nama Anda lagi:'
            );
            return true;
        }
        
        // Save name and move to email step
        sessionData.name = name;
        await this.db.updateRegistrationSession(userPhone, 'email', sessionData);
        
        await message.reply(
            `✅ Terima kasih ${name}!\n\n` +
            '📧 Langkah 2/3\n\n' +
            'Sekarang masukkan alamat email Anda:\n\n' +
            '💡 Email ini akan digunakan untuk notifikasi dan backup data'
        );
        
        return true;
    }

    async handleEmailStep(message, userPhone, messageText, sessionData) {
        const email = messageText.trim().toLowerCase();
        
        // Validate email
        const emailValidation = await this.validateEmail(email, userPhone);
        if (!emailValidation.isValid) {
            await message.reply(
                `❌ ${emailValidation.error}\n\n` +
                'Coba masukkan alamat email yang benar:'
            );
            return true;
        }
        
        // Save email and move to city step
        sessionData.email = email;
        await this.db.updateRegistrationSession(userPhone, 'city', sessionData);
        
        await message.reply(
            `✅ Email ${email} berhasil disimpan!\n\n` +
            '🏙️ Langkah 3/3\n\n' +
            'Terakhir, dari kota mana Anda?\n\n' +
            '💡 Informasi ini membantu kami memberikan layanan yang lebih baik'
        );
        
        return true;
    }

    async handleCityStep(message, userPhone, messageText, sessionData) {
        const city = messageText.trim();
        
        // Validate city
        const cityValidation = this.validateCity(city);
        if (!cityValidation.isValid) {
            await message.reply(
                `❌ ${cityValidation.error}\n\n` +
                'Coba masukkan nama kota Anda:'
            );
            return true;
        }
        
        // Complete registration
        try {
            sessionData.city = city;
            
            const user = await this.db.completeUserRegistration(
                userPhone,
                sessionData.name,
                sessionData.email,
                city
            );
            
            await message.reply(
                '🎉 *Selamat! Registrasi berhasil!*\n\n' +
                '📋 *Ringkasan Data:*\n' +
                `👤 Nama: ${sessionData.name}\n` +
                `📧 Email: ${sessionData.email}\n` +
                `🏙️ Kota: ${city}\n\n` +
                '🎁 *FREE TRIAL 30 HARI!*\n' +
                '✨ Unlimited transaksi selama trial\n' +
                '📊 Akses fitur lengkap\n' +
                '⏰ Setelah trial berakhir, otomatis ke Free Plan (50 transaksi/hari)\n\n' +
                `🚀 *Selamat datang di ${process.env.BOT_NAME || 'Bot Keuangan'}!*\n` +
                'Ketik /menu untuk mulai menggunakan fitur-fitur bot.'
            );
            
            return true;
            
        } catch (error) {
            this.logger.error('Error completing registration:', error);
            
            if (error.message.includes('email') && error.message.includes('unique')) {
                await message.reply(
                    '❌ Email sudah terdaftar dengan akun lain.\n\n' +
                    'Gunakan email yang berbeda atau hubungi admin jika ini adalah kesalahan.'
                );
            } else {
                await message.reply(
                    '❌ Terjadi kesalahan saat menyelesaikan registrasi.\n\n' +
                    'Silakan coba lagi atau hubungi admin.'
                );
            }
            
            return true;
        }
    }

    async handleRegisteredUser(message, userPhone, messageText, userStatus) {
        const { user } = userStatus;
        
        // Check subscription and access control
        const accessCheck = await this.checkAccessControl(userPhone);
        
        if (!accessCheck.allowed) {
            return await this.handleAccessDenied(message, userPhone, accessCheck);
        }
        
        // Greet user personally (only for certain commands)
        if (messageText.startsWith('/') && ['/start', '/menu', '/saldo'].includes(messageText.toLowerCase())) {
            await this.sendPersonalGreeting(message, user, accessCheck.subscription);
        }
        
        // Pass to normal command handling
        return false; // Let other handlers process the message
    }

    async checkAccessControl(phone) {
        const limitCheck = await this.db.checkTransactionLimit(phone);
        return limitCheck;
    }

    async handleAccessDenied(message, userPhone, accessCheck) {
        const { reason, subscription } = accessCheck;
        
        switch (reason) {
            case 'Subscription expired':
                await message.reply(
                    '⏰ *Subscription Expired*\n\n' +
                    'Subscription Anda sudah berakhir.\n\n' +
                    '💎 Upgrade ke Premium untuk melanjutkan:\n' +
                    '• Unlimited transaksi\n' +
                    '• Laporan advanced\n' +
                    '• Export data\n\n' +
                    "Ketik 'upgrade' untuk informasi lebih lanjut!"
                );
                break;
                
            case 'Daily limit reached':
                await message.reply(
                    '🚫 *Kuota Transaksi Harian Habis!*\n\n' +
                    `Kuota transaksi harian Free Plan Anda sudah habis (${subscription.transaction_count}/${subscription.monthly_transaction_limit}).\n\n` +
                    '⏰ *Kuota akan direset besok pagi.*\n\n' +
                    '💎 *Upgrade ke Premium untuk:*\n' +
                    '• ∞ Unlimited transaksi\n' +
                    '• 📊 Laporan advanced\n' +
                    '• 📤 Export data\n' +
                    '• ⚡ Priority support\n\n' +
                    "Ketik 'upgrade' untuk info lebih lanjut!"
                );
                break;
                
            default:
                await message.reply(
                    '❌ Akses ditolak.\n\n' +
                    'Hubungi admin untuk bantuan.'
                );
        }
        
        return true;
    }

    async sendPersonalGreeting(message, user, subscription) {
        const greeting = this.getTimeBasedGreeting();
        const remaining = subscription.monthly_transaction_limit
            ? subscription.monthly_transaction_limit - subscription.transaction_count
            : '∞';
        
        // Check if user is admin
        const isAdmin = await this.db.isUserAdmin(user.phone);
        const adminBadge = isAdmin ? ' 👑' : '';
        const botName = process.env.BOT_NAME || 'Bot Keuangan';
        
        // Get trial status if applicable
        const trialStatus = await this.db.getTrialStatus(user.phone);
        let planInfo = `💎 Plan: ${subscription.display_name}\n`;
        
        if (trialStatus.isTrial && !trialStatus.isExpired) {
            planInfo += `🎁 Trial berakhir dalam: ${trialStatus.daysRemaining} hari\n`;
        } else if (trialStatus.isTrial && trialStatus.isExpired) {
            planInfo += `⏰ Trial Anda telah berakhir\n`;
        }
        
        await message.reply(
            `${greeting} ${user.name}${adminBadge}! 👋\n\n` +
            `🤖 Saya ${botName}, asisten keuangan Anda\n` +
            planInfo +
            `📊 Sisa transaksi hari ini: ${remaining}${subscription.monthly_transaction_limit ? `/${subscription.monthly_transaction_limit}` : ''}\n` +
            (isAdmin ? '👑 Status: Administrator\n' : '') +
            '\nAda yang bisa saya bantu hari ini?'
        );
    }

    getTimeBasedGreeting() {
        const hour = new Date().getHours();
        
        if (hour >= 5 && hour < 12) {
            return 'Selamat pagi';
        } else if (hour >= 12 && hour < 15) {
            return 'Selamat siang';  
        } else if (hour >= 15 && hour < 18) {
            return 'Selamat sore';
        } else {
            return 'Selamat malam';
        }
    }

    // Validation Methods
    validateName(name) {
        if (!name || name.trim().length === 0) {
            return { isValid: false, error: 'Nama tidak boleh kosong.' };
        }
        
        const trimmedName = name.trim();
        
        if (trimmedName.length < 2) {
            return { isValid: false, error: 'Nama terlalu pendek.' };
        }
        
        if (trimmedName.length > 100) {
            return { isValid: false, error: 'Nama terlalu panjang (maksimal 100 karakter).' };
        }
        
        
        // Check for special characters (allow letters, spaces, apostrophes, hyphens)
        const nameRegex = /^[a-zA-Z\s'-]+$/;
        if (!nameRegex.test(trimmedName)) {
            return { isValid: false, error: 'Nama hanya boleh mengandung huruf, spasi, tanda petik, dan tanda hubung.' };
        }
        
        return { isValid: true };
    }

    async validateEmail(email, excludePhone = null) {
        if (!email || email.trim().length === 0) {
            return { isValid: false, error: 'Email tidak boleh kosong.' };
        }
        
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { isValid: false, error: 'Format email tidak valid.' };
        }
        
        // Check for disposable/temporary email domains (basic list)
        const disposableDomains = [
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'mailinator.com', 'yopmail.com', 'temp-mail.org'
        ];
        
        const domain = email.split('@')[1].toLowerCase();
        if (disposableDomains.includes(domain)) {
            return { isValid: false, error: 'Email temporary tidak diperbolehkan.' };
        }
        
        // Check uniqueness
        const isUnique = await this.db.isEmailUnique(email, excludePhone);
        if (!isUnique) {
            return { isValid: false, error: 'Email sudah terdaftar. Gunakan email lain.' };
        }
        
        return { isValid: true };
    }

    validateCity(city) {
        if (!city || city.trim().length === 0) {
            return { isValid: false, error: 'Nama kota tidak boleh kosong.' };
        }
        
        const trimmedCity = city.trim();
        
        if (trimmedCity.length < 2) {
            return { isValid: false, error: 'Nama kota terlalu pendek (minimal 2 karakter).' };
        }
        
        if (trimmedCity.length > 50) {
            return { isValid: false, error: 'Nama kota terlalu panjang (maksimal 50 karakter).' };
        }
        
        // Allow letters, spaces, hyphens, and periods
        const cityRegex = /^[a-zA-Z\s\-\.]+$/;
        if (!cityRegex.test(trimmedCity)) {
            return { isValid: false, error: 'Nama kota hanya boleh mengandung huruf, spasi, dan tanda hubung.' };
        }
        
        return { isValid: true };
    }

    // Transaction quota management
    async handleTransactionRequest(userPhone) {
        const accessCheck = await this.checkAccessControl(userPhone);
        
        if (!accessCheck.allowed) {
            return { allowed: false, accessCheck };
        }
        
        // Increment transaction count for limited plans
        if (accessCheck.subscription.monthly_transaction_limit !== null) {
            await this.db.incrementTransactionCount(userPhone);
        }
        
        return { allowed: true, accessCheck };
    }

    // Generate response templates
    getWelcomeMessage() {
        return '👋 Selamat datang di Bot Keuangan!\n\n' +
               'Sebelum memulai, saya perlu beberapa informasi:\n\n' +
               '📝 Langkah 1/3\n' +
               'Siapa nama lengkap Anda?';
    }

    getRegistrationStepMessage(step, context = {}) {
        switch (step) {
            case 'email':
                return `✅ Terima kasih ${context.name}!\n\n` +
                       '📧 Langkah 2/3\n' +
                       'Sekarang masukkan alamat email Anda:';
                       
            case 'city':
                return `✅ Email ${context.email} berhasil disimpan!\n\n` +
                       '🏙️ Langkah 3/3\n' +
                       'Terakhir, dari kota mana Anda?';
                       
            default:
                return 'Langkah registrasi tidak valid.';
        }
    }

    getErrorMessage(type, details = {}) {
        const errorMessages = {
            'database_error': '⚠️ Sistem sedang maintenance. Silakan coba beberapa saat lagi.',
            'validation_error': `❌ ${details.message}\n\nCoba lagi dengan format yang benar ya!`,
            'session_expired': '⏰ Session registrasi Anda sudah expired. Mari mulai dari awal:',
            'duplicate_data': '📧 Data ini sudah terdaftar. Gunakan data lain atau hubungi admin.',
            'limit_reached': '🚫 Kuota transaksi Free Anda sudah habis!\n\n💎 Upgrade ke Premium untuk unlimited!',
            'subscription_expired': '⏰ Subscription Anda sudah expired. Perpanjang untuk melanjutkan.'
        };
        
        return errorMessages[type] || 'Terjadi kesalahan yang tidak dikenal.';
    }

    getLimitReachedMessage(subscription) {
        return `🚫 Kuota transaksi Free Anda sudah habis!\n\n` +
               `📊 Penggunaan: ${subscription.transaction_count}/${subscription.monthly_transaction_limit}\n\n` +
               '💎 Upgrade ke Premium untuk:\n' +
               '• Unlimited transaksi\n' +
               '• Laporan advanced\n' +
               '• Export data\n\n' +
               "Ketik 'upgrade' untuk info lebih lanjut!";
    }
}

module.exports = IndonesianAIAssistant;
