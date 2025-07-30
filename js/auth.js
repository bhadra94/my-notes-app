class AuthManager {
    constructor() {
        this.currentUser = null;
        this.sessionToken = null;
        this.isAuthenticated = false;
        this.sessionTimeout = null;
        this.sessionDuration = 8 * 60 * 60 * 1000; // 8 hours
        
        this.init();
    }

    init() {
        this.loadStoredSession();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form submissions
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
        }

        // Password visibility toggles
        document.addEventListener('click', (e) => {
            if (e.target.matches('.password-toggle') || e.target.closest('.password-toggle')) {
                const button = e.target.closest('.password-toggle');
                const inputId = button.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (inputId) {
                    this.togglePasswordVisibility(inputId);
                }
            }
        });

        // Password strength indicator
        const registerPassword = document.getElementById('registerPassword');
        if (registerPassword) {
            registerPassword.addEventListener('input', (e) => {
                this.updatePasswordStrength(e.target.value, 'registerPasswordStrength');
            });
        }

        // Click outside to close user dropdown
        document.addEventListener('click', (e) => {
            const userMenu = document.querySelector('.user-menu');
            const userDropdown = document.getElementById('userDropdown');
            
            if (userMenu && !userMenu.contains(e.target) && userDropdown && !userDropdown.classList.contains('hidden')) {
                userDropdown.classList.add('hidden');
            }
        });
    }

    // Authentication Flow Management
    showWelcome() {
        this.hideAllAuthSections();
        document.getElementById('welcomeSection').classList.remove('hidden');
    }

    showLogin() {
        this.hideAllAuthSections();
        document.getElementById('loginSection').classList.remove('hidden');
        setTimeout(() => document.getElementById('loginEmail')?.focus(), 100);
    }

    showRegister() {
        this.hideAllAuthSections();
        document.getElementById('registerSection').classList.remove('hidden');
        setTimeout(() => document.getElementById('firstName')?.focus(), 100);
    }

    showForgotPassword() {
        this.hideAllAuthSections();
        document.getElementById('forgotPasswordSection').classList.remove('hidden');
        setTimeout(() => document.getElementById('resetEmail')?.focus(), 100);
    }

    hideAllAuthSections() {
        document.getElementById('welcomeSection')?.classList.add('hidden');
        document.getElementById('loginSection')?.classList.add('hidden');
        document.getElementById('registerSection')?.classList.add('hidden');
        document.getElementById('forgotPasswordSection')?.classList.add('hidden');
    }

    // User Registration
    async handleRegister(e) {
        e.preventDefault();
        
        const formData = this.getRegistrationFormData();
        const validation = this.validateRegistrationForm(formData);
        
        if (!validation.isValid) {
            this.showAuthError(validation.message);
            return;
        }

        this.setButtonLoading('registerBtn', true);

        try {
            // Simulate registration process
            await this.simulateNetworkDelay();
            
            const user = await this.registerUser(formData);
            
            if (user) {
                this.showAuthSuccess('Account created successfully! Please sign in.');
                this.clearForm('registerForm');
                setTimeout(() => this.showLogin(), 2000);
            }
        } catch (error) {
            this.showAuthError(error.message || 'Registration failed. Please try again.');
        } finally {
            this.setButtonLoading('registerBtn', false);
        }
    }

    async registerUser(formData) {
        // In a real app, this would call your backend API
        // For now, we'll simulate user storage in localStorage
        
        const users = this.getStoredUsers();
        
        // Check if user already exists
        if (users.find(u => u.email === formData.email)) {
            throw new Error('An account with this email already exists.');
        }

        // Create user object
        const user = {
            id: cryptoManager.generateSecureId(),
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            passwordHash: await cryptoManager.hashPassword(formData.password),
            createdAt: new Date().toISOString(),
            lastLoginAt: null,
            isActive: true,
            settings: {
                theme: 'light',
                notifications: true,
                marketingEmails: formData.marketingEmails
            }
        };

        // Store user
        users.push(user);
        localStorage.setItem('secureNotes_users', JSON.stringify(users));

        return user;
    }

    getRegistrationFormData() {
        return {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('registerEmail').value.trim().toLowerCase(),
            password: document.getElementById('registerPassword').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            agreeTerms: document.getElementById('agreeTerms').checked,
            marketingEmails: document.getElementById('marketingEmails').checked
        };
    }

    validateRegistrationForm(data) {
        if (!data.firstName || data.firstName.length < 2) {
            return { isValid: false, message: 'First name must be at least 2 characters long.' };
        }

        if (!data.lastName || data.lastName.length < 2) {
            return { isValid: false, message: 'Last name must be at least 2 characters long.' };
        }

        if (!data.email || !this.isValidEmail(data.email)) {
            return { isValid: false, message: 'Please enter a valid email address.' };
        }

        if (!data.password || data.password.length < 8) {
            return { isValid: false, message: 'Password must be at least 8 characters long.' };
        }

        if (data.password !== data.confirmPassword) {
            return { isValid: false, message: 'Passwords do not match.' };
        }

        const passwordStrength = cryptoManager.calculatePasswordStrength(data.password);
        if (passwordStrength.strength === 'weak') {
            return { isValid: false, message: 'Password is too weak. Please choose a stronger password.' };
        }

        if (!data.agreeTerms) {
            return { isValid: false, message: 'You must agree to the Terms of Service and Privacy Policy.' };
        }

        return { isValid: true };
    }

    // User Login
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!email || !password) {
            this.showAuthError('Please enter both email and password.');
            return;
        }

        this.setButtonLoading('loginBtn', true);

        try {
            await this.simulateNetworkDelay();
            
            const user = await this.authenticateUser(email, password);
            
            if (user) {
                await this.loginUser(user, rememberMe);
                this.showMainApp();
            }
        } catch (error) {
            this.showAuthError(error.message || 'Login failed. Please try again.');
        } finally {
            this.setButtonLoading('loginBtn', false);
        }
    }

    async authenticateUser(email, password) {
        const users = this.getStoredUsers();
        const user = users.find(u => u.email === email && u.isActive);

        if (!user) {
            throw new Error('No account found with this email address.');
        }

        const passwordHash = await cryptoManager.hashPassword(password);
        if (passwordHash !== user.passwordHash) {
            throw new Error('Invalid password. Please try again.');
        }

        return user;
    }

    async loginUser(user, rememberMe = false) {
        // Generate session token
        this.sessionToken = cryptoManager.generateSecureId();
        this.currentUser = user;
        this.isAuthenticated = true;

        // Update user's last login
        const users = this.getStoredUsers();
        const userIndex = users.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
            users[userIndex].lastLoginAt = new Date().toISOString();
            localStorage.setItem('secureNotes_users', JSON.stringify(users));
        }

        // Store session
        const sessionData = {
            userId: user.id,
            sessionToken: this.sessionToken,
            createdAt: new Date().toISOString(),
            rememberMe: rememberMe
        };

        if (rememberMe) {
            localStorage.setItem('secureNotes_session', JSON.stringify(sessionData));
        } else {
            sessionStorage.setItem('secureNotes_session', JSON.stringify(sessionData));
        }

        // Initialize storage manager for this user
        if (window.storageManager) {
            window.storageManager.setCurrentUser(user);
        }

        this.startSessionTimeout();
        this.updateUserInterface();
    }

    // Forgot Password
    async handleForgotPassword(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value.trim().toLowerCase();
        
        if (!email || !this.isValidEmail(email)) {
            this.showAuthError('Please enter a valid email address.');
            return;
        }

        this.setButtonLoading('resetBtn', true);

        try {
            await this.simulateNetworkDelay();
            
            // In a real app, this would send an email
            const users = this.getStoredUsers();
            const user = users.find(u => u.email === email);
            
            if (user) {
                this.showAuthSuccess('Password reset instructions have been sent to your email.');
            } else {
                this.showAuthSuccess('If an account exists with this email, you will receive reset instructions.');
            }
            
            document.getElementById('resetEmail').value = '';
        } catch (error) {
            this.showAuthError('Failed to send reset email. Please try again.');
        } finally {
            this.setButtonLoading('resetBtn', false);
        }
    }

    // Social Login (Placeholder implementations)
    async loginWithGoogle() {
        this.showAuthError('Google login will be available once backend is integrated.');
    }

    async loginWithGitHub() {
        this.showAuthError('GitHub login will be available once backend is integrated.');
    }

    async registerWithGoogle() {
        this.showAuthError('Google registration will be available once backend is integrated.');
    }

    async registerWithGitHub() {
        this.showAuthError('GitHub registration will be available once backend is integrated.');
    }

    // Session Management
    loadStoredSession() {
        let sessionData = null;
        
        // Check localStorage first (remember me)
        const localSession = localStorage.getItem('secureNotes_session');
        if (localSession) {
            try {
                sessionData = JSON.parse(localSession);
            } catch (e) {
                localStorage.removeItem('secureNotes_session');
            }
        }

        // Check sessionStorage if no localStorage session
        if (!sessionData) {
            const sessionSession = sessionStorage.getItem('secureNotes_session');
            if (sessionSession) {
                try {
                    sessionData = JSON.parse(sessionSession);
                } catch (e) {
                    sessionStorage.removeItem('secureNotes_session');
                }
            }
        }

        if (sessionData && this.isValidSession(sessionData)) {
            this.restoreSession(sessionData);
        } else {
            this.showAuthScreen();
        }
    }

    isValidSession(sessionData) {
        if (!sessionData.userId || !sessionData.sessionToken) {
            return false;
        }

        const createdAt = new Date(sessionData.createdAt);
        const now = new Date();
        const timeDiff = now - createdAt;

        // Session expires after 8 hours for regular sessions, 30 days for remember me
        const maxAge = sessionData.rememberMe ? 30 * 24 * 60 * 60 * 1000 : this.sessionDuration;
        
        return timeDiff < maxAge;
    }

    async restoreSession(sessionData) {
        const users = this.getStoredUsers();
        const user = users.find(u => u.id === sessionData.userId && u.isActive);

        if (user) {
            this.currentUser = user;
            this.sessionToken = sessionData.sessionToken;
            this.isAuthenticated = true;

            if (window.storageManager) {
                window.storageManager.setCurrentUser(user);
            }

            this.startSessionTimeout();
            this.showMainApp();
            this.updateUserInterface();
        } else {
            this.clearSession();
            this.showAuthScreen();
        }
    }

    startSessionTimeout() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }

        this.sessionTimeout = setTimeout(() => {
            this.logoutUser();
        }, this.sessionDuration);
    }

    // Logout
    logoutUser() {
        this.clearSession();
        this.currentUser = null;
        this.sessionToken = null;
        this.isAuthenticated = false;

        if (window.storageManager) {
            window.storageManager.clearCurrentUser();
        }

        this.showAuthScreen();
        this.showAuthSuccess('You have been logged out successfully.');
    }

    clearSession() {
        localStorage.removeItem('secureNotes_session');
        sessionStorage.removeItem('secureNotes_session');
        
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
        }
    }

    // UI Management
    showAuthScreen() {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        this.showWelcome();
    }

    showMainApp() {
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        // Initialize main app if needed
        if (window.app && typeof window.app.loadDashboard === 'function') {
            window.app.loadDashboard();
        }
    }

    updateUserInterface() {
        if (!this.currentUser) return;

        // Update user name and email in header
        const userName = document.getElementById('userName');
        const userNameLarge = document.getElementById('userNameLarge');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');

        const fullName = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
        const initials = `${this.currentUser.firstName[0]}${this.currentUser.lastName[0]}`.toUpperCase();

        if (userName) userName.textContent = this.currentUser.firstName;
        if (userNameLarge) userNameLarge.textContent = fullName;
        if (userEmail) userEmail.textContent = this.currentUser.email;
        
        // Update avatar with initials
        if (userAvatar) {
            userAvatar.innerHTML = initials;
        }

        // Update user avatars in dropdown
        const userAvatarLarge = document.querySelector('.user-avatar-large');
        if (userAvatarLarge) {
            userAvatarLarge.innerHTML = initials;
        }
    }

    toggleUserMenu() {
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            userDropdown.classList.toggle('hidden');
        }
    }

    // Utility Functions
    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const button = document.querySelector(`button[onclick*="${inputId}"]`);
        
        if (input && button) {
            const icon = button.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        }
    }

    updatePasswordStrength(password, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !password) {
            if (container) container.style.display = 'none';
            return;
        }

        const strength = cryptoManager.calculatePasswordStrength(password);
        const fill = container.querySelector('.strength-fill');
        const text = container.querySelector('.strength-text');

        if (fill && text) {
            fill.style.width = strength.percentage + '%';
            fill.className = `strength-fill ${strength.strength}`;
            text.textContent = `Password strength: ${strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}`;

            if (strength.feedback.length > 0) {
                text.textContent += ` (${strength.feedback.join(', ')})`;
            }

            container.style.display = 'block';
        }
    }

    setButtonLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const textElement = button.querySelector('.btn-text');
        const spinnerElement = button.querySelector('.btn-spinner');

        if (loading) {
            button.disabled = true;
            if (textElement) textElement.style.opacity = '0';
            if (spinnerElement) spinnerElement.classList.remove('hidden');
        } else {
            button.disabled = false;
            if (textElement) textElement.style.opacity = '1';
            if (spinnerElement) spinnerElement.classList.add('hidden');
        }
    }

    showAuthError(message) {
        this.showToast(message, 'error');
    }

    showAuthSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'info') {
        // Use the existing toast system from app.js
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(message, type);
        } else {
            // Fallback alert
            alert(message);
        }
    }

    clearForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            
            // Clear password strength indicators
            const strengthIndicators = form.querySelectorAll('.password-strength');
            strengthIndicators.forEach(indicator => {
                indicator.style.display = 'none';
            });
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    getStoredUsers() {
        try {
            const users = localStorage.getItem('secureNotes_users');
            return users ? JSON.parse(users) : [];
        } catch (e) {
            return [];
        }
    }

    async simulateNetworkDelay() {
        // Simulate network delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    }

    // Placeholder functions for future features
    showTerms() {
        this.showToast('Terms of Service will be available soon.');
    }

    showPrivacy() {
        this.showToast('Privacy Policy will be available soon.');
    }

    showAccountSettings() {
        this.showToast('Account settings will be available soon.');
    }

    showBilling() {
        this.showToast('Billing & plans will be available soon.');
    }

    showHelp() {
        this.showToast('Help & support will be available soon.');
    }
}

// Global functions for HTML onclick handlers
window.showWelcome = () => window.authManager?.showWelcome();
window.showLogin = () => window.authManager?.showLogin();
window.showRegister = () => window.authManager?.showRegister();
window.showForgotPassword = () => window.authManager?.showForgotPassword();
window.togglePasswordVisibility = (inputId) => window.authManager?.togglePasswordVisibility(inputId);
window.loginWithGoogle = () => window.authManager?.loginWithGoogle();
window.loginWithGitHub = () => window.authManager?.loginWithGitHub();
window.registerWithGoogle = () => window.authManager?.registerWithGoogle();
window.registerWithGitHub = () => window.authManager?.registerWithGitHub();
window.toggleUserMenu = () => window.authManager?.toggleUserMenu();
window.logoutUser = () => window.authManager?.logoutUser();
window.showTerms = () => window.authManager?.showTerms();
window.showPrivacy = () => window.authManager?.showPrivacy();
window.showAccountSettings = () => window.authManager?.showAccountSettings();
window.showBilling = () => window.authManager?.showBilling();
window.showHelp = () => window.authManager?.showHelp();

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});