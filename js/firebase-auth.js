class FirebaseAuthManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authStateListeners = [];
        
        // Wait for Firebase to be available
        this.initializeWhenReady();
    }

    async initializeWhenReady() {
        // Wait for Firebase to be loaded
        let attempts = 0;
        while ((!window.firebaseAuth || !window.firebaseFunctions) && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.firebaseAuth || !window.firebaseFunctions) {
            console.error('Firebase failed to initialize');
            // Fallback: allow access to main app for testing
            this.showTestLoginOption();
            return;
        }
        
        this.auth = window.firebaseAuth;
        this.db = window.firebaseDb;
        this.functions = window.firebaseFunctions;
        this.providers = window.firebaseProviders;
        
        this.setupAuthStateListener();
        this.setupEventListeners();
    }

    showTestLoginOption() {
        // Add a test login button for development
        const authScreen = document.getElementById('authScreen');
        if (authScreen) {
            authScreen.innerHTML += `
                <div style="position: fixed; top: 10px; right: 10px; z-index: 9999;">
                    <button onclick="window.firebaseAuthManager.testLogin()" style="
                        background: #ef4444; 
                        color: white; 
                        padding: 10px 15px; 
                        border: none; 
                        border-radius: 5px; 
                        cursor: pointer;
                        font-size: 12px;
                    ">Test Login (Dev)</button>
                </div>
            `;
        }
    }

    testLogin() {
        // For development/testing - bypass Firebase auth
        this.currentUser = {
            uid: 'test-user-123',
            email: 'test@example.com',
            displayName: 'Test User',
            firstName: 'Test',
            lastName: 'User'
        };
        this.isAuthenticated = true;
        
        if (window.storageManager) {
            window.storageManager.setCurrentUser(this.currentUser);
        }
        
        this.showMainApp();
        this.updateUserInterface();
        this.showAuthSuccess('Test login successful!');
    }

    setupAuthStateListener() {
        // Listen for authentication state changes
        this.functions.onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                // User is signed in
                this.currentUser = user;
                this.isAuthenticated = true;
                
                // Get additional user data from Firestore
                await this.loadUserProfile(user.uid);
                
                // Initialize storage manager for this user
                if (window.storageManager) {
                    window.storageManager.setCurrentUser(this.currentUser);
                }
                
                this.showMainApp();
                this.updateUserInterface();
                
                // Notify listeners
                this.authStateListeners.forEach(listener => listener(user));
            } else {
                // User is signed out
                this.currentUser = null;
                this.isAuthenticated = false;
                
                if (window.storageManager) {
                    window.storageManager.clearCurrentUser();
                }
                
                this.showAuthScreen();
                
                // Notify listeners
                this.authStateListeners.forEach(listener => listener(null));
            }
        });
    }

    setupEventListeners() {
        // Delay form setup to ensure DOM is ready
        setTimeout(() => {
            this.setupFormListeners();
        }, 500);
    }

    setupFormListeners() {
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
        const welcomeSection = document.getElementById('welcomeSection');
        if (welcomeSection) {
            welcomeSection.classList.remove('hidden');
        }
        // Focus on email input for immediate login
        setTimeout(() => {
            const emailInput = document.getElementById('loginEmail');
            if (emailInput) emailInput.focus();
        }, 100);
    }

    showLogin() {
        this.hideAllAuthSections();
        // The login form is actually in the welcome section, so show that
        document.getElementById('welcomeSection').classList.remove('hidden');
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

    // User Registration with Firebase
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
            // Create user with Firebase Auth
            const userCredential = await this.functions.createUserWithEmailAndPassword(
                this.auth, 
                formData.email, 
                formData.password
            );
            
            const user = userCredential.user;
            
            // Update the user's profile with their name
            await this.functions.updateProfile(user, {
                displayName: `${formData.firstName} ${formData.lastName}`
            });
            
            // Create user profile in Firestore
            await this.createUserProfile(user.uid, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                settings: {
                    theme: 'light',
                    notifications: true,
                    marketingEmails: formData.marketingEmails
                },
                createdAt: this.functions.serverTimestamp(),
                lastLoginAt: this.functions.serverTimestamp()
            });
            
            this.showAuthSuccess('Account created successfully! Welcome to ballpenbox!');
            this.clearForm('registerForm');
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error));
        } finally {
            this.setButtonLoading('registerBtn', false);
        }
    }

    async createUserProfile(uid, profileData) {
        const userDocRef = this.functions.doc(this.db, 'users', uid);
        await this.functions.setDoc(userDocRef, profileData);
    }

    async loadUserProfile(uid) {
        try {
            const userDocRef = this.functions.doc(this.db, 'users', uid);
            const userDoc = await this.functions.getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // Merge Firebase user data with Firestore profile data
                this.currentUser = {
                    ...this.currentUser,
                    ...userData,
                    uid: uid
                };
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // User Login with Firebase
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
            const userCredential = await this.functions.signInWithEmailAndPassword(
                this.auth, 
                email, 
                password
            );
            
            // Update last login time
            await this.updateLastLoginTime(userCredential.user.uid);
            
            this.showAuthSuccess('Welcome back!');
            
            // Note: Firebase handles persistence automatically
            // rememberMe functionality is built into Firebase Auth
            
        } catch (error) {
            console.error('Login error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error));
        } finally {
            this.setButtonLoading('loginBtn', false);
        }
    }

    async updateLastLoginTime(uid) {
        try {
            const userDocRef = this.functions.doc(this.db, 'users', uid);
            await this.functions.updateDoc(userDocRef, {
                lastLoginAt: this.functions.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating last login time:', error);
        }
    }

    // Forgot Password with Firebase
    async handleForgotPassword(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value.trim().toLowerCase();
        
        if (!email || !this.isValidEmail(email)) {
            this.showAuthError('Please enter a valid email address.');
            return;
        }

        this.setButtonLoading('resetBtn', true);

        try {
            await this.functions.sendPasswordResetEmail(this.auth, email);
            this.showAuthSuccess('Password reset email sent! Check your inbox.');
            document.getElementById('resetEmail').value = '';
        } catch (error) {
            console.error('Password reset error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error));
        } finally {
            this.setButtonLoading('resetBtn', false);
        }
    }

    // Social Login
    async loginWithGoogle() {
        try {
            this.showAuthSuccess('Signing in with Google...');
            const result = await this.functions.signInWithPopup(this.auth, this.providers.google);
            const user = result.user;
            
            // Create or update user profile in Firestore
            await this.createOrUpdateSocialUserProfile(user, 'google');
            
            this.showAuthSuccess('Successfully signed in with Google!');
        } catch (error) {
            console.error('Google login error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error));
        }
    }

    async loginWithGitHub() {
        try {
            this.showAuthSuccess('Signing in with GitHub...');
            const result = await this.functions.signInWithPopup(this.auth, this.providers.github);
            const user = result.user;
            
            // Create or update user profile in Firestore
            await this.createOrUpdateSocialUserProfile(user, 'github');
            
            this.showAuthSuccess('Successfully signed in with GitHub!');
        } catch (error) {
            console.error('GitHub login error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error));
        }
    }

    async createOrUpdateSocialUserProfile(user, provider) {
        try {
            const userDocRef = this.functions.doc(this.db, 'users', user.uid);
            const userDoc = await this.functions.getDoc(userDocRef);
            
            const nameParts = (user.displayName || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            const profileData = {
                email: user.email,
                firstName: firstName,
                lastName: lastName,
                photoURL: user.photoURL,
                provider: provider,
                lastLoginAt: this.functions.serverTimestamp()
            };
            
            if (!userDoc.exists()) {
                // Create new profile
                profileData.createdAt = this.functions.serverTimestamp();
                profileData.settings = {
                    theme: 'light',
                    notifications: true,
                    marketingEmails: false
                };
                await this.functions.setDoc(userDocRef, profileData);
            } else {
                // Update existing profile
                await this.functions.updateDoc(userDocRef, profileData);
            }
        } catch (error) {
            console.error('Error creating/updating social user profile:', error);
        }
    }

    // Social Registration (same as login for Firebase)
    async registerWithGoogle() {
        await this.loginWithGoogle();
    }

    async registerWithGitHub() {
        await this.loginWithGitHub();
    }

    // Logout
    async logoutUser() {
        try {
            await this.functions.signOut(this.auth);
            this.showAuthSuccess('You have been logged out successfully.');
        } catch (error) {
            console.error('Logout error:', error);
            this.showAuthError('Error logging out. Please try again.');
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
        setTimeout(() => {
            if (window.app) {
                if (typeof window.app.loadDashboard === 'function') {
                    window.app.loadDashboard();
                }
                // Make sure we're on the dashboard
                if (typeof window.app.switchModule === 'function') {
                    window.app.switchModule('dashboard');
                }
            }
        }, 100);
    }

    updateUserInterface() {
        if (!this.currentUser) return;

        const displayName = this.currentUser.displayName || 
            `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim() ||
            'User';
        
        const nameParts = displayName.split(' ');
        const firstName = this.currentUser.firstName || nameParts[0] || 'User';
        const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Update user name and email in header
        const userName = document.getElementById('userName');
        const userNameLarge = document.getElementById('userNameLarge');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');

        if (userName) userName.textContent = firstName;
        if (userNameLarge) userNameLarge.textContent = displayName;
        if (userEmail) userEmail.textContent = this.currentUser.email;
        
        // Update avatar with initials or photo
        if (userAvatar) {
            if (this.currentUser.photoURL) {
                userAvatar.innerHTML = `<img src="${this.currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                userAvatar.innerHTML = initials;
            }
        }

        // Update user avatars in dropdown
        const userAvatarLarge = document.querySelector('.user-avatar-large');
        if (userAvatarLarge) {
            if (this.currentUser.photoURL) {
                userAvatarLarge.innerHTML = `<img src="${this.currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                userAvatarLarge.innerHTML = initials;
            }
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

        // Use crypto manager if available, otherwise simple strength check
        let strength;
        if (window.cryptoManager && typeof window.cryptoManager.calculatePasswordStrength === 'function') {
            strength = window.cryptoManager.calculatePasswordStrength(password);
        } else {
            // Simple strength calculation
            const score = this.calculateSimplePasswordStrength(password);
            strength = {
                strength: score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong',
                percentage: (score / 6) * 100,
                feedback: []
            };
        }

        const fill = container.querySelector('.strength-fill');
        const text = container.querySelector('.strength-text');

        if (fill && text) {
            fill.style.width = strength.percentage + '%';
            fill.className = `strength-fill ${strength.strength}`;
            text.textContent = `Password strength: ${strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}`;

            if (strength.feedback && strength.feedback.length > 0) {
                text.textContent += ` (${strength.feedback.join(', ')})`;
            }

            container.style.display = 'block';
        }
    }

    calculateSimplePasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
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
            console.log(`${type.toUpperCase()}: ${message}`);
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

    getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/wrong-password':
                return 'Invalid password. Please try again.';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/weak-password':
                return 'Password is too weak. Please choose a stronger password.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in was cancelled.';
            case 'auth/popup-blocked':
                return 'Popup was blocked. Please allow popups and try again.';
            default:
                return error.message || 'An error occurred. Please try again.';
        }
    }

    // Auth state listener management
    onAuthStateChanged(callback) {
        this.authStateListeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(callback);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }

    // Account management functions
    showAccountSettings() {
        this.showToast('Account settings will be available soon.');
    }

    showBilling() {
        this.showToast('Billing & plans will be available soon.');
    }

    showHelp() {
        this.showToast('Help & support will be available soon.');
    }

    showTerms() {
        this.showToast('Terms of Service will be available soon.');
    }

    showPrivacy() {
        this.showToast('Privacy Policy will be available soon.');
    }
}

// Global functions for HTML onclick handlers
window.showWelcome = () => window.firebaseAuthManager?.showWelcome();
window.showLogin = () => window.firebaseAuthManager?.showLogin();
window.showRegister = () => window.firebaseAuthManager?.showRegister();
window.showForgotPassword = () => window.firebaseAuthManager?.showForgotPassword();
window.togglePasswordVisibility = (inputId) => window.firebaseAuthManager?.togglePasswordVisibility(inputId);
window.loginWithGoogle = () => window.firebaseAuthManager?.loginWithGoogle();
window.loginWithGitHub = () => window.firebaseAuthManager?.loginWithGitHub();
window.registerWithGoogle = () => window.firebaseAuthManager?.registerWithGoogle();
window.registerWithGitHub = () => window.firebaseAuthManager?.registerWithGitHub();
window.toggleUserMenu = () => window.firebaseAuthManager?.toggleUserMenu();
window.logoutUser = () => window.firebaseAuthManager?.logoutUser();
window.showTerms = () => window.firebaseAuthManager?.showTerms();
window.showPrivacy = () => window.firebaseAuthManager?.showPrivacy();
window.showAccountSettings = () => window.firebaseAuthManager?.showAccountSettings();
window.showBilling = () => window.firebaseAuthManager?.showBilling();
window.showHelp = () => window.firebaseAuthManager?.showHelp();

// Initialize Firebase auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.firebaseAuthManager = new FirebaseAuthManager();
});

// For backward compatibility, also set as authManager
window.addEventListener('load', () => {
    if (window.firebaseAuthManager) {
        window.authManager = window.firebaseAuthManager;
    }
});