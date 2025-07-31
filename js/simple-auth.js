// Simple Authentication System - Fallback for when Firebase is not available
class SimpleAuthManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authStateListeners = [];
        this.users = JSON.parse(localStorage.getItem('ballpenbox_users') || '{}');
        
        this.init();
    }

    init() {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('ballpenbox_current_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.isAuthenticated = true;
                this.showMainApp();
                this.updateUserInterface();
            } catch (error) {
                console.error('Error loading saved user:', error);
                localStorage.removeItem('ballpenbox_current_user');
            }
        } else {
            this.showAuthScreen();
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form submissions
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showAuthError('Please enter both email and password.');
            return;
        }

        this.setButtonLoading('loginBtn', true);

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if user exists and password matches
        const user = this.users[email];
        if (!user || user.password !== password) {
            this.showAuthError('Invalid email or password.');
            this.setButtonLoading('loginBtn', false);
            return;
        }

        // Login successful
        this.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            firstName: user.firstName,
            lastName: user.lastName
        };
        this.isAuthenticated = true;

        // Save current user
        localStorage.setItem('ballpenbox_current_user', JSON.stringify(this.currentUser));

        // Initialize storage manager
        if (window.storageManager) {
            window.storageManager.setCurrentUser(this.currentUser);
        }

        this.showMainApp();
        this.updateUserInterface();
        this.showAuthSuccess('Welcome back!');
        this.setButtonLoading('loginBtn', false);
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = this.getRegistrationFormData();
        const validation = this.validateRegistrationForm(formData);
        
        if (!validation.isValid) {
            this.showAuthError(validation.message);
            return;
        }

        this.setButtonLoading('registerBtn', true);

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if user already exists
        if (this.users[formData.email]) {
            this.showAuthError('An account with this email already exists.');
            this.setButtonLoading('registerBtn', false);
            return;
        }

        // Create new user
        const uid = 'user_' + Date.now();
        const user = {
            uid: uid,
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            displayName: `${formData.firstName} ${formData.lastName}`,
            createdAt: new Date().toISOString()
        };

        // Save user
        this.users[formData.email] = user;
        localStorage.setItem('ballpenbox_users', JSON.stringify(this.users));

        // Auto login after registration
        this.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            firstName: user.firstName,
            lastName: user.lastName
        };
        this.isAuthenticated = true;

        // Save current user
        localStorage.setItem('ballpenbox_current_user', JSON.stringify(this.currentUser));

        // Initialize storage manager
        if (window.storageManager) {
            window.storageManager.setCurrentUser(this.currentUser);
        }

        this.showMainApp();
        this.updateUserInterface();
        this.showAuthSuccess('Account created successfully! Welcome to ballpenbox!');
        this.setButtonLoading('registerBtn', false);
    }

    async logoutUser() {
        this.currentUser = null;
        this.isAuthenticated = false;
        
        localStorage.removeItem('ballpenbox_current_user');
        
        if (window.storageManager) {
            window.storageManager.clearCurrentUser();
        }
        
        this.showAuthScreen();
        this.showAuthSuccess('You have been logged out successfully.');
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
        
        // Initialize main app
        setTimeout(() => {
            if (window.app) {
                if (typeof window.app.loadDashboard === 'function') {
                    window.app.loadDashboard();
                }
                if (typeof window.app.switchModule === 'function') {
                    window.app.switchModule('dashboard');
                }
            }
        }, 100);
    }

    showWelcome() {
        this.hideAllAuthSections();
        const welcomeSection = document.getElementById('welcomeSection');
        if (welcomeSection) {
            welcomeSection.classList.remove('hidden');
        }
        setTimeout(() => {
            const emailInput = document.getElementById('loginEmail');
            if (emailInput) emailInput.focus();
        }, 100);
    }

    showRegister() {
        this.hideAllAuthSections();
        document.getElementById('registerSection').classList.remove('hidden');
        setTimeout(() => document.getElementById('firstName')?.focus(), 100);
    }

    hideAllAuthSections() {
        document.getElementById('welcomeSection')?.classList.add('hidden');
        document.getElementById('loginSection')?.classList.add('hidden');
        document.getElementById('registerSection')?.classList.add('hidden');
        document.getElementById('forgotPasswordSection')?.classList.add('hidden');
    }

    updateUserInterface() {
        if (!this.currentUser) return;

        const displayName = this.currentUser.displayName || 
            `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim() ||
            'User';
        
        const firstName = this.currentUser.firstName || displayName.split(' ')[0] || 'User';
        const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Update user interface elements
        const userName = document.getElementById('userName');
        const userNameLarge = document.getElementById('userNameLarge');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');

        if (userName) userName.textContent = firstName;
        if (userNameLarge) userNameLarge.textContent = displayName;
        if (userEmail) userEmail.textContent = this.currentUser.email;
        if (userAvatar) userAvatar.innerHTML = initials;

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
    getRegistrationFormData() {
        return {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('registerEmail').value.trim().toLowerCase(),
            password: document.getElementById('registerPassword').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            agreeTerms: document.getElementById('agreeTerms').checked
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
        if (!data.password || data.password.length < 6) {
            return { isValid: false, message: 'Password must be at least 6 characters long.' };
        }
        if (data.password !== data.confirmPassword) {
            return { isValid: false, message: 'Passwords do not match.' };
        }
        if (!data.agreeTerms) {
            return { isValid: false, message: 'You must agree to the Terms of Service and Privacy Policy.' };
        }
        return { isValid: true };
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
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
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
            alert(message);
        }
    }

    // Demo accounts for testing
    createDemoAccounts() {
        if (!this.users['demo@ballpenbox.com']) {
            this.users['demo@ballpenbox.com'] = {
                uid: 'demo_user_123',
                email: 'demo@ballpenbox.com',
                password: 'demo123',
                firstName: 'Demo',
                lastName: 'User',
                displayName: 'Demo User',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('ballpenbox_users', JSON.stringify(this.users));
        }
    }
}

// Global functions for HTML onclick handlers
window.showWelcome = () => window.simpleAuthManager?.showWelcome();
window.showRegister = () => window.simpleAuthManager?.showRegister();
window.toggleUserMenu = () => window.simpleAuthManager?.toggleUserMenu();
window.logoutUser = () => window.simpleAuthManager?.logoutUser();

// Initialize Simple Auth Manager
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if Firebase auth is not available
    setTimeout(() => {
        if (!window.firebaseAuthManager || !window.firebaseAuth) {
            console.log('Using Simple Auth Manager (Firebase not available)');
            window.simpleAuthManager = new SimpleAuthManager();
            window.simpleAuthManager.createDemoAccounts(); // Create demo account
            window.authManager = window.simpleAuthManager; // For compatibility
        }
    }, 1000);
});