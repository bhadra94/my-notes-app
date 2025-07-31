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
            
            // Send welcome email
            await this.sendWelcomeEmail(user);
            
            this.showAuthSuccess('Account created successfully! Welcome email sent. Please check your email for verification.');
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

    // Welcome Email and Account Notifications
    async sendWelcomeEmail(user) {
        try {
            const welcomeData = {
                to: user.email,
                message: {
                    subject: 'Welcome to BallPenBox! 🎉',
                    html: this.getWelcomeEmailTemplate(user),
                    text: this.getWelcomeEmailText(user)
                }
            };

            // Store welcome email data for Firebase Functions
            await this.functions.setDoc(this.functions.doc(this.db, 'emailQueue', Date.now().toString()), {
                type: 'welcome',
                data: welcomeData,
                status: 'pending',
                createdAt: this.functions.serverTimestamp()
            });

            // Log the welcome email event
            await this.logSecurityEvent('welcome_email_sent', {
                email: user.email,
                userId: user.uid,
                timestamp: new Date().toISOString()
            });

            return true;
        } catch (error) {
            console.error('Welcome email error:', error);
            return false;
        }
    }

    getWelcomeEmailTemplate(user) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to BallPenBox!</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                    .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to BallPenBox!</h1>
                        <p>Your secure digital workspace is ready</p>
                    </div>
                    <div class="content">
                        <h2>Hi ${user.displayName || user.email.split('@')[0]}!</h2>
                        <p>Welcome to BallPenBox - your all-in-one digital workspace for notes, passwords, documents, and more!</p>
                        
                        <div class="feature">
                            <h3>🚀 What you can do now:</h3>
                            <ul>
                                <li><strong>Secure Notes:</strong> Create and organize your thoughts</li>
                                <li><strong>Password Manager:</strong> Store and manage your passwords safely</li>
                                <li><strong>Document Storage:</strong> Upload and organize your files</li>
                                <li><strong>Todo Lists:</strong> Track your tasks and projects</li>
                                <li><strong>Creative Tools:</strong> Express your ideas with our creative modules</li>
                            </ul>
                        </div>

                        <div class="feature">
                            <h3>🔒 Security First:</h3>
                            <ul>
                                <li>End-to-end encryption for all your data</li>
                                <li>Two-factor authentication available</li>
                                <li>Regular security updates</li>
                                <li>Your data is always private and secure</li>
                            </ul>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${window.location.origin}" class="btn">Get Started Now</a>
                        </div>

                        <div class="feature">
                            <h3>💡 Quick Tips:</h3>
                            <ul>
                                <li>Use the search feature to find anything quickly</li>
                                <li>Organize your notes with tags and categories</li>
                                <li>Enable two-factor authentication for extra security</li>
                                <li>Check out our creative tools for inspiration</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2024 BallPenBox. All rights reserved.</p>
                        <p>If you have any questions, feel free to reach out to our support team.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    getWelcomeEmailText(user) {
        return `
Welcome to BallPenBox!

Hi ${user.displayName || user.email.split('@')[0]}!

Welcome to BallPenBox - your all-in-one digital workspace for notes, passwords, documents, and more!

What you can do now:
- Secure Notes: Create and organize your thoughts
- Password Manager: Store and manage your passwords safely
- Document Storage: Upload and organize your files
- Todo Lists: Track your tasks and projects
- Creative Tools: Express your ideas with our creative modules

Security First:
- End-to-end encryption for all your data
- Two-factor authentication available
- Regular security updates
- Your data is always private and secure

Get started now: ${window.location.origin}

Quick Tips:
- Use the search feature to find anything quickly
- Organize your notes with tags and categories
- Enable two-factor authentication for extra security
- Check out our creative tools for inspiration

© 2024 BallPenBox. All rights reserved.
        `;
    }

    // Security Alert Emails
    async sendSecurityAlertEmail(user, alertType, details) {
        try {
            const alertData = {
                to: user.email,
                message: {
                    subject: this.getSecurityAlertSubject(alertType),
                    html: this.getSecurityAlertTemplate(user, alertType, details),
                    text: this.getSecurityAlertText(user, alertType, details)
                }
            };

            // Store security alert data
            await this.functions.setDoc(this.functions.doc(this.db, 'emailQueue', Date.now().toString()), {
                type: 'security_alert',
                data: alertData,
                status: 'pending',
                createdAt: this.functions.serverTimestamp()
            });

            // Log the security alert
            await this.logSecurityEvent('security_alert_sent', {
                email: user.email,
                alertType: alertType,
                details: details,
                timestamp: new Date().toISOString()
            });

            return true;
        } catch (error) {
            console.error('Security alert email error:', error);
            return false;
        }
    }

    getSecurityAlertSubject(alertType) {
        const subjects = {
            'login_attempt': '🔐 New Login Attempt - BallPenBox',
            'password_change': '🔑 Password Changed - BallPenBox',
            'two_factor_enabled': '🔒 Two-Factor Authentication Enabled - BallPenBox',
            'two_factor_disabled': '⚠️ Two-Factor Authentication Disabled - BallPenBox',
            'suspicious_activity': '🚨 Suspicious Activity Detected - BallPenBox',
            'account_recovery': '🆘 Account Recovery Request - BallPenBox'
        };
        return subjects[alertType] || 'Security Alert - BallPenBox';
    }

    getSecurityAlertTemplate(user, alertType, details) {
        const alertInfo = this.getSecurityAlertInfo(alertType, details);
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Security Alert - BallPenBox</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: ${alertInfo.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                    .alert-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid ${alertInfo.color}; }
                    .btn { display: inline-block; padding: 12px 24px; background: ${alertInfo.color}; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
                    .details { background: #f1f3f4; padding: 15px; border-radius: 5px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${alertInfo.icon} ${alertInfo.title}</h1>
                        <p>${alertInfo.subtitle}</p>
                    </div>
                    <div class="content">
                        <h2>Hi ${user.displayName || user.email.split('@')[0]}!</h2>
                        <p>${alertInfo.message}</p>
                        
                        <div class="alert-box">
                            <h3>📋 Activity Details:</h3>
                            <div class="details">
                                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                                <p><strong>Device:</strong> ${details.device || 'Unknown'}</p>
                                <p><strong>Location:</strong> ${details.location || 'Unknown'}</p>
                                <p><strong>IP Address:</strong> ${details.ipAddress || 'Unknown'}</p>
                            </div>
                        </div>

                        ${alertInfo.actionButton ? `
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${window.location.origin}/security" class="btn">Review Security Settings</a>
                        </div>
                        ` : ''}

                        <div class="alert-box">
                            <h3>🔒 Security Tips:</h3>
                            <ul>
                                <li>Enable two-factor authentication for extra security</li>
                                <li>Use strong, unique passwords</li>
                                <li>Never share your login credentials</li>
                                <li>Log out from shared devices</li>
                                <li>Report suspicious activity immediately</li>
                            </ul>
                        </div>

                        ${alertInfo.isSuspicious ? `
                        <div class="alert-box" style="border-left-color: #dc3545;">
                            <h3>🚨 If this wasn't you:</h3>
                            <ul>
                                <li>Change your password immediately</li>
                                <li>Enable two-factor authentication</li>
                                <li>Contact our support team</li>
                                <li>Review your recent account activity</li>
                            </ul>
                        </div>
                        ` : ''}
                    </div>
                    <div class="footer">
                        <p>© 2024 BallPenBox. All rights reserved.</p>
                        <p>This is an automated security notification. Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    getSecurityAlertText(user, alertType, details) {
        const alertInfo = this.getSecurityAlertInfo(alertType, details);
        
        return `
${alertInfo.title}

Hi ${user.displayName || user.email.split('@')[0]}!

${alertInfo.message}

Activity Details:
- Time: ${new Date().toLocaleString()}
- Device: ${details.device || 'Unknown'}
- Location: ${details.location || 'Unknown'}
- IP Address: ${details.ipAddress || 'Unknown'}

Security Tips:
- Enable two-factor authentication for extra security
- Use strong, unique passwords
- Never share your login credentials
- Log out from shared devices
- Report suspicious activity immediately

${alertInfo.isSuspicious ? `
If this wasn't you:
- Change your password immediately
- Enable two-factor authentication
- Contact our support team
- Review your recent account activity
` : ''}

© 2024 BallPenBox. All rights reserved.
This is an automated security notification.
        `;
    }

    getSecurityAlertInfo(alertType, details) {
        const alertTypes = {
            'login_attempt': {
                title: 'New Login Attempt',
                subtitle: 'Someone just signed into your account',
                message: 'We detected a new login to your BallPenBox account. If this was you, no action is needed.',
                icon: '🔐',
                color: '#28a745',
                actionButton: true,
                isSuspicious: false
            },
            'password_change': {
                title: 'Password Changed',
                subtitle: 'Your password was successfully updated',
                message: 'Your BallPenBox account password has been changed. If you made this change, no action is needed.',
                icon: '🔑',
                color: '#007bff',
                actionButton: true,
                isSuspicious: false
            },
            'two_factor_enabled': {
                title: 'Two-Factor Authentication Enabled',
                subtitle: 'Your account is now more secure',
                message: 'Two-factor authentication has been enabled on your BallPenBox account. Your account is now more secure!',
                icon: '🔒',
                color: '#28a745',
                actionButton: false,
                isSuspicious: false
            },
            'two_factor_disabled': {
                title: 'Two-Factor Authentication Disabled',
                subtitle: 'Security feature has been turned off',
                message: 'Two-factor authentication has been disabled on your BallPenBox account. Consider re-enabling it for better security.',
                icon: '⚠️',
                color: '#ffc107',
                actionButton: true,
                isSuspicious: false
            },
            'suspicious_activity': {
                title: 'Suspicious Activity Detected',
                subtitle: 'Unusual activity on your account',
                message: 'We detected unusual activity on your BallPenBox account. Please review the details below and take action if needed.',
                icon: '🚨',
                color: '#dc3545',
                actionButton: true,
                isSuspicious: true
            },
            'account_recovery': {
                title: 'Account Recovery Request',
                subtitle: 'Password reset requested',
                message: 'A password reset was requested for your BallPenBox account. If you made this request, follow the link in the email.',
                icon: '🆘',
                color: '#6f42c1',
                actionButton: true,
                isSuspicious: false
            }
        };
        
        return alertTypes[alertType] || {
            title: 'Security Alert',
            subtitle: 'Account security notification',
            message: 'A security event occurred on your BallPenBox account.',
            icon: '🔐',
            color: '#6c757d',
            actionButton: true,
            isSuspicious: false
        };
    }

    // Account Activity Notifications
    async sendAccountActivityEmail(user, activityType, details) {
        try {
            const activityData = {
                to: user.email,
                message: {
                    subject: this.getActivityEmailSubject(activityType),
                    html: this.getActivityEmailTemplate(user, activityType, details),
                    text: this.getActivityEmailText(user, activityType, details)
                }
            };

            // Store activity email data
            await this.functions.setDoc(this.functions.doc(this.db, 'emailQueue', Date.now().toString()), {
                type: 'account_activity',
                data: activityData,
                status: 'pending',
                createdAt: this.functions.serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Activity email error:', error);
            return false;
        }
    }

    getActivityEmailSubject(activityType) {
        const subjects = {
            'note_created': '📝 New Note Created - BallPenBox',
            'note_updated': '✏️ Note Updated - BallPenBox',
            'password_added': '🔐 New Password Saved - BallPenBox',
            'document_uploaded': '📄 Document Uploaded - BallPenBox',
            'todo_completed': '✅ Todo Completed - BallPenBox',
            'backup_created': '💾 Backup Created - BallPenBox',
            'storage_quota': '📊 Storage Quota Update - BallPenBox'
        };
        return subjects[activityType] || 'Account Activity - BallPenBox';
    }

    getActivityEmailTemplate(user, activityType, details) {
        const activityInfo = this.getActivityInfo(activityType, details);
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Activity - BallPenBox</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                    .activity-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
                    .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
                    .details { background: #f1f3f4; padding: 15px; border-radius: 5px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${activityInfo.icon} ${activityInfo.title}</h1>
                        <p>${activityInfo.subtitle}</p>
                    </div>
                    <div class="content">
                        <h2>Hi ${user.displayName || user.email.split('@')[0]}!</h2>
                        <p>${activityInfo.message}</p>
                        
                        <div class="activity-box">
                            <h3>📋 Activity Details:</h3>
                            <div class="details">
                                ${activityInfo.details}
                            </div>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${window.location.origin}" class="btn">View in BallPenBox</a>
                        </div>

                        <div class="activity-box">
                            <h3>💡 Quick Actions:</h3>
                            <ul>
                                ${activityInfo.quickActions}
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2024 BallPenBox. All rights reserved.</p>
                        <p>You can manage your email preferences in your account settings.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    getActivityEmailText(user, activityType, details) {
        const activityInfo = this.getActivityInfo(activityType, details);
        
        return `
${activityInfo.title}

Hi ${user.displayName || user.email.split('@')[0]}!

${activityInfo.message}

Activity Details:
${activityInfo.details}

Quick Actions:
${activityInfo.quickActions}

View in BallPenBox: ${window.location.origin}

© 2024 BallPenBox. All rights reserved.
You can manage your email preferences in your account settings.
        `;
    }

    getActivityInfo(activityType, details) {
        const activityTypes = {
            'note_created': {
                title: 'New Note Created',
                subtitle: 'Your note has been saved successfully',
                message: 'A new note has been created in your BallPenBox workspace.',
                icon: '📝',
                details: `
                    <p><strong>Note Title:</strong> ${details.title || 'Untitled'}</p>
                    <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Category:</strong> ${details.category || 'General'}</p>
                `,
                quickActions: `
                    <li>Edit the note to add more content</li>
                    <li>Organize it with tags</li>
                    <li>Share it with others</li>
                    <li>Create more notes</li>
                `
            },
            'note_updated': {
                title: 'Note Updated',
                subtitle: 'Your note has been modified',
                message: 'A note in your BallPenBox workspace has been updated.',
                icon: '✏️',
                details: `
                    <p><strong>Note Title:</strong> ${details.title || 'Untitled'}</p>
                    <p><strong>Updated:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Changes:</strong> ${details.changes || 'Content modified'}</p>
                `,
                quickActions: `
                    <li>Review the changes</li>
                    <li>Add more content</li>
                    <li>Share the updated note</li>
                    <li>Create a backup</li>
                `
            },
            'password_added': {
                title: 'New Password Saved',
                subtitle: 'Your password has been securely stored',
                message: 'A new password has been added to your BallPenBox password manager.',
                icon: '🔐',
                details: `
                    <p><strong>Website/Service:</strong> ${details.service || 'Unknown'}</p>
                    <p><strong>Username:</strong> ${details.username || 'Not specified'}</p>
                    <p><strong>Added:</strong> ${new Date().toLocaleString()}</p>
                `,
                quickActions: `
                    <li>Review your password security</li>
                    <li>Generate a stronger password</li>
                    <li>Add more passwords</li>
                    <li>Enable password sharing</li>
                `
            },
            'document_uploaded': {
                title: 'Document Uploaded',
                subtitle: 'Your file has been securely stored',
                message: 'A new document has been uploaded to your BallPenBox storage.',
                icon: '📄',
                details: `
                    <p><strong>File Name:</strong> ${details.filename || 'Unknown'}</p>
                    <p><strong>File Size:</strong> ${details.size || 'Unknown'}</p>
                    <p><strong>Uploaded:</strong> ${new Date().toLocaleString()}</p>
                `,
                quickActions: `
                    <li>Organize your documents</li>
                    <li>Share the document</li>
                    <li>Create a backup</li>
                    <li>Upload more files</li>
                `
            },
            'todo_completed': {
                title: 'Todo Completed',
                subtitle: 'Great job! Task completed successfully',
                message: 'Congratulations! You\'ve completed a todo item in your BallPenBox workspace.',
                icon: '✅',
                details: `
                    <p><strong>Task:</strong> ${details.task || 'Unknown'}</p>
                    <p><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Category:</strong> ${details.category || 'General'}</p>
                `,
                quickActions: `
                    <li>Create new todos</li>
                    <li>Review your progress</li>
                    <li>Set up recurring tasks</li>
                    <li>Share your achievements</li>
                `
            },
            'backup_created': {
                title: 'Backup Created',
                subtitle: 'Your data has been safely backed up',
                message: 'A backup of your BallPenBox data has been created successfully.',
                icon: '💾',
                details: `
                    <p><strong>Backup Type:</strong> ${details.type || 'Full backup'}</p>
                    <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Size:</strong> ${details.size || 'Unknown'}</p>
                `,
                quickActions: `
                    <li>Download the backup</li>
                    <li>Schedule automatic backups</li>
                    <li>Review backup settings</li>
                    <li>Test the backup</li>
                `
            },
            'storage_quota': {
                title: 'Storage Quota Update',
                subtitle: 'Your storage usage has been updated',
                message: 'Your BallPenBox storage usage has been updated.',
                icon: '📊',
                details: `
                    <p><strong>Used Space:</strong> ${details.used || 'Unknown'}</p>
                    <p><strong>Total Space:</strong> ${details.total || 'Unknown'}</p>
                    <p><strong>Usage Percentage:</strong> ${details.percentage || 'Unknown'}%</p>
                `,
                quickActions: `
                    <li>Review your storage usage</li>
                    <li>Clean up old files</li>
                    <li>Upgrade your plan</li>
                    <li>Optimize storage</li>
                `
            }
        };
        
        return activityTypes[activityType] || {
            title: 'Account Activity',
            subtitle: 'Activity in your workspace',
            message: 'An activity occurred in your BallPenBox workspace.',
            icon: '📋',
            details: `
                <p><strong>Activity:</strong> ${activityType}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `,
            quickActions: `
                <li>Review your recent activity</li>
                <li>Check your workspace</li>
                <li>Update your settings</li>
                <li>Contact support</li>
            `
        };
    }

    // Account Recovery Options
    async setupAccountRecovery(user) {
        try {
            const recoveryData = {
                securityQuestions: [],
                backupEmails: [],
                recoveryCodes: this.generateRecoveryCodes(),
                recoveryPhone: '',
                lastUpdated: this.functions.serverTimestamp()
            };

            // Store recovery data in Firestore
            const recoveryRef = this.functions.doc(this.db, 'accountRecovery', user.uid);
            await this.functions.setDoc(recoveryRef, recoveryData);

            // Log recovery setup
            await this.logSecurityEvent('account_recovery_setup', {
                userId: user.uid,
                email: user.email,
                timestamp: new Date().toISOString()
            });

            return true;
        } catch (error) {
            console.error('Account recovery setup error:', error);
            return false;
        }
    }

    generateRecoveryCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            codes.push(this.generateSecureCode());
        }
        return codes;
    }

    async showAccountRecoverySetup() {
        const modalContent = `
            <div class="account-recovery-setup">
                <div class="recovery-header">
                    <h2><i class="fas fa-shield-alt"></i> Account Recovery Setup</h2>
                    <p>Set up multiple recovery options to secure your account</p>
                </div>
                
                <div class="recovery-options">
                    <div class="recovery-option" onclick="showSecurityQuestionsSetup()">
                        <div class="option-icon">
                            <i class="fas fa-question-circle"></i>
                        </div>
                        <div class="option-content">
                            <h3>Security Questions</h3>
                            <p>Set up personal questions for account recovery</p>
                            <span class="status pending">Not configured</span>
                        </div>
                    </div>
                    
                    <div class="recovery-option" onclick="showBackupEmailSetup()">
                        <div class="option-icon">
                            <i class="fas fa-envelope"></i>
                        </div>
                        <div class="option-content">
                            <h3>Backup Email</h3>
                            <p>Add a secondary email for recovery</p>
                            <span class="status pending">Not configured</span>
                        </div>
                    </div>
                    
                    <div class="recovery-option" onclick="showRecoveryCodesSetup()">
                        <div class="option-icon">
                            <i class="fas fa-key"></i>
                        </div>
                        <div class="option-content">
                            <h3>Recovery Codes</h3>
                            <p>Generate backup codes for emergency access</p>
                            <span class="status pending">Not configured</span>
                        </div>
                    </div>
                    
                    <div class="recovery-option" onclick="showRecoveryPhoneSetup()">
                        <div class="option-icon">
                            <i class="fas fa-phone"></i>
                        </div>
                        <div class="option-content">
                            <h3>Recovery Phone</h3>
                            <p>Add a phone number for SMS recovery</p>
                            <span class="status pending">Not configured</span>
                        </div>
                    </div>
                </div>
                
                <div class="recovery-tips">
                    <h4><i class="fas fa-lightbulb"></i> Recovery Tips:</h4>
                    <ul>
                        <li>Set up at least 2 recovery methods</li>
                        <li>Use different devices for backup emails</li>
                        <li>Store recovery codes in a safe place</li>
                        <li>Keep your recovery info updated</li>
                    </ul>
                </div>
                
                <div class="recovery-actions">
                    <button class="btn-secondary" onclick="closeRecoveryModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn-primary" onclick="saveRecoverySettings()">
                        <i class="fas fa-save"></i> Save Settings
                    </button>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert('Account recovery setup will be available soon.');
        }
    }

    async showSecurityQuestionsSetup() {
        const questions = [
            'What was the name of your first pet?',
            'In which city were you born?',
            'What was your mother\'s maiden name?',
            'What was the name of your first school?',
            'What is your favorite book?',
            'What was your childhood nickname?',
            'What is the name of the street you grew up on?',
            'What is your favorite movie?',
            'What was the make of your first car?',
            'What is your favorite food?'
        ];

        const modalContent = `
            <div class="security-questions-setup">
                <div class="setup-header">
                    <h3><i class="fas fa-question-circle"></i> Security Questions</h3>
                    <p>Choose and answer 3 security questions for account recovery</p>
                </div>
                
                <form id="securityQuestionsForm" class="questions-form">
                    <div class="question-group">
                        <label for="question1">Question 1:</label>
                        <select id="question1" required>
                            <option value="">Select a question</option>
                            ${questions.map(q => `<option value="${q}">${q}</option>`).join('')}
                        </select>
                        <input type="text" id="answer1" placeholder="Your answer" required>
                    </div>
                    
                    <div class="question-group">
                        <label for="question2">Question 2:</label>
                        <select id="question2" required>
                            <option value="">Select a question</option>
                            ${questions.map(q => `<option value="${q}">${q}</option>`).join('')}
                        </select>
                        <input type="text" id="answer2" placeholder="Your answer" required>
                    </div>
                    
                    <div class="question-group">
                        <label for="question3">Question 3:</label>
                        <select id="question3" required>
                            <option value="">Select a question</option>
                            ${questions.map(q => `<option value="${q}">${q}</option>`).join('')}
                        </select>
                        <input type="text" id="answer3" placeholder="Your answer" required>
                    </div>
                </form>
                
                <div class="setup-tips">
                    <h4><i class="fas fa-info-circle"></i> Tips:</h4>
                    <ul>
                        <li>Choose questions only you would know</li>
                        <li>Use consistent spelling and capitalization</li>
                        <li>Don't use easily guessable answers</li>
                        <li>Keep your answers private</li>
                    </ul>
                </div>
                
                <div class="setup-actions">
                    <button class="btn-secondary" onclick="closeSecurityQuestionsModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn-primary" onclick="saveSecurityQuestions()">
                        <i class="fas fa-save"></i> Save Questions
                    </button>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert('Security questions setup will be available soon.');
        }
    }

    async showBackupEmailSetup() {
        const modalContent = `
            <div class="backup-email-setup">
                <div class="setup-header">
                    <h3><i class="fas fa-envelope"></i> Backup Email</h3>
                    <p>Add a secondary email for account recovery</p>
                </div>
                
                <form id="backupEmailForm" class="backup-form">
                    <div class="form-group">
                        <label for="backupEmail">Backup Email Address:</label>
                        <input type="email" id="backupEmail" placeholder="Enter backup email" required>
                        <small>This email will be used for account recovery if you lose access to your primary email.</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="backupEmailConfirm">Confirm Backup Email:</label>
                        <input type="email" id="backupEmailConfirm" placeholder="Confirm backup email" required>
                    </div>
                </form>
                
                <div class="setup-tips">
                    <h4><i class="fas fa-info-circle"></i> Important:</h4>
                    <ul>
                        <li>Use a different email provider than your primary</li>
                        <li>Ensure you have access to this email</li>
                        <li>Keep this email secure and private</li>
                        <li>Update if you change email providers</li>
                    </ul>
                </div>
                
                <div class="setup-actions">
                    <button class="btn-secondary" onclick="closeBackupEmailModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn-primary" onclick="saveBackupEmail()">
                        <i class="fas fa-save"></i> Save Backup Email
                    </button>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert('Backup email setup will be available soon.');
        }
    }

    async showRecoveryCodesSetup() {
        const codes = this.generateRecoveryCodes();
        const modalContent = `
            <div class="recovery-codes-setup">
                <div class="setup-header">
                    <h3><i class="fas fa-key"></i> Recovery Codes</h3>
                    <p>Generate backup codes for emergency account access</p>
                </div>
                
                <div class="codes-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Important:</strong> Save these codes in a secure location. You won't be able to see them again.
                </div>
                
                <div class="codes-container">
                    <h4>Your Recovery Codes:</h4>
                    <div class="codes-grid">
                        ${codes.map((code, index) => `
                            <div class="recovery-code">
                                <span class="code-number">${index + 1}</span>
                                <span class="code-value">${code}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="codes-actions">
                    <button class="btn-secondary" onclick="downloadRecoveryCodes()">
                        <i class="fas fa-download"></i> Download Codes
                    </button>
                    <button class="btn-secondary" onclick="printRecoveryCodes()">
                        <i class="fas fa-print"></i> Print Codes
                    </button>
                </div>
                
                <div class="setup-tips">
                    <h4><i class="fas fa-info-circle"></i> Usage:</h4>
                    <ul>
                        <li>Use one code per recovery attempt</li>
                        <li>Codes are single-use only</li>
                        <li>Generate new codes if compromised</li>
                        <li>Store codes securely offline</li>
                    </ul>
                </div>
                
                <div class="setup-actions">
                    <button class="btn-secondary" onclick="closeRecoveryCodesModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn-primary" onclick="saveRecoveryCodes()">
                        <i class="fas fa-save"></i> Save Codes
                    </button>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert('Recovery codes setup will be available soon.');
        }
    }

    async showRecoveryPhoneSetup() {
        const modalContent = `
            <div class="recovery-phone-setup">
                <div class="setup-header">
                    <h3><i class="fas fa-phone"></i> Recovery Phone</h3>
                    <p>Add a phone number for SMS-based account recovery</p>
                </div>
                
                <form id="recoveryPhoneForm" class="phone-form">
                    <div class="form-group">
                        <label for="recoveryPhone">Phone Number:</label>
                        <input type="tel" id="recoveryPhone" placeholder="+1 (555) 123-4567" required>
                        <small>Enter your phone number with country code</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="recoveryPhoneConfirm">Confirm Phone Number:</label>
                        <input type="tel" id="recoveryPhoneConfirm" placeholder="+1 (555) 123-4567" required>
                    </div>
                </form>
                
                <div class="setup-tips">
                    <h4><i class="fas fa-info-circle"></i> Important:</h4>
                    <ul>
                        <li>Use a phone number you control</li>
                        <li>Include country code (+1 for US)</li>
                        <li>Ensure you can receive SMS</li>
                        <li>Update if you change numbers</li>
                    </ul>
                </div>
                
                <div class="setup-actions">
                    <button class="btn-secondary" onclick="closeRecoveryPhoneModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn-primary" onclick="saveRecoveryPhone()">
                        <i class="fas fa-save"></i> Save Phone
                    </button>
                </div>
            </div>
        `;

        if (window.app && typeof window.app.showModal === 'function') {
            window.app.showModal(modalContent);
        } else {
            alert('Recovery phone setup will be available soon.');
        }
    }

    // Account Recovery Process
    async initiateAccountRecovery(email) {
        try {
            // Check if user exists
            const user = await this.functions.getUserByEmail(this.auth, email);
            if (!user) {
                throw new Error('No account found with this email address.');
            }

            // Get recovery options
            const recoveryRef = this.functions.doc(this.db, 'accountRecovery', user.uid);
            const recoveryDoc = await this.functions.getDoc(recoveryRef);
            
            if (!recoveryDoc.exists()) {
                throw new Error('No recovery options configured for this account.');
            }

            const recoveryData = recoveryDoc.data();
            const availableOptions = [];

            if (recoveryData.securityQuestions && recoveryData.securityQuestions.length > 0) {
                availableOptions.push('security_questions');
            }
            if (recoveryData.backupEmails && recoveryData.backupEmails.length > 0) {
                availableOptions.push('backup_email');
            }
            if (recoveryData.recoveryCodes && recoveryData.recoveryCodes.length > 0) {
                availableOptions.push('recovery_codes');
            }
            if (recoveryData.recoveryPhone) {
                availableOptions.push('recovery_phone');
            }

            if (availableOptions.length === 0) {
                throw new Error('No recovery options available. Please contact support.');
            }

            // Generate recovery token
            const recoveryToken = this.generateSecureCode();
            const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            // Store recovery session
            await this.functions.setDoc(this.functions.doc(this.db, 'recoverySessions', recoveryToken), {
                userId: user.uid,
                email: email,
                availableOptions: availableOptions,
                createdAt: this.functions.serverTimestamp(),
                expiresAt: tokenExpiry
            });

            // Send recovery email
            await this.sendRecoveryEmail(user, recoveryToken, availableOptions);

            return {
                success: true,
                message: 'Recovery instructions sent to your email.',
                token: recoveryToken
            };

        } catch (error) {
            console.error('Account recovery initiation error:', error);
            throw error;
        }
    }

    async sendRecoveryEmail(user, token, options) {
        const recoveryData = {
            to: user.email,
            message: {
                subject: '🔐 Account Recovery Request - BallPenBox',
                html: this.getRecoveryEmailTemplate(user, token, options),
                text: this.getRecoveryEmailText(user, token, options)
            }
        };

        // Store recovery email data
        await this.functions.setDoc(this.functions.doc(this.db, 'emailQueue', Date.now().toString()), {
            type: 'account_recovery',
            data: recoveryData,
            status: 'pending',
            createdAt: this.functions.serverTimestamp()
        });
    }

    getRecoveryEmailTemplate(user, token, options) {
        const recoveryUrl = `${window.location.origin}/recover?token=${token}`;
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Recovery - BallPenBox</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                    .btn { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Account Recovery Request</h1>
                        <p>Secure your account access</p>
                    </div>
                    <div class="content">
                        <h2>Hi ${user.displayName || user.email.split('@')[0]}!</h2>
                        <p>We received a request to recover your BallPenBox account. If this was you, click the button below to proceed with account recovery.</p>
                        
                        <div class="warning">
                            <strong>⚠️ Important:</strong> This link will expire in 30 minutes for security reasons.
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${recoveryUrl}" class="btn">Recover My Account</a>
                        </div>

                        <h3>Available Recovery Methods:</h3>
                        <ul>
                            ${options.includes('security_questions') ? '<li>Security Questions</li>' : ''}
                            ${options.includes('backup_email') ? '<li>Backup Email Verification</li>' : ''}
                            ${options.includes('recovery_codes') ? '<li>Recovery Codes</li>' : ''}
                            ${options.includes('recovery_phone') ? '<li>SMS Verification</li>' : ''}
                        </ul>

                        <div class="warning">
                            <strong>🔒 Security Notice:</strong>
                            <ul>
                                <li>If you didn't request this recovery, ignore this email</li>
                                <li>Never share recovery links with anyone</li>
                                <li>Contact support if you have concerns</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2024 BallPenBox. All rights reserved.</p>
                        <p>This is an automated security notification.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    getRecoveryEmailText(user, token, options) {
        const recoveryUrl = `${window.location.origin}/recover?token=${token}`;
        
        return `
Account Recovery Request - BallPenBox

Hi ${user.displayName || user.email.split('@')[0]}!

We received a request to recover your BallPenBox account. If this was you, visit the link below to proceed with account recovery.

Recovery Link: ${recoveryUrl}

⚠️ Important: This link will expire in 30 minutes for security reasons.

Available Recovery Methods:
${options.includes('security_questions') ? '- Security Questions' : ''}
${options.includes('backup_email') ? '- Backup Email Verification' : ''}
${options.includes('recovery_codes') ? '- Recovery Codes' : ''}
${options.includes('recovery_phone') ? '- SMS Verification' : ''}

🔒 Security Notice:
- If you didn't request this recovery, ignore this email
- Never share recovery links with anyone
- Contact support if you have concerns

© 2024 BallPenBox. All rights reserved.
This is an automated security notification.
        `;
    }

    // Session Management
    async setupSessionManagement(user) {
        try {
            const sessionData = {
                userId: user.uid,
                email: user.email,
                activeSessions: [],
                deviceWhitelist: [],
                sessionSettings: {
                    maxSessions: 5,
                    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
                    requireReauth: false,
                    trackDevices: true
                },
                lastUpdated: this.functions.serverTimestamp()
            };

            // Store session management data
            const sessionRef = this.functions.doc(this.db, 'sessionManagement', user.uid);
            await this.functions.setDoc(sessionRef, sessionData);

            // Log session management setup
            await this.logSecurityEvent('session_management_setup', {
                userId: user.uid,
                email: user.email,
                timestamp: new Date().toISOString()
            });

            return true;
        } catch (error) {
            console.error('Session management setup error:', error);
            return false;
        }
    }

    async trackUserSession(user, sessionInfo) {
        try {
            const sessionData = {
                sessionId: this.generateSecureCode(),
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screenResolution: `${screen.width}x${screen.height}`,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                location: await this.getClientLocation(),
                ipAddress: await this.getClientIP(),
                loginTime: this.functions.serverTimestamp(),
                lastActivity: this.functions.serverTimestamp(),
                isActive: true
            };

            // Store session in Firestore
            const sessionRef = this.functions.doc(this.db, 'userSessions', sessionData.sessionId);
            await this.functions.setDoc(sessionRef, {
                ...sessionData,
                userId: user.uid,
                email: user.email
            });

            // Update session management
            const managementRef = this.functions.doc(this.db, 'sessionManagement', user.uid);
            await this.functions.updateDoc(managementRef, {
                activeSessions: this.functions.arrayUnion(sessionData.sessionId),
                lastUpdated: this.functions.serverTimestamp()
            });

            // Store session ID in localStorage for tracking
            localStorage.setItem('ballpenbox_session_id', sessionData.sessionId);

            // Log session creation
            await this.logSecurityEvent('session_created', {
                userId: user.uid,
                sessionId: sessionData.sessionId,
                deviceInfo: sessionData.deviceInfo,
                timestamp: new Date().toISOString()
            });

            return sessionData.sessionId;
        } catch (error) {
            console.error('Session tracking error:', error);
            return null;
        }
    }

    async getClientLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            return {
                city: data.city,
                region: data.region,
                country: data.country,
                latitude: data.latitude,
                longitude: data.longitude
            };
        } catch (error) {
            console.error('Location detection error:', error);
            return {
                city: 'Unknown',
                region: 'Unknown',
                country: 'Unknown',
                latitude: null,
                longitude: null
            };
        }
    }

    async updateSessionActivity(sessionId) {
        try {
            const sessionRef = this.functions.doc(this.db, 'userSessions', sessionId);
            await this.functions.updateDoc(sessionRef, {
                lastActivity: this.functions.serverTimestamp()
            });
        } catch (error) {
            console.error('Session activity update error:', error);
        }
    }

    async showSessionManagement() {
        const user = this.auth.currentUser;
        if (!user) return;

        try {
            // Get user's active sessions
            const managementRef = this.functions.doc(this.db, 'sessionManagement', user.uid);
            const managementDoc = await this.functions.getDoc(managementRef);
            
            let activeSessions = [];
            if (managementDoc.exists()) {
                const data = managementDoc.data();
                if (data.activeSessions && data.activeSessions.length > 0) {
                    // Get session details
                    const sessionPromises = data.activeSessions.map(async (sessionId) => {
                        const sessionRef = this.functions.doc(this.db, 'userSessions', sessionId);
                        const sessionDoc = await this.functions.getDoc(sessionRef);
                        if (sessionDoc.exists()) {
                            return { id: sessionId, ...sessionDoc.data() };
                        }
                        return null;
                    });
                    
                    const sessions = await Promise.all(sessionPromises);
                    activeSessions = sessions.filter(session => session !== null);
                }
            }

            const modalContent = `
                <div class="session-management">
                    <div class="session-header">
                        <h2><i class="fas fa-desktop"></i> Session Management</h2>
                        <p>Manage your active sessions and devices</p>
                    </div>
                    
                    <div class="session-stats">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-desktop"></i>
                            </div>
                            <div class="stat-content">
                                <h3>${activeSessions.length}</h3>
                                <p>Active Sessions</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <h3>24h</h3>
                                <p>Session Timeout</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="stat-content">
                                <h3>5</h3>
                                <p>Max Sessions</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="active-sessions">
                        <h3><i class="fas fa-list"></i> Active Sessions</h3>
                        ${activeSessions.length === 0 ? `
                            <div class="no-sessions">
                                <i class="fas fa-info-circle"></i>
                                <p>No active sessions found</p>
                            </div>
                        ` : `
                            <div class="sessions-list">
                                ${activeSessions.map(session => this.renderSessionCard(session)).join('')}
                            </div>
                        `}
                    </div>
                    
                    <div class="session-actions">
                        <button class="btn-secondary" onclick="forceLogoutAll()">
                            <i class="fas fa-sign-out-alt"></i> Logout All Devices
                        </button>
                        <button class="btn-primary" onclick="refreshSessions()">
                            <i class="fas fa-sync"></i> Refresh Sessions
                        </button>
                    </div>
                    
                    <div class="session-settings">
                        <h3><i class="fas fa-cog"></i> Session Settings</h3>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="trackDevices" checked>
                                    Track device information
                                </label>
                            </div>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="requireReauth">
                                    Require re-authentication for sensitive actions
                                </label>
                            </div>
                            <div class="setting-item">
                                <label>Session Timeout:</label>
                                <select id="sessionTimeout">
                                    <option value="3600000">1 hour</option>
                                    <option value="86400000" selected>24 hours</option>
                                    <option value="604800000">7 days</option>
                                    <option value="2592000000">30 days</option>
                                </select>
                            </div>
                            <div class="setting-item">
                                <label>Max Sessions:</label>
                                <select id="maxSessions">
                                    <option value="3">3 sessions</option>
                                    <option value="5" selected>5 sessions</option>
                                    <option value="10">10 sessions</option>
                                    <option value="20">20 sessions</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="session-actions">
                        <button class="btn-secondary" onclick="closeSessionModal()">
                            <i class="fas fa-times"></i> Close
                        </button>
                        <button class="btn-primary" onclick="saveSessionSettings()">
                            <i class="fas fa-save"></i> Save Settings
                        </button>
                    </div>
                </div>
            `;

            if (window.app && typeof window.app.showModal === 'function') {
                window.app.showModal(modalContent);
            } else {
                alert('Session management will be available soon.');
            }
        } catch (error) {
            console.error('Session management error:', error);
            alert('Error loading session management.');
        }
    }

    renderSessionCard(session) {
        const isCurrentSession = session.sessionId === localStorage.getItem('ballpenbox_session_id');
        const deviceIcon = this.getDeviceIcon(session.deviceInfo.userAgent);
        const location = session.location || {};
        
        return `
            <div class="session-card ${isCurrentSession ? 'current-session' : ''}">
                <div class="session-header">
                    <div class="device-info">
                        <div class="device-icon">
                            <i class="${deviceIcon}"></i>
                        </div>
                        <div class="device-details">
                            <h4>${this.getDeviceName(session.deviceInfo.userAgent)}</h4>
                            <p>${session.deviceInfo.platform} • ${location.city || 'Unknown'}, ${location.country || 'Unknown'}</p>
                        </div>
                    </div>
                    <div class="session-status">
                        ${isCurrentSession ? '<span class="status current">Current</span>' : '<span class="status active">Active</span>'}
                    </div>
                </div>
                
                <div class="session-details">
                    <div class="detail-item">
                        <span class="label">IP Address:</span>
                        <span class="value">${session.ipAddress || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Login Time:</span>
                        <span class="value">${this.formatTimestamp(session.loginTime)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Last Activity:</span>
                        <span class="value">${this.formatTimestamp(session.lastActivity)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Screen Resolution:</span>
                        <span class="value">${session.deviceInfo.screenResolution}</span>
                    </div>
                </div>
                
                <div class="session-actions">
                    ${!isCurrentSession ? `
                        <button class="btn-danger" onclick="forceLogoutSession('${session.sessionId}')">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </button>
                    ` : `
                        <span class="current-indicator">Current Session</span>
                    `}
                </div>
            </div>
        `;
    }

    getDeviceIcon(userAgent) {
        if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
            return 'fas fa-mobile-alt';
        } else if (userAgent.includes('Android')) {
            return 'fas fa-mobile-alt';
        } else if (userAgent.includes('Windows')) {
            return 'fas fa-desktop';
        } else if (userAgent.includes('Mac')) {
            return 'fas fa-laptop';
        } else if (userAgent.includes('Linux')) {
            return 'fas fa-desktop';
        } else {
            return 'fas fa-desktop';
        }
    }

    getDeviceName(userAgent) {
        if (userAgent.includes('iPhone')) {
            return 'iPhone';
        } else if (userAgent.includes('iPad')) {
            return 'iPad';
        } else if (userAgent.includes('Android')) {
            return 'Android Device';
        } else if (userAgent.includes('Windows')) {
            return 'Windows PC';
        } else if (userAgent.includes('Mac')) {
            return 'Mac';
        } else if (userAgent.includes('Linux')) {
            return 'Linux PC';
        } else {
            return 'Unknown Device';
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    }

    async forceLogoutSession(sessionId) {
        try {
            const user = this.auth.currentUser;
            if (!user) return;

            // Remove session from Firestore
            const sessionRef = this.functions.doc(this.db, 'userSessions', sessionId);
            await this.functions.deleteDoc(sessionRef);

            // Update session management
            const managementRef = this.functions.doc(this.db, 'sessionManagement', user.uid);
            await this.functions.updateDoc(managementRef, {
                activeSessions: this.functions.arrayRemove(sessionId),
                lastUpdated: this.functions.serverTimestamp()
            });

            // Log the force logout
            await this.logSecurityEvent('session_force_logout', {
                userId: user.uid,
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            });

            this.showAuthSuccess('Session logged out successfully.');
            
            // Refresh the session management modal
            setTimeout(() => {
                this.showSessionManagement();
            }, 1000);

        } catch (error) {
            console.error('Force logout error:', error);
            this.showAuthError('Failed to logout session.');
        }
    }

    async forceLogoutAllSessions() {
        try {
            const user = this.auth.currentUser;
            if (!user) return;

            // Get all active sessions
            const managementRef = this.functions.doc(this.db, 'sessionManagement', user.uid);
            const managementDoc = await this.functions.getDoc(managementRef);
            
            if (managementDoc.exists()) {
                const data = managementDoc.data();
                if (data.activeSessions && data.activeSessions.length > 0) {
                    // Delete all session documents
                    const deletePromises = data.activeSessions.map(async (sessionId) => {
                        const sessionRef = this.functions.doc(this.db, 'userSessions', sessionId);
                        await this.functions.deleteDoc(sessionRef);
                    });
                    
                    await Promise.all(deletePromises);
                }

                // Clear active sessions
                await this.functions.updateDoc(managementRef, {
                    activeSessions: [],
                    lastUpdated: this.functions.serverTimestamp()
                });
            }

            // Log the force logout all
            await this.logSecurityEvent('all_sessions_force_logout', {
                userId: user.uid,
                timestamp: new Date().toISOString()
            });

            this.showAuthSuccess('All sessions logged out successfully.');
            
            // Refresh the session management modal
            setTimeout(() => {
                this.showSessionManagement();
            }, 1000);

        } catch (error) {
            console.error('Force logout all error:', error);
            this.showAuthError('Failed to logout all sessions.');
        }
    }

    async checkSessionValidity() {
        try {
            const sessionId = localStorage.getItem('ballpenbox_session_id');
            if (!sessionId) return false;

            const sessionRef = this.functions.doc(this.db, 'userSessions', sessionId);
            const sessionDoc = await this.functions.getDoc(sessionRef);
            
            if (!sessionDoc.exists()) {
                // Session doesn't exist, clear localStorage
                localStorage.removeItem('ballpenbox_session_id');
                return false;
            }

            const sessionData = sessionDoc.data();
            const now = new Date();
            const lastActivity = sessionData.lastActivity.toDate ? sessionData.lastActivity.toDate() : new Date(sessionData.lastActivity);
            const timeout = 24 * 60 * 60 * 1000; // 24 hours

            if (now.getTime() - lastActivity.getTime() > timeout) {
                // Session expired, remove it
                await this.functions.deleteDoc(sessionRef);
                localStorage.removeItem('ballpenbox_session_id');
                return false;
            }

            // Update last activity
            await this.updateSessionActivity(sessionId);
            return true;

        } catch (error) {
            console.error('Session validity check error:', error);
            return false;
        }
    }

    async setupSessionMonitoring() {
        // Check session validity every 5 minutes
        setInterval(async () => {
            const isValid = await this.checkSessionValidity();
            if (!isValid && this.auth.currentUser) {
                // Session expired, logout user
                await this.logoutUser();
                this.showAuthError('Your session has expired. Please login again.');
            }
        }, 5 * 60 * 1000);

        // Update session activity on user interaction
        const updateActivity = () => {
            const sessionId = localStorage.getItem('ballpenbox_session_id');
            if (sessionId) {
                this.updateSessionActivity(sessionId);
            }
        };

        // Monitor user activity
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
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

// Email Notification functions
window.sendWelcomeEmail = (user) => window.firebaseAuthManager?.sendWelcomeEmail(user);
window.sendSecurityAlertEmail = (user, alertType, details) => window.firebaseAuthManager?.sendSecurityAlertEmail(user, alertType, details);
window.sendAccountActivityEmail = (user, activityType, details) => window.firebaseAuthManager?.sendAccountActivityEmail(user, activityType, details);

// Email template functions
window.getWelcomeEmailTemplate = (user) => window.firebaseAuthManager?.getWelcomeEmailTemplate(user);
window.getSecurityAlertTemplate = (user, alertType, details) => window.firebaseAuthManager?.getSecurityAlertTemplate(user, alertType, details);
window.getActivityEmailTemplate = (user, activityType, details) => window.firebaseAuthManager?.getActivityEmailTemplate(user, activityType, details);

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

// Account Recovery functions
window.setupAccountRecovery = (user) => window.firebaseAuthManager?.setupAccountRecovery(user);
window.showAccountRecoverySetup = () => window.firebaseAuthManager?.showAccountRecoverySetup();
window.showSecurityQuestionsSetup = () => window.firebaseAuthManager?.showSecurityQuestionsSetup();
window.showBackupEmailSetup = () => window.firebaseAuthManager?.showBackupEmailSetup();
window.showRecoveryCodesSetup = () => window.firebaseAuthManager?.showRecoveryCodesSetup();
window.showRecoveryPhoneSetup = () => window.firebaseAuthManager?.showRecoveryPhoneSetup();
window.initiateAccountRecovery = (email) => window.firebaseAuthManager?.initiateAccountRecovery(email);

// Recovery modal functions
window.closeRecoveryModal = () => {
    if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal();
    }
};
window.closeSecurityQuestionsModal = () => {
    if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal();
    }
};
window.closeBackupEmailModal = () => {
    if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal();
    }
};
window.closeRecoveryCodesModal = () => {
    if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal();
    }
};
window.closeRecoveryPhoneModal = () => {
    if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal();
    }
};

// Recovery action functions
window.saveRecoverySettings = () => window.firebaseAuthManager?.saveRecoverySettings();
window.saveSecurityQuestions = () => window.firebaseAuthManager?.saveSecurityQuestions();
window.saveBackupEmail = () => window.firebaseAuthManager?.saveBackupEmail();
window.saveRecoveryCodes = () => window.firebaseAuthManager?.saveRecoveryCodes();
window.saveRecoveryPhone = () => window.firebaseAuthManager?.saveRecoveryPhone();
window.downloadRecoveryCodes = () => window.firebaseAuthManager?.downloadRecoveryCodes();
window.printRecoveryCodes = () => window.firebaseAuthManager?.printRecoveryCodes();

// Session Management functions
window.setupSessionManagement = (user) => window.firebaseAuthManager?.setupSessionManagement(user);
window.trackUserSession = (user, sessionInfo) => window.firebaseAuthManager?.trackUserSession(user, sessionInfo);
window.showSessionManagement = () => window.firebaseAuthManager?.showSessionManagement();
window.forceLogoutSession = (sessionId) => window.firebaseAuthManager?.forceLogoutSession(sessionId);
window.forceLogoutAll = () => window.firebaseAuthManager?.forceLogoutAllSessions();
window.refreshSessions = () => window.firebaseAuthManager?.showSessionManagement();
window.checkSessionValidity = () => window.firebaseAuthManager?.checkSessionValidity();
window.setupSessionMonitoring = () => window.firebaseAuthManager?.setupSessionMonitoring();

// Session modal functions
window.closeSessionModal = () => {
    if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal();
    }
};

// Session action functions
window.saveSessionSettings = () => window.firebaseAuthManager?.saveSessionSettings();