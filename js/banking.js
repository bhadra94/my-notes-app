class BankingModule {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('bankingSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchBankAccounts(e.target.value);
                }, 300);
            });
        }
    }

    async loadBankAccounts() {
        try {
            const accounts = await storageManager.loadData('banking');
            const sortedAccounts = accounts.sort((a, b) => 
                new Date(b.modified || b.created) - new Date(a.modified || a.created)
            );
            this.renderBankAccounts(sortedAccounts);
        } catch (error) {
            console.error('Error loading bank accounts:', error);
            app.showToast('Error loading bank accounts', 'error');
        }
    }

    async searchBankAccounts(query) {
        try {
            const accounts = await storageManager.searchItems('banking', query, ['bankName', 'accountType', 'notes']);
            this.renderBankAccounts(accounts);
        } catch (error) {
            console.error('Error searching bank accounts:', error);
        }
    }

    renderBankAccounts(accounts) {
        const container = document.getElementById('bankingList');
        
        if (accounts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-university fa-3x text-muted"></i>
                    <h3>No Bank Accounts Yet</h3>
                    <p>Add your first bank account to get started</p>
                    <button class="btn-primary" onclick="createBankAccount()">
                        <i class="fas fa-plus"></i> Add Account
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = accounts.map(account => this.renderBankCard(account)).join('');
    }

    renderBankCard(account) {
        const createdDate = new Date(account.created).toLocaleDateString();
        const modifiedDate = new Date(account.modified || account.created).toLocaleDateString();
        const timeAgo = this.getTimeAgo(new Date(account.modified || account.created));
        
        // Mask sensitive information
        const maskedAccountNumber = cryptoManager.maskSensitiveData(account.accountNumber, 4);
        const maskedRoutingNumber = account.routingNumber ? 
            cryptoManager.maskSensitiveData(account.routingNumber, 4) : '';
        const maskedSwift = account.swiftCode ? 
            cryptoManager.maskSensitiveData(account.swiftCode, 4) : '';

        return `
            <div class="item-card bank-card" data-id="${account.id}">
                <div class="item-header">
                    <div class="item-info">
                        <div class="item-title">
                            <i class="fas fa-university"></i>
                            ${account.bankName}
                        </div>
                        <div class="item-meta">
                            ${account.accountType} • Modified: ${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="item-action" onclick="bankingModule.copyAccountNumber('${account.id}')" title="Copy Account Number">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="item-action" onclick="bankingModule.editBankAccount('${account.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action text-error" onclick="bankingModule.deleteBankAccount('${account.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="bank-details">
                    <div class="bank-detail-row">
                        <span class="detail-label">Account Number:</span>
                        <span class="detail-value masked" id="account-${account.id}">
                            ${maskedAccountNumber}
                            <button class="reveal-btn" onclick="bankingModule.toggleAccountVisibility('${account.id}', 'accountNumber')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </span>
                    </div>
                    ${account.routingNumber ? `
                        <div class="bank-detail-row">
                            <span class="detail-label">Routing Number:</span>
                            <span class="detail-value masked" id="routing-${account.id}">
                                ${maskedRoutingNumber}
                                <button class="reveal-btn" onclick="bankingModule.toggleAccountVisibility('${account.id}', 'routingNumber')">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </span>
                        </div>
                    ` : ''}
                    ${account.swiftCode ? `
                        <div class="bank-detail-row">
                            <span class="detail-label">SWIFT/IBAN:</span>
                            <span class="detail-value masked" id="swift-${account.id}">
                                ${maskedSwift}
                                <button class="reveal-btn" onclick="bankingModule.toggleAccountVisibility('${account.id}', 'swiftCode')">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </span>
                        </div>
                    ` : ''}
                </div>
                ${account.notes ? `
                    <div class="item-content">
                        <strong>Notes:</strong> ${account.notes}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async createBankAccount() {
        this.showBankAccountEditor();
    }

    async editBankAccount(id) {
        try {
            const account = await storageManager.getItem('banking', id);
            if (account) {
                this.showBankAccountEditor(account);
            }
        } catch (error) {
            console.error('Error loading bank account:', error);
            app.showToast('Error loading bank account', 'error');
        }
    }

    showBankAccountEditor(account = null) {
        const isEditing = account !== null;
        const bankName = account?.bankName || '';
        const accountNumber = account?.accountNumber || '';
        const routingNumber = account?.routingNumber || '';
        const accountType = account?.accountType || 'checking';
        const swiftCode = account?.swiftCode || '';
        const notes = account?.notes || '';
        
        const editorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-university"></i>
                    ${isEditing ? 'Edit Bank Account' : 'Add Bank Account'}
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="bank-editor">
                <div class="form-group">
                    <label class="form-label">Bank Name *</label>
                    <input type="text" id="bankName" class="form-input" value="${bankName}" placeholder="Enter bank name..." required />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Account Type *</label>
                    <select id="accountType" class="form-select" required>
                        <option value="checking" ${accountType === 'checking' ? 'selected' : ''}>Checking</option>
                        <option value="savings" ${accountType === 'savings' ? 'selected' : ''}>Savings</option>
                        <option value="credit" ${accountType === 'credit' ? 'selected' : ''}>Credit Card</option>
                        <option value="loan" ${accountType === 'loan' ? 'selected' : ''}>Loan</option>
                        <option value="investment" ${accountType === 'investment' ? 'selected' : ''}>Investment</option>
                        <option value="other" ${accountType === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Account Number *</label>
                    <div class="input-with-actions">
                        <input type="text" id="accountNumber" class="form-input" value="${accountNumber}" placeholder="Enter account number..." required />
                        <button type="button" class="btn-secondary" onclick="bankingModule.generateAccountNumber()">
                            <i class="fas fa-random"></i> Generate
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Routing Number</label>
                    <input type="text" id="routingNumber" class="form-input" value="${routingNumber}" placeholder="Enter routing number..." />
                </div>
                
                <div class="form-group">
                    <label class="form-label">SWIFT/IBAN Code</label>
                    <input type="text" id="swiftCode" class="form-input" value="${swiftCode}" placeholder="Enter SWIFT or IBAN code..." />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea id="bankNotes" class="form-textarea" placeholder="Additional notes about this account...">${notes}</textarea>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="bankingModule.saveBankAccount('${account?.id || ''}')">
                        <i class="fas fa-save"></i> Save Account
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(editorHtml);
        document.getElementById('bankName').focus();
    }

    async saveBankAccount(id = '') {
        try {
            const bankName = document.getElementById('bankName').value.trim();
            const accountNumber = document.getElementById('accountNumber').value.trim();
            const routingNumber = document.getElementById('routingNumber').value.trim();
            const accountType = document.getElementById('accountType').value;
            const swiftCode = document.getElementById('swiftCode').value.trim();
            const notes = document.getElementById('bankNotes').value.trim();
            
            if (!bankName || !accountNumber) {
                app.showToast('Please fill in all required fields', 'warning');
                return;
            }
            
            const accountData = {
                bankName,
                accountNumber,
                routingNumber,
                accountType,
                swiftCode,
                notes
            };
            
            if (id) {
                accountData.id = id;
            }
            
            await storageManager.saveItem('banking', accountData);
            
            app.closeModal();
            app.showToast('Bank account saved successfully', 'success');
            await this.loadBankAccounts();
            
        } catch (error) {
            console.error('Error saving bank account:', error);
            app.showToast('Error saving bank account', 'error');
        }
    }

    async deleteBankAccount(id) {
        if (confirm('Are you sure you want to delete this bank account? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('banking', id);
                app.showToast('Bank account deleted successfully', 'success');
                await this.loadBankAccounts();
            } catch (error) {
                console.error('Error deleting bank account:', error);
                app.showToast('Error deleting bank account', 'error');
            }
        }
    }

    async copyAccountNumber(id) {
        try {
            const account = await storageManager.getItem('banking', id);
            if (account && account.accountNumber) {
                await navigator.clipboard.writeText(account.accountNumber);
                app.showToast('Account number copied to clipboard', 'success');
            }
        } catch (error) {
            console.error('Error copying account number:', error);
            app.showToast('Error copying account number', 'error');
        }
    }

    async toggleAccountVisibility(id, field) {
        try {
            const account = await storageManager.getItem('banking', id);
            if (!account) return;
            
            const elementId = field === 'accountNumber' ? `account-${id}` : 
                            field === 'routingNumber' ? `routing-${id}` : `swift-${id}`;
            const element = document.getElementById(elementId);
            const button = element.querySelector('.reveal-btn i');
            
            if (element.classList.contains('revealed')) {
                // Hide the value
                const maskedValue = cryptoManager.maskSensitiveData(account[field], 4);
                element.innerHTML = `
                    ${maskedValue}
                    <button class="reveal-btn" onclick="bankingModule.toggleAccountVisibility('${id}', '${field}')">
                        <i class="fas fa-eye"></i>
                    </button>
                `;
                element.classList.remove('revealed');
            } else {
                // Show the value
                element.innerHTML = `
                    ${account[field]}
                    <button class="reveal-btn" onclick="bankingModule.toggleAccountVisibility('${id}', '${field}')">
                        <i class="fas fa-eye-slash"></i>
                    </button>
                    <button class="copy-btn" onclick="bankingModule.copyFieldValue('${account[field]}')" title="Copy">
                        <i class="fas fa-copy"></i>
                    </button>
                `;
                element.classList.add('revealed');
            }
        } catch (error) {
            console.error('Error toggling visibility:', error);
        }
    }

    async copyFieldValue(value) {
        try {
            await navigator.clipboard.writeText(value);
            app.showToast('Copied to clipboard', 'success');
        } catch (error) {
            console.error('Error copying value:', error);
            app.showToast('Error copying value', 'error');
        }
    }

    generateAccountNumber() {
        // Generate a random account number (for demo purposes)
        const accountNumber = Math.floor(Math.random() * 9000000000) + 1000000000;
        document.getElementById('accountNumber').value = accountNumber.toString();
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
window.createBankAccount = () => window.bankingModule.createBankAccount();

// Initialize banking module
window.bankingModule = new BankingModule();

// Additional CSS for banking module
const bankingStyles = `
.bank-editor {
    width: 500px;
    max-width: 90vw;
}

.bank-details {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius);
}

.bank-detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
}

.bank-detail-row:last-child {
    margin-bottom: 0;
    border-bottom: none;
}

.detail-label {
    font-weight: 500;
    color: var(--text-secondary);
    min-width: 120px;
}

.detail-value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'Courier New', monospace;
    color: var(--text-primary);
}

.detail-value.revealed {
    background: rgba(37, 99, 235, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.reveal-btn,
.copy-btn {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 0.8rem;
    transition: all 0.3s ease;
}

.reveal-btn:hover,
.copy-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
}

.copy-btn {
    background: var(--success-color);
    color: white;
    border-color: var(--success-color);
}

.copy-btn:hover {
    background: #059669;
}

.input-with-actions {
    display: flex;
    gap: 0.5rem;
}

.input-with-actions .form-input {
    flex: 1;
}

.bank-card {
    border-left: 4px solid var(--primary-color);
}

.bank-card .item-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.bank-card .item-title i {
    color: var(--primary-color);
}

.masked {
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
}

@media (max-width: 768px) {
    .bank-detail-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .detail-label {
        min-width: unset;
        font-size: 0.9rem;
    }
    
    .input-with-actions {
        flex-direction: column;
    }
}
`;

// Add banking styles to head
const bankingStyleSheet = document.createElement('style');
bankingStyleSheet.textContent = bankingStyles;
document.head.appendChild(bankingStyleSheet);