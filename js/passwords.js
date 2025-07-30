class PasswordsModule {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('passwordsSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchPasswords(e.target.value);
                }, 300);
            });
        }

        // Category filter
        const categorySelect = document.getElementById('passwordsCategory');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                this.filterByCategory();
            });
        }
    }

    async loadPasswords() {
        try {
            const passwords = await storageManager.loadData('passwords');
            const sortedPasswords = passwords.sort((a, b) => 
                new Date(b.modified || b.created) - new Date(a.modified || a.created)
            );
            this.renderPasswords(sortedPasswords);
        } catch (error) {
            console.error('Error loading passwords:', error);
            app.showToast('Error loading passwords', 'error');
        }
    }

    async searchPasswords(query) {
        try {
            const passwords = await storageManager.searchItems('passwords', query, ['website', 'username', 'notes']);
            this.renderPasswords(passwords);
        } catch (error) {
            console.error('Error searching passwords:', error);
        }
    }

    async filterByCategory() {
        try {
            const category = document.getElementById('passwordsCategory').value;
            const passwords = await storageManager.loadData('passwords');
            
            const filtered = category ? 
                passwords.filter(pwd => pwd.category === category) : 
                passwords;
            
            this.renderPasswords(filtered);
        } catch (error) {
            console.error('Error filtering passwords:', error);
        }
    }

    renderPasswords(passwords) {
        const container = document.getElementById('passwordsList');
        
        if (passwords.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-key fa-3x text-muted"></i>
                    <h3>No Passwords Yet</h3>
                    <p>Add your first password to get started</p>
                    <button class="btn-primary" onclick="createPassword()">
                        <i class="fas fa-plus"></i> Add Password
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = passwords.map(password => this.renderPasswordCard(password)).join('');
    }

    renderPasswordCard(password) {
        const createdDate = new Date(password.created).toLocaleDateString();
        const timeAgo = this.getTimeAgo(new Date(password.modified || password.created));
        
        const categoryColors = {
            work: '#10b981',
            personal: '#3b82f6',
            financial: '#f59e0b',
            shopping: '#8b5cf6'
        };
        
        const categoryColor = categoryColors[password.category] || '#64748b';
        
        // Calculate password strength
        const strength = cryptoManager.calculatePasswordStrength(password.password || '');
        const strengthClass = strength.strength;
        const strengthColor = strengthClass === 'strong' ? '#10b981' : 
                            strengthClass === 'medium' ? '#f59e0b' : '#ef4444';

        return `
            <div class="item-card password-card" data-id="${password.id}">
                <div class="item-header">
                    <div class="item-info">
                        <div class="item-title">
                            <i class="fas fa-globe"></i>
                            ${password.website || 'Untitled'}
                        </div>
                        <div class="item-meta">
                            ${password.username ? `${password.username} • ` : ''}${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="item-action" onclick="passwordsModule.copyUsername('${password.id}')" title="Copy Username">
                            <i class="fas fa-user"></i>
                        </button>
                        <button class="item-action" onclick="passwordsModule.copyPassword('${password.id}')" title="Copy Password">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="item-action" onclick="passwordsModule.openWebsite('${password.url || ''}')" title="Open Website">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                        <button class="item-action" onclick="passwordsModule.editPassword('${password.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action text-error" onclick="passwordsModule.deletePassword('${password.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="password-details">
                    <div class="password-field">
                        <span class="field-label">Username:</span>
                        <span class="field-value">${password.username || 'Not set'}</span>
                    </div>
                    
                    <div class="password-field">
                        <span class="field-label">Password:</span>
                        <span class="field-value password-value" id="pwd-${password.id}">
                            ••••••••••••
                            <button class="reveal-btn" onclick="passwordsModule.togglePasswordVisibility('${password.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </span>
                    </div>
                    
                    <div class="password-strength">
                        <span class="field-label">Strength:</span>
                        <div class="strength-indicator">
                            <div class="strength-bar">
                                <div class="strength-fill" style="width: ${strength.percentage}%; background-color: ${strengthColor};"></div>
                            </div>
                            <span class="strength-text" style="color: ${strengthColor};">
                                ${strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="password-meta">
                    ${password.category ? `
                        <span class="category-tag" style="background-color: ${categoryColor};">
                            ${password.category.charAt(0).toUpperCase() + password.category.slice(1)}
                        </span>
                    ` : ''}
                    
                    ${password.url ? `
                        <a href="${password.url}" target="_blank" class="website-link">
                            ${new URL(password.url).hostname}
                        </a>
                    ` : ''}
                </div>
                
                ${password.notes ? `
                    <div class="item-content">
                        <strong>Notes:</strong> ${password.notes}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async createPassword() {
        this.showPasswordEditor();
    }

    async editPassword(id) {
        try {
            const password = await storageManager.getItem('passwords', id);
            if (password) {
                this.showPasswordEditor(password);
            }
        } catch (error) {
            console.error('Error loading password:', error);
            app.showToast('Error loading password', 'error');
        }
    }

    showPasswordEditor(password = null) {
        const isEditing = password !== null;
        const website = password?.website || '';
        const username = password?.username || '';
        const passwordValue = password?.password || '';
        const url = password?.url || '';
        const category = password?.category || '';
        const notes = password?.notes || '';
        
        const editorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-key"></i>
                    ${isEditing ? 'Edit Password' : 'Add Password'}
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="password-editor">
                <div class="form-group">
                    <label class="form-label">Website/App Name *</label>
                    <input type="text" id="passwordWebsite" class="form-input" value="${website}" placeholder="Enter website or app name..." required />
                </div>
                
                <div class="form-group">
                    <label class="form-label">URL</label>
                    <input type="url" id="passwordUrl" class="form-input" value="${url}" placeholder="https://example.com" />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Username/Email</label>
                    <input type="text" id="passwordUsername" class="form-input" value="${username}" placeholder="Enter username or email..." />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Password *</label>
                    <div class="password-input-group">
                        <input type="password" id="passwordValue" class="form-input" value="${passwordValue}" placeholder="Enter password..." required />
                        <button type="button" class="btn-secondary" onclick="passwordsModule.togglePasswordInputVisibility()">
                            <i class="fas fa-eye" id="passwordToggleIcon"></i>
                        </button>
                        <button type="button" class="btn-secondary" onclick="passwordsModule.showPasswordGenerator()">
                            <i class="fas fa-random"></i> Generate
                        </button>
                    </div>
                    <div class="password-strength" id="editorPasswordStrength" style="display: none;">
                        <div class="strength-bar">
                            <div class="strength-fill"></div>
                        </div>
                        <div class="strength-text"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select id="passwordCategory" class="form-select">
                        <option value="">Select category</option>
                        <option value="work" ${category === 'work' ? 'selected' : ''}>Work</option>
                        <option value="personal" ${category === 'personal' ? 'selected' : ''}>Personal</option>
                        <option value="financial" ${category === 'financial' ? 'selected' : ''}>Financial</option>
                        <option value="shopping" ${category === 'shopping' ? 'selected' : ''}>Shopping</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea id="passwordNotes" class="form-textarea" placeholder="Additional notes...">${notes}</textarea>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="passwordsModule.savePassword('${password?.id || ''}')">
                        <i class="fas fa-save"></i> Save Password
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(editorHtml);
        
        // Setup password strength indicator
        const passwordInput = document.getElementById('passwordValue');
        passwordInput.addEventListener('input', (e) => {
            app.updatePasswordStrength(e.target.value, 'editorPasswordStrength');
        });
        
        // Initial strength check
        if (passwordValue) {
            app.updatePasswordStrength(passwordValue, 'editorPasswordStrength');
        }
        
        document.getElementById('passwordWebsite').focus();
    }

    showPasswordGenerator() {
        const generatorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-random"></i>
                    Password Generator
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="password-generator">
                <div class="generator-options">
                    <div class="option-group">
                        <label class="form-label">Length: <span id="lengthValue">16</span></label>
                        <input type="range" id="passwordLength" min="8" max="50" value="16" class="range-input" />
                    </div>
                    
                    <div class="option-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="includeUppercase" checked />
                            <span class="checkmark"></span>
                            Uppercase letters (A-Z)
                        </label>
                    </div>
                    
                    <div class="option-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="includeLowercase" checked />
                            <span class="checkmark"></span>
                            Lowercase letters (a-z)
                        </label>
                    </div>
                    
                    <div class="option-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="includeNumbers" checked />
                            <span class="checkmark"></span>
                            Numbers (0-9)
                        </label>
                    </div>
                    
                    <div class="option-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="includeSymbols" checked />
                            <span class="checkmark"></span>
                            Symbols (!@#$%^&*)
                        </label>
                    </div>
                </div>
                
                <div class="generated-password-container">
                    <label class="form-label">Generated Password</label>
                    <div class="generated-password-group">
                        <input type="text" id="generatedPassword" class="form-input" readonly />
                        <button type="button" class="btn-secondary" onclick="passwordsModule.copyGeneratedPassword()">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button type="button" class="btn-secondary" onclick="passwordsModule.generateNewPassword()">
                            <i class="fas fa-sync"></i>
                        </button>
                    </div>
                    <div class="password-strength" id="generatorPasswordStrength">
                        <div class="strength-bar">
                            <div class="strength-fill"></div>
                        </div>
                        <div class="strength-text"></div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="passwordsModule.useGeneratedPassword()">
                        <i class="fas fa-check"></i> Use This Password
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(generatorHtml);
        
        // Setup event listeners
        document.getElementById('passwordLength').addEventListener('input', (e) => {
            document.getElementById('lengthValue').textContent = e.target.value;
            this.generateNewPassword();
        });
        
        ['includeUppercase', 'includeLowercase', 'includeNumbers', 'includeSymbols'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.generateNewPassword();
            });
        });
        
        // Generate initial password
        this.generateNewPassword();
    }

    generateNewPassword() {
        const length = parseInt(document.getElementById('passwordLength').value);
        const includeUppercase = document.getElementById('includeUppercase').checked;
        const includeLowercase = document.getElementById('includeLowercase').checked;
        const includeNumbers = document.getElementById('includeNumbers').checked;
        const includeSymbols = document.getElementById('includeSymbols').checked;
        
        try {
            const password = cryptoManager.generatePassword(
                length, 
                includeSymbols, 
                includeNumbers, 
                includeUppercase, 
                includeLowercase
            );
            
            document.getElementById('generatedPassword').value = password;
            app.updatePasswordStrength(password, 'generatorPasswordStrength');
        } catch (error) {
            app.showToast(error.message, 'error');
        }
    }

    async copyGeneratedPassword() {
        const password = document.getElementById('generatedPassword').value;
        if (password) {
            try {
                await navigator.clipboard.writeText(password);
                app.showToast('Password copied to clipboard', 'success');
            } catch (error) {
                app.showToast('Error copying password', 'error');
            }
        }
    }

    useGeneratedPassword() {
        const password = document.getElementById('generatedPassword').value;
        if (password) {
            // Close generator modal and set password in editor
            app.closeModal();
            
            // Re-show the password editor with the generated password
            setTimeout(() => {
                const passwordInput = document.getElementById('passwordValue');
                if (passwordInput) {
                    passwordInput.value = password;
                    app.updatePasswordStrength(password, 'editorPasswordStrength');
                }
            }, 100);
        }
    }

    togglePasswordInputVisibility() {
        const input = document.getElementById('passwordValue');
        const icon = document.getElementById('passwordToggleIcon');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    async savePassword(id = '') {
        try {
            const website = document.getElementById('passwordWebsite').value.trim();
            const username = document.getElementById('passwordUsername').value.trim();
            const passwordValue = document.getElementById('passwordValue').value.trim();
            const url = document.getElementById('passwordUrl').value.trim();
            const category = document.getElementById('passwordCategory').value;
            const notes = document.getElementById('passwordNotes').value.trim();
            
            if (!website || !passwordValue) {
                app.showToast('Please fill in website name and password', 'warning');
                return;
            }
            
            const passwordData = {
                website,
                username,
                password: passwordValue,
                url,
                category,
                notes
            };
            
            if (id) {
                passwordData.id = id;
            }
            
            await storageManager.saveItem('passwords', passwordData);
            
            app.closeModal();
            app.showToast('Password saved successfully', 'success');
            await this.loadPasswords();
            
        } catch (error) {
            console.error('Error saving password:', error);
            app.showToast('Error saving password', 'error');
        }
    }

    async deletePassword(id) {
        if (confirm('Are you sure you want to delete this password? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('passwords', id);
                app.showToast('Password deleted successfully', 'success');
                await this.loadPasswords();
            } catch (error) {
                console.error('Error deleting password:', error);
                app.showToast('Error deleting password', 'error');
            }
        }
    }

    async copyUsername(id) {
        try {
            const password = await storageManager.getItem('passwords', id);
            if (password && password.username) {
                await navigator.clipboard.writeText(password.username);
                app.showToast('Username copied to clipboard', 'success');
            } else {
                app.showToast('No username to copy', 'warning');
            }
        } catch (error) {
            console.error('Error copying username:', error);
            app.showToast('Error copying username', 'error');
        }
    }

    async copyPassword(id) {
        try {
            const password = await storageManager.getItem('passwords', id);
            if (password && password.password) {
                await navigator.clipboard.writeText(password.password);
                app.showToast('Password copied to clipboard', 'success');
            }
        } catch (error) {
            console.error('Error copying password:', error);
            app.showToast('Error copying password', 'error');
        }
    }

    openWebsite(url) {
        if (url) {
            window.open(url, '_blank');
        } else {
            app.showToast('No URL specified', 'warning');
        }
    }

    async togglePasswordVisibility(id) {
        try {
            const password = await storageManager.getItem('passwords', id);
            if (!password) return;
            
            const element = document.getElementById(`pwd-${id}`);
            const button = element.querySelector('.reveal-btn i');
            
            if (element.classList.contains('revealed')) {
                // Hide the password
                element.innerHTML = `
                    ••••••••••••
                    <button class="reveal-btn" onclick="passwordsModule.togglePasswordVisibility('${id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                `;
                element.classList.remove('revealed');
            } else {
                // Show the password
                element.innerHTML = `
                    <span class="revealed-password">${password.password}</span>
                    <button class="reveal-btn" onclick="passwordsModule.togglePasswordVisibility('${id}')">
                        <i class="fas fa-eye-slash"></i>
                    </button>
                    <button class="copy-btn" onclick="passwordsModule.copyPassword('${id}')" title="Copy">
                        <i class="fas fa-copy"></i>
                    </button>
                `;
                element.classList.add('revealed');
            }
        } catch (error) {
            console.error('Error toggling password visibility:', error);
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return date.toLocaleDateString();
    }
}

// Global functions for HTML onclick handlers
window.createPassword = () => window.passwordsModule.createPassword();

// Initialize passwords module
window.passwordsModule = new PasswordsModule();

// Additional CSS for passwords module
const passwordsStyles = `
.password-editor {
    width: 600px;
    max-width: 90vw;
}

.password-generator {
    width: 500px;
    max-width: 90vw;
}

.password-input-group {
    display: flex;
    gap: 0.5rem;
}

.password-input-group .form-input {
    flex: 1;
}

.password-details {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius);
}

.password-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
}

.password-field:last-child {
    margin-bottom: 0;
    border-bottom: none;
}

.field-label {
    font-weight: 500;
    color: var(--text-secondary);
    min-width: 80px;
}

.field-value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'Courier New', monospace;
    color: var(--text-primary);
}

.password-value {
    letter-spacing: 2px;
}

.password-value.revealed {
    background: rgba(37, 99, 235, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.revealed-password {
    background: rgba(37, 99, 235, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
}

.password-strength {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.strength-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
}

.strength-bar {
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    overflow: hidden;
    flex: 1;
    max-width: 100px;
}

.strength-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-text {
    font-size: 0.8rem;
    font-weight: 500;
    min-width: 60px;
}

.password-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

.category-tag {
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.website-link {
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.9rem;
}

.website-link:hover {
    text-decoration: underline;
}

.password-card {
    border-left: 4px solid var(--primary-color);
}

.password-card .item-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.password-card .item-title i {
    color: var(--primary-color);
}

.generator-options {
    margin-bottom: 2rem;
}

.option-group {
    margin-bottom: 1rem;
}

.range-input {
    width: 100%;
    margin-top: 0.5rem;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
}

.checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
}

.generated-password-container {
    margin-bottom: 2rem;
}

.generated-password-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.generated-password-group .form-input {
    flex: 1;
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    font-weight: bold;
    background: var(--bg-tertiary);
}

.copy-btn {
    background: var(--success-color);
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background-color 0.3s ease;
}

.copy-btn:hover {
    background: #059669;
}

@media (max-width: 768px) {
    .password-field {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .field-label {
        min-width: unset;
        font-size: 0.9rem;
    }
    
    .password-input-group {
        flex-direction: column;
    }
    
    .generated-password-group {
        flex-direction: column;
    }
    
    .password-meta {
        flex-direction: column;
        align-items: flex-start;
    }
}
`;

// Add passwords styles to head
const passwordsStyleSheet = document.createElement('style');
passwordsStyleSheet.textContent = passwordsStyles;
document.head.appendChild(passwordsStyleSheet);