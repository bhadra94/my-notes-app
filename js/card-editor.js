// Card Editor Extension for Banking Module
class CardEditor {
    constructor(bankingModule) {
        this.bankingModule = bankingModule;
    }

    showCardEditor(card = null) {
        const isEditing = card !== null;
        const cardData = card || {
            cardName: '',
            cardNumber: '',
            expiryMonth: '',
            expiryYear: '',
            cvv: '',
            cardholderName: '',
            bank: '',
            cardType: 'credit',
            network: 'visa',
            category: 'personal',
            creditLimit: '',
            availableCredit: '',
            billingAddress: '',
            notes: '',
            isActive: true,
            isPrimary: false
        };
        
        const currentYear = new Date().getFullYear();
        const years = Array.from({length: 15}, (_, i) => currentYear + i);
        const months = Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0'));
        
        const editorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-credit-card"></i>
                    ${isEditing ? 'Edit Card' : 'Add New Card'}
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="card-editor">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Card Name *</label>
                        <input type="text" id="cardName" class="form-input" value="${cardData.cardName}" placeholder="e.g., Chase Freedom, Amex Gold" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Card Type *</label>
                        <select id="cardType" class="form-select" required>
                            <option value="credit" ${cardData.cardType === 'credit' ? 'selected' : ''}>Credit Card</option>
                            <option value="debit" ${cardData.cardType === 'debit' ? 'selected' : ''}>Debit Card</option>
                            <option value="prepaid" ${cardData.cardType === 'prepaid' ? 'selected' : ''}>Prepaid Card</option>
                            <option value="gift" ${cardData.cardType === 'gift' ? 'selected' : ''}>Gift Card</option>
                            <option value="store" ${cardData.cardType === 'store' ? 'selected' : ''}>Store Card</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Card Number *</label>
                    <input type="text" id="cardNumber" class="form-input" value="${cardData.cardNumber}" placeholder="1234 5678 9012 3456" maxlength="19" required />
                    <div class="card-network-display" id="cardNetworkDisplay"></div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Expiry Month *</label>
                        <select id="expiryMonth" class="form-select" required>
                            <option value="">Month</option>
                            ${months.map(month => `<option value="${month}" ${cardData.expiryMonth === month ? 'selected' : ''}>${month}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Expiry Year *</label>
                        <select id="expiryYear" class="form-select" required>
                            <option value="">Year</option>
                            ${years.map(year => `<option value="${year}" ${cardData.expiryYear === year.toString() ? 'selected' : ''}>${year}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">CVV *</label>
                        <input type="text" id="cvv" class="form-input" value="${cardData.cvv}" placeholder="123" maxlength="4" required />
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Cardholder Name *</label>
                    <input type="text" id="cardholderName" class="form-input" value="${cardData.cardholderName}" placeholder="John Doe" required />
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Bank/Issuer *</label>
                        <input type="text" id="bank" class="form-input" value="${cardData.bank}" placeholder="Chase, Bank of America, etc." required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select id="category" class="form-select">
                            <option value="personal" ${cardData.category === 'personal' ? 'selected' : ''}>Personal</option>
                            <option value="business" ${cardData.category === 'business' ? 'selected' : ''}>Business</option>
                            <option value="family" ${cardData.category === 'family' ? 'selected' : ''}>Family</option>
                        </select>
                    </div>
                </div>
                
                <div id="creditCardFields" class="credit-card-fields" style="display: ${cardData.cardType === 'credit' ? 'block' : 'none'}">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Credit Limit</label>
                            <input type="number" id="creditLimit" class="form-input" value="${cardData.creditLimit}" placeholder="10000" step="0.01" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Available Credit</label>
                            <input type="number" id="availableCredit" class="form-input" value="${cardData.availableCredit}" placeholder="9500" step="0.01" />
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Billing Address</label>
                    <textarea id="billingAddress" class="form-textarea" placeholder="123 Main St, City, State 12345">${cardData.billingAddress}</textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea id="cardNotes" class="form-textarea" placeholder="Additional notes about this card...">${cardData.notes}</textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="checkbox-container">
                            <input type="checkbox" id="isActive" ${cardData.isActive ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Active Card
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-container">
                            <input type="checkbox" id="isPrimary" ${cardData.isPrimary ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Primary Card
                        </label>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="cardEditor.saveCard('${card?.id || ''}')">
                        <i class="fas fa-save"></i> Save Card
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(editorHtml);
        this.setupCardEditorListeners();
        document.getElementById('cardName').focus();
    }

    setupCardEditorListeners() {
        // Card number formatting and network detection
        const cardNumberInput = document.getElementById('cardNumber');
        cardNumberInput.addEventListener('input', (e) => {
            const formatted = this.formatCardNumber(e.target.value);
            e.target.value = formatted;
            this.detectCardNetwork(formatted);
        });
        
        // Card type change handler
        const cardTypeSelect = document.getElementById('cardType');
        cardTypeSelect.addEventListener('change', (e) => {
            const creditFields = document.getElementById('creditCardFields');
            creditFields.style.display = e.target.value === 'credit' ? 'block' : 'none';
        });
        
        // CVV validation
        const cvvInput = document.getElementById('cvv');
        cvvInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    formatCardNumber(value) {
        // Remove all non-digits
        const cleaned = value.replace(/\D/g, '');
        // Add spaces every 4 digits
        return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    }

    detectCardNetwork(cardNumber) {
        const cleaned = cardNumber.replace(/\s/g, '');
        let network = 'other';
        
        if (/^4/.test(cleaned)) {
            network = 'visa';
        } else if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) {
            network = 'mastercard';
        } else if (/^3[47]/.test(cleaned)) {
            network = 'amex';
        } else if (/^6(?:011|5)/.test(cleaned)) {
            network = 'discover';
        } else if (/^3[0689]/.test(cleaned)) {
            network = 'diners';
        } else if (/^35/.test(cleaned)) {
            network = 'jcb';
        }
        
        const networkInfo = this.bankingModule.cardNetworks[network];
        const display = document.getElementById('cardNetworkDisplay');
        if (display && cleaned.length >= 4) {
            display.innerHTML = `<i class="${networkInfo.icon}" style="color: ${networkInfo.color}"></i> ${networkInfo.name}`;
        } else if (display) {
            display.innerHTML = '';
        }
        
        return network;
    }

    validateCardNumber(cardNumber) {
        const cleaned = cardNumber.replace(/\s/g, '');
        if (cleaned.length < 13 || cleaned.length > 19) return false;
        
        // Luhn algorithm
        let sum = 0;
        let isEven = false;
        
        for (let i = cleaned.length - 1; i >= 0; i--) {
            let digit = parseInt(cleaned[i]);
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        return sum % 10 === 0;
    }

    async saveCard(id = '') {
        try {
            const cardName = document.getElementById('cardName').value.trim();
            const cardNumber = document.getElementById('cardNumber').value.trim();
            const expiryMonth = document.getElementById('expiryMonth').value;
            const expiryYear = document.getElementById('expiryYear').value;
            const cvv = document.getElementById('cvv').value.trim();
            const cardholderName = document.getElementById('cardholderName').value.trim();
            const bank = document.getElementById('bank').value.trim();
            const cardType = document.getElementById('cardType').value;
            const category = document.getElementById('category').value;
            const creditLimit = document.getElementById('creditLimit').value;
            const availableCredit = document.getElementById('availableCredit').value;
            const billingAddress = document.getElementById('billingAddress').value.trim();
            const notes = document.getElementById('cardNotes').value.trim();
            const isActive = document.getElementById('isActive').checked;
            const isPrimary = document.getElementById('isPrimary').checked;
            
            // Validation
            if (!cardName || !cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName || !bank) {
                app.showToast('Please fill in all required fields', 'warning');
                return;
            }
            
            if (!this.validateCardNumber(cardNumber)) {
                app.showToast('Please enter a valid card number', 'error');
                return;
            }
            
            const network = this.detectCardNetwork(cardNumber);
            
            const cardData = {
                cardName,
                cardNumber,
                expiryMonth,
                expiryYear,
                cvv,
                cardholderName,
                bank,
                cardType,
                network,
                category,
                creditLimit: creditLimit ? parseFloat(creditLimit) : null,
                availableCredit: availableCredit ? parseFloat(availableCredit) : null,
                billingAddress,
                notes,
                isActive,
                isPrimary
            };
            
            if (id) {
                cardData.id = id;
            }
            
            // If this card is being set as primary, unset all other primary cards
            if (isPrimary) {
                const allCards = await storageManager.loadData('cards');
                for (const existingCard of allCards) {
                    if (existingCard.id !== id && existingCard.isPrimary) {
                        existingCard.isPrimary = false;
                        await storageManager.saveItem('cards', existingCard);
                    }
                }
            }
            
            await storageManager.saveItem('cards', cardData);
            
            app.closeModal();
            app.showToast('Card saved successfully', 'success');
            await this.bankingModule.loadCards();
            
        } catch (error) {
            console.error('Error saving card:', error);
            app.showToast('Error saving card', 'error');
        }
    }
}

// Initialize card editor when banking module is ready
const initializeCardEditor = () => {
    if (window.bankingModule) {
        window.cardEditor = new CardEditor(window.bankingModule);
        window.bankingModule.showCardEditor = (card) => window.cardEditor.showCardEditor(card);
        console.log('Card editor initialized');
    } else {
        // Wait for banking module to be available
        setTimeout(initializeCardEditor, 100);
    }
};

// Initialize on DOM ready and window load
document.addEventListener('DOMContentLoaded', initializeCardEditor);
window.addEventListener('load', () => {
    if (!window.cardEditor && window.bankingModule) {
        initializeCardEditor();
    }
});