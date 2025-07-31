// Module Initialization Checker and Fixer
class ModuleInitChecker {
    constructor() {
        this.checkInterval = null;
        this.maxAttempts = 50;
        this.attempts = 0;
    }

    startChecking() {
        console.log('Starting module initialization check...');
        this.checkInterval = setInterval(() => {
            this.checkAndInitModules();
            this.attempts++;
            
            if (this.attempts >= this.maxAttempts) {
                console.log('Stopping module check after max attempts');
                clearInterval(this.checkInterval);
            }
        }, 200);
    }

    checkAndInitModules() {
        let allInitialized = true;

        // Check banking module and card editor
        if (window.bankingModule && !window.cardEditor) {
            console.log('Initializing card editor...');
            try {
                window.cardEditor = new CardEditor(window.bankingModule);
                window.bankingModule.showCardEditor = (card) => window.cardEditor.showCardEditor(card);
                console.log('✅ Card editor initialized');
            } catch (error) {
                console.error('❌ Failed to initialize card editor:', error);
                allInitialized = false;
            }
        }

        // Check documents module and folder manager
        if (window.documentsModule && !window.documentsModule.folderManager) {
            console.log('Initializing documents folder manager...');
            try {
                window.documentsModule.folderManager = new DocumentsFolderManager(window.documentsModule);
                console.log('✅ Documents folder manager initialized');
            } catch (error) {
                console.error('❌ Failed to initialize documents folder manager:', error);
                allInitialized = false;
            }
        }

        // Check storage manager
        if (!window.storageManager) {
            console.log('Storage manager not found');
            allInitialized = false;
        }

        // Log current status
        if (this.attempts % 10 === 0) { // Log every 2 seconds
            console.log('Module status check:', {
                bankingModule: !!window.bankingModule,
                cardEditor: !!window.cardEditor,
                documentsModule: !!window.documentsModule,
                folderManager: !!(window.documentsModule && window.documentsModule.folderManager),
                storageManager: !!window.storageManager,
                authManager: !!(window.authManager || window.firebaseAuthManager || window.simpleAuthManager)
            });
        }

        // Stop checking if everything is initialized
        if (allInitialized && window.bankingModule && window.cardEditor && 
            window.documentsModule && window.documentsModule.folderManager) {
            console.log('✅ All modules successfully initialized!');
            clearInterval(this.checkInterval);
        }
    }

    // Manual initialization trigger
    forceInitialization() {
        console.log('🔧 Force initializing all modules...');
        
        // Force banking/card editor init
        if (window.bankingModule && !window.cardEditor) {
            try {
                window.cardEditor = new CardEditor(window.bankingModule);
                window.bankingModule.showCardEditor = (card) => window.cardEditor.showCardEditor(card);
                console.log('✅ Card editor force initialized');
            } catch (error) {
                console.error('❌ Card editor force init failed:', error);
            }
        }

        // Force documents/folder manager init
        if (window.documentsModule && !window.documentsModule.folderManager) {
            try {
                window.documentsModule.folderManager = new DocumentsFolderManager(window.documentsModule);
                console.log('✅ Documents folder manager force initialized');
            } catch (error) {
                console.error('❌ Documents folder manager force init failed:', error);
            }
        }

        // Check if auth manager exists
        if (!window.authManager && !window.firebaseAuthManager && !window.simpleAuthManager) {
            console.warn('⚠️ No auth manager found');
        }

        this.logCurrentStatus();
    }

    logCurrentStatus() {
        console.log('📊 Current Module Status:', {
            '🏦 Banking Module': !!window.bankingModule,
            '💳 Card Editor': !!window.cardEditor,
            '📁 Documents Module': !!window.documentsModule,
            '📂 Folder Manager': !!(window.documentsModule && window.documentsModule.folderManager),
            '💾 Storage Manager': !!window.storageManager,
            '🔐 Auth Manager': !!(window.authManager || window.firebaseAuthManager || window.simpleAuthManager),
            '📱 Main App': !!window.app
        });

        // Test function calls
        this.testFunctionality();
    }

    testFunctionality() {
        console.log('🧪 Testing module functionality...');
        
        // Test banking module
        if (window.bankingModule) {
            console.log('✅ Banking module available');
            if (typeof window.bankingModule.loadBankAccounts === 'function') {
                console.log('✅ Banking loadBankAccounts function available');
            } else {
                console.error('❌ Banking loadBankAccounts function missing');
            }
        } else {
            console.error('❌ Banking module not available');
        }

        // Test card editor
        if (window.cardEditor) {
            console.log('✅ Card editor available');
            if (typeof window.cardEditor.showCardEditor === 'function') {
                console.log('✅ Card editor showCardEditor function available');
            } else {
                console.error('❌ Card editor showCardEditor function missing');
            }
        } else {
            console.error('❌ Card editor not available');
        }

        // Test documents module
        if (window.documentsModule) {
            console.log('✅ Documents module available');
            if (window.documentsModule.folderManager) {
                console.log('✅ Documents folder manager available');
            } else {
                console.error('❌ Documents folder manager not available');
            }
        } else {
            console.error('❌ Documents module not available');
        }
    }
}

// Initialize the checker
const moduleChecker = new ModuleInitChecker();

// Start checking when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        moduleChecker.startChecking();
    }, 1000);
});

// Make available globally for debugging
window.moduleChecker = moduleChecker;

// Add helpful debug functions to console
window.debugModules = () => moduleChecker.logCurrentStatus();
window.fixModules = () => moduleChecker.forceInitialization();

console.log('🔧 Module initialization checker loaded. Use debugModules() or fixModules() for debugging.');