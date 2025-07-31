class BankingModule {
    constructor() {
        this.currentTab = 'accounts';
        this.cardNetworks = {
            'visa': { name: 'Visa', icon: 'fab fa-cc-visa', color: '#1A1F71' },
            'mastercard': { name: 'Mastercard', icon: 'fab fa-cc-mastercard', color: '#EB001B' },
            'amex': { name: 'American Express', icon: 'fab fa-cc-amex', color: '#006FCF' },
            'discover': { name: 'Discover', icon: 'fab fa-cc-discover', color: '#FF6000' },
            'diners': { name: 'Diners Club', icon: 'fab fa-cc-diners-club', color: '#0079BE' },
            'jcb': { name: 'JCB', icon: 'fab fa-cc-jcb', color: '#0E4C96' },
            'other': { name: 'Other', icon: 'fas fa-credit-card', color: '#6B7280' }
        };
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search functionality for accounts
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

        // Search functionality for cards
        const cardsSearchInput = document.getElementById('cardsSearch');
        if (cardsSearchInput) {
            let searchTimeout;
            cardsSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchCards(e.target.value);
                }, 300);
            });
        }

        // Filter functionality for cards
        const cardsFilter = document.getElementById('cardsFilter');
        if (cardsFilter) {
            cardsFilter.addEventListener('change', () => {
                this.filterCards();
            });
        }

        const cardsCategory = document.getElementById('cardsCategory');
        if (cardsCategory) {
            cardsCategory.addEventListener('change', () => {
                this.filterCards();
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

    // Tab Management
    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[onclick="bankingModule.switchTab('${tab}')"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.banking-tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`banking-${tab}`).classList.add('active');
        
        // Load appropriate data
        if (tab === 'accounts') {
            this.loadBankAccounts();
        } else if (tab === 'cards') {
            this.loadCards();
        }
    }

    // Card Management Functions
    async loadCards() {
        try {
            const cards = await storageManager.loadData('cards');
            const sortedCards = cards.sort((a, b) => 
                new Date(b.modified || b.created) - new Date(a.modified || a.created)
            );
            this.renderCards(sortedCards);
        } catch (error) {
            console.error('Error loading cards:', error);
            app.showToast('Error loading cards', 'error');
        }
    }

    async searchCards(query) {
        try {
            const cards = await storageManager.searchItems('cards', query, ['cardName', 'bank', 'cardType', 'notes']);
            this.renderCards(cards);
        } catch (error) {
            console.error('Error searching cards:', error);
        }
    }

    async filterCards() {
        try {
            const typeFilter = document.getElementById('cardsFilter').value;
            const categoryFilter = document.getElementById('cardsCategory').value;
            let cards = await storageManager.loadData('cards');
            
            if (typeFilter) {
                cards = cards.filter(card => card.cardType === typeFilter);
            }
            
            if (categoryFilter) {
                cards = cards.filter(card => card.category === categoryFilter);
            }
            
            this.renderCards(cards);
        } catch (error) {
            console.error('Error filtering cards:', error);
        }
    }

    renderCards(cards) {
        const container = document.getElementById('cardsList');
        
        if (cards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-credit-card fa-3x text-muted"></i>
                    <h3>No Cards Yet</h3>
                    <p>Add your first card to get started</p>
                    <button class="btn-primary" onclick="bankingModule.createCard()">
                        <i class="fas fa-plus"></i> Add Card
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = cards.map(card => this.renderCardItem(card)).join('');
    }

    renderCardItem(card) {
        const createdDate = new Date(card.created).toLocaleDateString();
        const timeAgo = this.getTimeAgo(new Date(card.modified || card.created));
        const network = this.cardNetworks[card.network] || this.cardNetworks.other;
        const maskedNumber = this.maskCardNumber(card.cardNumber);
        const expiryDate = card.expiryMonth && card.expiryYear ? 
            `${card.expiryMonth.padStart(2, '0')}/${card.expiryYear.slice(-2)}` : '';
        
        return `
            <div class="item-card card-item ${card.isPrimary ? 'primary-card' : ''}" data-id="${card.id}">
                <div class="item-header">
                    <div class="item-info">
                        <div class="item-title">
                            <i class="${network.icon}" style="color: ${network.color}"></i>
                            ${card.cardName}
                            ${card.isPrimary ? '<span class="primary-badge">Primary</span>' : ''}
                        </div>
                        <div class="item-meta">
                            ${card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1)} • ${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="item-action" onclick="bankingModule.copyCardNumber('${card.id}')" title="Copy Card Number">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="item-action" onclick="bankingModule.editCard('${card.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action" onclick="bankingModule.toggleCardStatus('${card.id}')" title="${card.isActive ? 'Deactivate' : 'Activate'}">
                            <i class="fas ${card.isActive ? 'fa-pause' : 'fa-play'}"></i>
                        </button>
                        <button class="item-action text-error" onclick="bankingModule.deleteCard('${card.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-details">
                    <div class="card-visual">
                        <div class="card-number">${maskedNumber}</div>
                        <div class="card-info-row">
                            <span class="cardholder-name">${card.cardholderName}</span>
                            ${expiryDate ? `<span class="expiry-date">${expiryDate}</span>` : ''}
                        </div>
                        <div class="card-bank">${card.bank}</div>
                    </div>
                    ${card.cardType === 'credit' && card.creditLimit ? `
                        <div class="credit-info">
                            <div class="credit-limit">
                                <span class="label">Credit Limit:</span>
                                <span class="value">$${parseFloat(card.creditLimit).toLocaleString()}</span>
                            </div>
                            ${card.availableCredit ? `
                                <div class="available-credit">
                                    <span class="label">Available:</span>
                                    <span class="value">$${parseFloat(card.availableCredit).toLocaleString()}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="card-status ${card.isActive ? 'active' : 'inactive'}">
                    <i class="fas ${card.isActive ? 'fa-check-circle' : 'fa-pause-circle'}"></i>
                    ${card.isActive ? 'Active' : 'Inactive'}
                </div>
                ${card.notes ? `
                    <div class="item-content">
                        <strong>Notes:</strong> ${card.notes}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Card CRUD Operations
    async createCard() {
        if (window.cardEditor) {
            window.cardEditor.showCardEditor();
        } else {
            console.error('Card editor not available');
            app.showToast('Card editor not available', 'error');
        }
    }

    async editCard(id) {
        try {
            const card = await storageManager.getItem('cards', id);
            if (card && window.cardEditor) {
                window.cardEditor.showCardEditor(card);
            } else if (!window.cardEditor) {
                console.error('Card editor not available');
                app.showToast('Card editor not available', 'error');
            }
        } catch (error) {
            console.error('Error loading card:', error);
            app.showToast('Error loading card', 'error');
        }
    }

    maskCardNumber(cardNumber) {
        if (!cardNumber) return '';
        const cleaned = cardNumber.replace(/\s/g, '');
        if (cleaned.length < 4) return cardNumber;
        return '**** **** **** ' + cleaned.slice(-4);
    }

    async copyCardNumber(id) {
        try {
            const card = await storageManager.getItem('cards', id);
            if (card && card.cardNumber) {
                const cleanNumber = card.cardNumber.replace(/\s/g, '');
                await navigator.clipboard.writeText(cleanNumber);
                app.showToast('Card number copied to clipboard', 'success');
            }
        } catch (error) {
            console.error('Error copying card number:', error);
            app.showToast('Error copying card number', 'error');
        }
    }

    async toggleCardStatus(id) {
        try {
            const card = await storageManager.getItem('cards', id);
            if (card) {
                card.isActive = !card.isActive;
                card.modified = new Date().toISOString();
                await storageManager.saveItem('cards', card);
                app.showToast(`Card ${card.isActive ? 'activated' : 'deactivated'}`, 'success');
                await this.loadCards();
            }
        } catch (error) {
            console.error('Error toggling card status:', error);
            app.showToast('Error updating card status', 'error');
        }
    }

    async deleteCard(id) {
        if (confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('cards', id);
                app.showToast('Card deleted successfully', 'success');
                await this.loadCards();
            } catch (error) {
                console.error('Error deleting card:', error);
                app.showToast('Error deleting card', 'error');
            }
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
window.createBankAccount = () => window.bankingModule.createBankAccount();

// Initialize banking module
window.bankingModule = new BankingModule();

// Additional CSS for banking module
const bankingStyles = `
/* Banking Tabs */
.banking-tabs {
    display: flex;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 1.5rem;
}

.tab-btn {
    background: none;
    border: none;
    padding: 1rem 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
}

.tab-btn.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
}

.banking-tab-content {
    display: none;
}

.banking-tab-content.active {
    display: block;
}

.header-actions {
    display: flex;
    gap: 0.5rem;
}

/* Card Styles */
.card-editor {
    width: 600px;
    max-width: 90vw;
}

.card-item {
    border-left: 4px solid var(--primary-color);
}

.card-item.primary-card {
    border-left-color: var(--warning-color);
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, transparent 100%);
}

.primary-badge {
    background: var(--warning-color);
    color: white;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    margin-left: 0.5rem;
}

.card-details {
    margin: 1rem 0;
    padding: 1rem;
    background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
    border-radius: 12px;
    color: white;
    position: relative;
    overflow: hidden;
}

.card-details::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    transform: rotate(45deg);
}

.card-visual {
    position: relative;
    z-index: 1;
}

.card-number {
    font-family: 'Courier New', monospace;
    font-size: 1.2rem;
    letter-spacing: 2px;
    margin-bottom: 1rem;
    font-weight: 600;
}

.card-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.cardholder-name {
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.expiry-date {
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
}

.card-bank {
    font-size: 0.8rem;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.credit-info {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: space-between;
}

.credit-limit,
.available-credit {
    text-align: center;
}

.credit-info .label {
    display: block;
    font-size: 0.7rem;
    opacity: 0.8;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.credit-info .value {
    font-size: 1rem;
    font-weight: 600;
    font-family: 'Courier New', monospace;
}

.card-status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
    margin: 1rem 0;
}

.card-status.active {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
}

.card-status.inactive {
    background: rgba(239, 68, 68, 0.1);
    color: var(--error-color);
}

.card-network-display {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.credit-card-fields {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: var(--border-radius);
    margin: 1rem 0;
    border-left: 3px solid var(--primary-color);
}

.form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

@media (max-width: 768px) {
    .banking-tabs {
        overflow-x: auto;
    }
    
    .tab-btn {
        min-width: 120px;
        justify-content: center;
    }
    
    .header-actions {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .card-info-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .credit-info {
        flex-direction: column;
        gap: 1rem;
    }
    
    .form-row {
        grid-template-columns: 1fr;
    }
}

`
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