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
                emailVerified: false,
                settings: {
                    theme: 'light',
                    notifications: true,
                    marketingEmails: formData.marketingEmails
                },
                createdAt: this.functions.serverTimestamp(),
                lastLoginAt: this.functions.serverTimestamp()
            });
            
            // Send email verification
            await this.sendEmailVerification();
            
            this.showAuthSuccess('Account created successfully! Please check your email for verification.');
            this.clearForm('registerForm');
            
            // Show email verification prompt
            setTimeout(() => {
                this.showEmailVerificationPrompt();
            }, 1000);
            
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
            // Send password reset email with custom action code settings
            await this.functions.sendPasswordResetEmail(this.auth, email, {
                url: window.location.origin + '/reset-password',
                handleCodeInApp: false
            });
            
            this.showPasswordResetSuccess(email);
            document.getElementById('resetEmail').value = '';
        } catch (error) {
            console.error('Password reset error:', error);
            this.showAuthError(this.getFirebaseErrorMessage(error));
        } finally {
            this.setButtonLoading('resetBtn', false);
        }
    }

    showPasswordResetSuccess(email) {
        const modalContent = `
            <div class="password-reset-success">
                <div class="success-icon">
                    <i class="fas fa-envelope-open"></i>
                </div>
                <h3>Reset Email Sent!</h3>
                <p>We've sent a password reset link to:</p>
                <div class="email-display">
                    <strong>${email}</strong>
                </div>
                <div class="reset-instructions">
                    <h4><i class="fas fa-info-circle"></i> What to do next:</h4>
                    <ol>
                        <li>Check your email inbox</li>
                        <li>Click the "Reset Password" link</li>
                        <li>Create a new strong password</li>
                        <li>Sign in with your new password</li>
                    </ol>
                </div>
                <div class="reset-actions">
                    <button class="btn-secondary" onclick="resendResetEmail('${email}')">
                        <i class="fas fa-paper-plane"></i> Resend Email
                    </button>
                    <button class="btn-primary" onclick="closeResetModal()">
                        <i class="fas fa-check"></i> Got it
                    </button>
                </div>
                <div class="reset-tips">
                    <p><i class="fas fa-lightbulb"></i> <strong>Tip:</strong> Check your spam folder if you don't see the email within 5 minutes.</p>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert(`Password reset email sent to ${email}. Please check your inbox.`);
        }
    }

    async resendResetEmail(email) {
        try {
            this.showAuthSuccess('Sending reset email...');
            
            await this.functions.sendPasswordResetEmail(this.auth, email, {
                url: window.location.origin + '/reset-password',
                handleCodeInApp: false
            });
            
            this.showAuthSuccess('Reset email sent again! Please check your inbox.');
        } catch (error) {
            console.error('Resend reset email error:', error);
            this.showAuthError('Failed to resend email. Please try again.');
        }
    }

    // Enhanced Password Reset with Custom Templates
    async sendCustomPasswordResetEmail(email) {
        try {
            // Create custom action code settings
            const actionCodeSettings = {
                url: window.location.origin + '/reset-password',
                handleCodeInApp: false,
                iOS: {
                    bundleId: 'com.ballpenbox.app'
                },
                android: {
                    packageName: 'com.ballpenbox.app',
                    installApp: true,
                    minimumVersion: '12'
                },
                dynamicLinkDomain: 'ballpenbox.page.link'
            };

            await this.functions.sendPasswordResetEmail(this.auth, email, actionCodeSettings);
            
            // Log the reset attempt for security
            await this.logSecurityEvent('password_reset_requested', {
                email: email,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                ipAddress: await this.getClientIP()
            });
            
            return true;
        } catch (error) {
            console.error('Custom password reset error:', error);
            throw error;
        }
    }

    async logSecurityEvent(eventType, eventData) {
        try {
            const user = this.auth.currentUser;
            const userId = user ? user.uid : 'anonymous';
            
            const securityLogRef = this.functions.doc(this.db, 'securityLogs', userId);
            await this.functions.setDoc(securityLogRef, {
                events: this.functions.arrayUnion({
                    type: eventType,
                    data: eventData,
                    timestamp: this.functions.serverTimestamp()
                })
            }, { merge: true });
        } catch (error) {
            console.error('Security logging error:', error);
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('IP detection error:', error);
            return 'unknown';
        }
    }

    // Password Reset Verification
    async verifyPasswordResetCode(actionCode) {
        try {
            const email = await this.functions.verifyPasswordResetCode(this.auth, actionCode);
            return email;
        } catch (error) {
            console.error('Password reset code verification error:', error);
            throw error;
        }
    }

    async confirmPasswordReset(actionCode, newPassword) {
        try {
            await this.functions.confirmPasswordReset(this.auth, actionCode, newPassword);
            
            // Log successful password reset
            await this.logSecurityEvent('password_reset_completed', {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                ipAddress: await this.getClientIP()
            });
            
            return true;
        } catch (error) {
            console.error('Password reset confirmation error:', error);
            throw error;
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

    // Email Verification
    async sendEmailVerification() {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                throw new Error('No user is currently signed in');
            }

            await this.functions.sendEmailVerification(user, {
                url: window.location.origin + '/dashboard',
                handleCodeInApp: false
            });

            this.showAuthSuccess('Verification email sent! Please check your inbox.');
        } catch (error) {
            console.error('Email verification error:', error);
            this.showAuthError('Failed to send verification email. Please try again.');
        }
    }

    async checkEmailVerification() {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                return false;
            }

            // Reload user to get latest verification status
            await this.functions.reload(user);
            
            return user.emailVerified;
        } catch (error) {
            console.error('Email verification check error:', error);
            return false;
        }
    }

    async requireEmailVerification() {
        const isVerified = await this.checkEmailVerification();
        
        if (!isVerified) {
            this.showAuthError('Please verify your email address before continuing.');
            this.showEmailVerificationPrompt();
            return false;
        }
        
        return true;
    }

    showEmailVerificationPrompt() {
        // Create a modal to prompt for email verification
        const modalContent = `
            <div class="email-verification-prompt">
                <h3><i class="fas fa-envelope"></i> Verify Your Email</h3>
                <p>We've sent a verification email to your inbox. Please check your email and click the verification link.</p>
                <div class="verification-actions">
                    <button class="btn-primary" onclick="resendVerificationEmail()">
                        <i class="fas fa-paper-plane"></i> Resend Email
                    </button>
                    <button class="btn-secondary" onclick="checkVerificationStatus()">
                        <i class="fas fa-check"></i> I've Verified
                    </button>
                </div>
                <p class="verification-note">
                    <i class="fas fa-info-circle"></i>
                    Check your spam folder if you don't see the email.
                </p>
            </div>
        `;

        // Show the modal
        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            // Fallback to alert
            alert('Please check your email for verification link. Check spam folder if not found.');
        }
    }

    // Two-Factor Authentication
    async setupTwoFactorAuth() {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                throw new Error('No user is currently signed in');
            }

            // Generate a new secret for authenticator app
            const secret = await this.functions.generateSecret(user);
            
            // Get the QR code URL for authenticator apps
            const qrCodeUrl = await this.functions.generateQRCodeURL(secret, user.email);
            
            // Store the secret temporarily for verification
            this.temp2FASecret = secret;
            
            this.show2FASetupModal(secret, qrCodeUrl);
            
        } catch (error) {
            console.error('2FA setup error:', error);
            this.showAuthError('Failed to setup 2FA. Please try again.');
        }
    }

    show2FASetupModal(secret, qrCodeUrl) {
        const modalContent = `
            <div class="two-factor-setup">
                <h3><i class="fas fa-shield-alt"></i> Setup Two-Factor Authentication</h3>
                
                <div class="setup-options">
                    <div class="setup-option">
                        <h4><i class="fas fa-mobile-alt"></i> SMS Verification</h4>
                        <p>Receive codes via text message</p>
                        <button class="btn-primary" onclick="setupSMS2FA()">
                            <i class="fas fa-sms"></i> Setup SMS
                        </button>
                    </div>
                    
                    <div class="setup-option">
                        <h4><i class="fas fa-qrcode"></i> Authenticator App</h4>
                        <p>Use Google Authenticator or Authy</p>
                        <button class="btn-primary" onclick="setupAuthenticator2FA()">
                            <i class="fas fa-mobile-alt"></i> Setup App
                        </button>
                    </div>
                </div>
                
                <div class="authenticator-setup hidden" id="authenticatorSetup">
                    <h4>Setup Authenticator App</h4>
                    <div class="qr-code-container">
                        <img src="${qrCodeUrl}" alt="QR Code" class="qr-code">
                    </div>
                    <p class="manual-code">
                        <strong>Manual Code:</strong> <code>${secret}</code>
                    </p>
                    <p class="setup-instructions">
                        1. Open your authenticator app (Google Authenticator, Authy, etc.)<br>
                        2. Scan the QR code or enter the manual code<br>
                        3. Enter the 6-digit code below to verify
                    </p>
                    <div class="verification-input">
                        <input type="text" id="authenticatorCode" placeholder="Enter 6-digit code" maxlength="6" pattern="[0-9]{6}">
                        <button class="btn-primary" onclick="verifyAuthenticatorCode()">
                            <i class="fas fa-check"></i> Verify
                        </button>
                    </div>
                </div>
                
                <div class="sms-setup hidden" id="smsSetup">
                    <h4>Setup SMS Verification</h4>
                    <div class="phone-input">
                        <input type="tel" id="phoneNumber" placeholder="+1 (555) 123-4567" pattern="[+]?[0-9\s\-\(\)]+">
                        <button class="btn-primary" onclick="sendSMSCode()">
                            <i class="fas fa-paper-plane"></i> Send Code
                        </button>
                    </div>
                    <div class="sms-verification hidden" id="smsVerification">
                        <input type="text" id="smsCode" placeholder="Enter 6-digit code" maxlength="6" pattern="[0-9]{6}">
                        <button class="btn-primary" onclick="verifySMSCode()">
                            <i class="fas fa-check"></i> Verify
                        </button>
                    </div>
                </div>
                
                <div class="backup-codes hidden" id="backupCodes">
                    <h4><i class="fas fa-key"></i> Backup Codes</h4>
                    <p>Save these codes in a secure location. You can use them to access your account if you lose your 2FA device.</p>
                    <div class="codes-container">
                        <div class="backup-code" id="backupCode1"></div>
                        <div class="backup-code" id="backupCode2"></div>
                        <div class="backup-code" id="backupCode3"></div>
                        <div class="backup-code" id="backupCode4"></div>
                        <div class="backup-code" id="backupCode5"></div>
                    </div>
                    <button class="btn-secondary" onclick="downloadBackupCodes()">
                        <i class="fas fa-download"></i> Download Codes
                    </button>
                    <button class="btn-primary" onclick="confirm2FASetup()">
                        <i class="fas fa-check"></i> Complete Setup
                    </button>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert('2FA setup modal would appear here');
        }
    }

    async setupSMS2FA() {
        try {
            const phoneNumber = document.getElementById('phoneNumber').value;
            if (!phoneNumber) {
                this.showAuthError('Please enter a valid phone number.');
                return;
            }

            const user = this.auth.currentUser;
            const recaptchaVerifier = new this.functions.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible'
            }, this.auth);

            const confirmationResult = await this.functions.signInWithPhoneNumber(user, phoneNumber, recaptchaVerifier);
            this.smsConfirmationResult = confirmationResult;

            // Show SMS verification input
            document.getElementById('smsSetup').classList.add('hidden');
            document.getElementById('smsVerification').classList.remove('hidden');
            
            this.showAuthSuccess('SMS code sent! Please check your phone.');
            
        } catch (error) {
            console.error('SMS 2FA setup error:', error);
            this.showAuthError('Failed to send SMS code. Please try again.');
        }
    }

    async setupAuthenticator2FA() {
        document.getElementById('authenticatorSetup').classList.remove('hidden');
        document.getElementById('smsSetup').classList.add('hidden');
    }

    async verifyAuthenticatorCode() {
        try {
            const code = document.getElementById('authenticatorCode').value;
            if (!code || code.length !== 6) {
                this.showAuthError('Please enter a valid 6-digit code.');
                return;
            }

            // Verify the code with Firebase
            const user = this.auth.currentUser;
            const credential = this.functions.PhoneAuthProvider.credential(this.temp2FASecret, code);
            await this.functions.updatePhoneNumber(user, credential);

            // Generate backup codes
            await this.generateBackupCodes();
            
        } catch (error) {
            console.error('Authenticator verification error:', error);
            this.showAuthError('Invalid code. Please try again.');
        }
    }

    async verifySMSCode() {
        try {
            const code = document.getElementById('smsCode').value;
            if (!code || code.length !== 6) {
                this.showAuthError('Please enter a valid 6-digit code.');
                return;
            }

            // Verify the SMS code
            const result = await this.smsConfirmationResult.confirm(code);
            
            if (result.user) {
                // Generate backup codes
                await this.generateBackupCodes();
            }
            
        } catch (error) {
            console.error('SMS verification error:', error);
            this.showAuthError('Invalid code. Please try again.');
        }
    }

    async generateBackupCodes() {
        try {
            const codes = [];
            for (let i = 0; i < 5; i++) {
                codes.push(this.generateSecureCode());
            }

            // Store backup codes in Firestore
            const user = this.auth.currentUser;
            const userDocRef = this.functions.doc(this.db, 'users', user.uid);
            await this.functions.updateDoc(userDocRef, {
                backupCodes: codes,
                twoFactorEnabled: true,
                twoFactorMethod: this.smsConfirmationResult ? 'sms' : 'authenticator',
                lastModified: this.functions.serverTimestamp()
            });

            // Display backup codes
            this.displayBackupCodes(codes);
            
        } catch (error) {
            console.error('Backup codes generation error:', error);
            this.showAuthError('Failed to generate backup codes.');
        }
    }

    generateSecureCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    displayBackupCodes(codes) {
        document.getElementById('authenticatorSetup').classList.add('hidden');
        document.getElementById('smsVerification').classList.add('hidden');
        document.getElementById('backupCodes').classList.remove('hidden');

        // Display codes
        codes.forEach((code, index) => {
            const element = document.getElementById(`backupCode${index + 1}`);
            if (element) {
                element.textContent = code;
            }
        });
    }

    async confirm2FASetup() {
        try {
            this.showAuthSuccess('Two-factor authentication setup complete!');
            
            // Close modal
            if (window.app && typeof window.app.closeModal === 'function') {
                window.app.closeModal();
            }
            
            // Update UI to show 2FA is enabled
            this.update2FAStatus(true);
            
        } catch (error) {
            console.error('2FA setup confirmation error:', error);
            this.showAuthError('Failed to complete 2FA setup.');
        }
    }

    update2FAStatus(enabled) {
        const statusElement = document.getElementById('twoFactorStatus');
        if (statusElement) {
            statusElement.className = `two-factor-status ${enabled ? 'enabled' : 'disabled'}`;
            statusElement.innerHTML = `
                <i class="fas fa-${enabled ? 'shield-alt' : 'shield'}"></i>
                ${enabled ? 'Enabled' : 'Disabled'}
            `;
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

    showSecuritySettings() {
        const modalContent = `
            <div class="security-settings">
                <h3><i class="fas fa-shield-alt"></i> Security Settings</h3>
                
                <div class="security-section">
                    <h3><i class="fas fa-shield-alt"></i> Two-Factor Authentication</h3>
                    <div class="security-option">
                        <div class="option-info">
                            <h4>Two-Factor Authentication</h4>
                            <p>Add an extra layer of security to your account</p>
                        </div>
                        <button class="btn-secondary" onclick="setupTwoFactorAuth()">
                            <i class="fas fa-plus"></i> Setup 2FA
                        </button>
                    </div>
                </div>
                
                <div class="security-section">
                    <h3><i class="fas fa-envelope"></i> Email Verification</h3>
                    <div class="security-option">
                        <div class="option-info">
                            <h4>Email Verification</h4>
                            <p>Verify your email address for enhanced security</p>
                        </div>
                        <button class="btn-secondary" onclick="sendEmailVerification()">
                            <i class="fas fa-paper-plane"></i> Resend
                        </button>
                    </div>
                </div>
                
                <div class="security-section">
                    <h3><i class="fas fa-key"></i> Password</h3>
                    <div class="security-option">
                        <div class="option-info">
                            <h4>Change Password</h4>
                            <p>Update your account password</p>
                        </div>
                        <button class="btn-secondary" onclick="showChangePassword()">
                            <i class="fas fa-edit"></i> Change
                        </button>
                    </div>
                </div>
                
                <div class="security-section">
                    <h3><i class="fas fa-download"></i> Data Export</h3>
                    <div class="security-option">
                        <div class="option-info">
                            <h4>Export Data</h4>
                            <p>Download all your data for backup</p>
                        </div>
                        <button class="btn-secondary" onclick="exportAllData()">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>
                
                <div class="security-section">
                    <h3><i class="fas fa-trash"></i> Account</h3>
                    <div class="security-option">
                        <div class="option-info">
                            <h4>Delete Account</h4>
                            <p>Permanently delete your account and all data</p>
                        </div>
                        <button class="btn-danger" onclick="showDeleteAccount()">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert('Security settings modal would appear here');
        }
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
window.showSecuritySettings = () => window.firebaseAuthManager?.showSecuritySettings();

// Email verification functions
window.resendVerificationEmail = () => window.firebaseAuthManager?.sendEmailVerification();
window.checkVerificationStatus = async () => {
    const isVerified = await window.firebaseAuthManager?.checkEmailVerification();
    if (isVerified) {
        window.firebaseAuthManager?.showAuthSuccess('Email verified successfully!');
        // Close modal if it exists
        if (window.app && typeof window.app.closeModal === 'function') {
            window.app.closeModal();
        }
    } else {
        window.firebaseAuthManager?.showAuthError('Email not verified yet. Please check your inbox and click the verification link.');
    }
};

// Two-Factor Authentication functions
window.setupTwoFactorAuth = () => window.firebaseAuthManager?.setupTwoFactorAuth();
window.setupSMS2FA = () => window.firebaseAuthManager?.setupSMS2FA();
window.setupAuthenticator2FA = () => window.firebaseAuthManager?.setupAuthenticator2FA();
window.verifyAuthenticatorCode = () => window.firebaseAuthManager?.verifyAuthenticatorCode();
window.verifySMSCode = () => window.firebaseAuthManager?.verifySMSCode();
window.generateBackupCodes = () => window.firebaseAuthManager?.generateBackupCodes();
window.downloadBackupCodes = () => window.firebaseAuthManager?.downloadBackupCodes();
window.confirm2FASetup = () => window.firebaseAuthManager?.confirm2FASetup();
window.update2FAStatus = (enabled) => window.firebaseAuthManager?.update2FAStatus(enabled);

// Password Reset functions
window.sendCustomPasswordResetEmail = (email) => window.firebaseAuthManager?.sendCustomPasswordResetEmail(email);
window.verifyPasswordResetCode = (actionCode) => window.firebaseAuthManager?.verifyPasswordResetCode(actionCode);
window.confirmPasswordReset = (actionCode, newPassword) => window.firebaseAuthManager?.confirmPasswordReset(actionCode, newPassword);
window.showPasswordResetSuccess = (email) => window.firebaseAuthManager?.showPasswordResetSuccess(email);
window.resendResetEmail = (email) => window.firebaseAuthManager?.resendResetEmail(email);
window.closeResetModal = () => {
    if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal();
    }
};

// Password Strength Validation
window.validatePasswordStrength = (password) => window.firebaseAuthManager?.validatePasswordStrength(password);
window.isCommonPassword = (password) => window.firebaseAuthManager?.isCommonPassword(password);
window.showPasswordStrengthIndicator = (password) => window.firebaseAuthManager?.showPasswordStrengthIndicator(password);
window.getPasswordRequirements = (checks) => window.firebaseAuthManager?.getPasswordRequirements(checks);

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