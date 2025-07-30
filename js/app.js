class NotesApp {
    constructor() {
        this.currentModule = 'dashboard';
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        this.setupEventListeners();
        this.setupTheme();
        
        if (storageManager.hasMasterPassword()) {
            this.showLockScreen();
        } else {
            this.showSetupScreen();
        }
        
        this.initialized = true;
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const module = e.currentTarget.dataset.module;
                this.switchModule(module);
            });
        });

        // Dashboard cards
        document.querySelectorAll('.dashboard-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const module = e.currentTarget.dataset.module;
                if (module) {
                    this.switchModule(module);
                }
            });
        });

        // Global search
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            let searchTimeout;
            globalSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.performGlobalSearch(e.target.value);
                }, 300);
            });
        }

        // Modal overlay click to close
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Master password input
        const masterPasswordInput = document.getElementById('masterPassword');
        if (masterPasswordInput) {
            masterPasswordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.unlockApp();
                }
            });
        }
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.querySelector('.theme-toggle i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    showLockScreen() {
        document.getElementById('lockScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('masterPassword').focus();
    }

    showSetupScreen() {
        const setupHtml = `
            <div class="lock-container">
                <h1><i class="fas fa-shield-alt"></i> Welcome to My Notes App</h1>
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                    Set up a master password to secure your data. This password will encrypt all your notes, 
                    passwords, and sensitive information.
                </p>
                <div class="lock-form">
                    <input type="password" id="setupPassword" placeholder="Create master password" />
                    <input type="password" id="confirmPassword" placeholder="Confirm master password" />
                    <div class="password-strength" id="setupPasswordStrength" style="display: none;">
                        <div class="strength-bar">
                            <div class="strength-fill"></div>
                        </div>
                        <div class="strength-text"></div>
                    </div>
                    <button onclick="app.setupMasterPassword()">Set up My Notes App</button>
                </div>
            </div>
        `;
        
        document.getElementById('lockScreen').innerHTML = setupHtml;
        document.getElementById('lockScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        
        // Add password strength indicator
        const setupPassword = document.getElementById('setupPassword');
        setupPassword.addEventListener('input', (e) => {
            this.updatePasswordStrength(e.target.value, 'setupPasswordStrength');
        });
        
        setupPassword.focus();
    }

    async setupMasterPassword() {
        const password = document.getElementById('setupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!password || password.length < 8) {
            alert('Password must be at least 8 characters long');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        const strength = cryptoManager.calculatePasswordStrength(password);
        if (strength.strength === 'weak') {
            if (!confirm('Your password is weak. Are you sure you want to continue?')) {
                return;
            }
        }
        
        const success = await storageManager.setMasterPassword(password);
        if (success) {
            await this.unlockApp(password);
        } else {
            alert('Failed to set up master password. Please try again.');
        }
    }

    async unlockApp(password = null) {
        const passwordInput = password || document.getElementById('masterPassword')?.value;
        
        if (!passwordInput) {
            alert('Please enter your password');
            return;
        }
        
        const success = await storageManager.unlock(passwordInput);
        if (success) {
            document.getElementById('lockScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            await this.loadDashboard();
            this.switchModule('dashboard');
        } else {
            alert('Invalid password');
            const input = document.getElementById('masterPassword');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    lockApp() {
        storageManager.lock();
        this.showLockScreen();
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeIcon = document.querySelector('.theme-toggle i');
        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    switchModule(moduleName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.module === moduleName);
        });
        
        // Update content
        document.querySelectorAll('.module-content').forEach(content => {
            content.classList.toggle('active', content.id === moduleName);
        });
        
        this.currentModule = moduleName;
        
        // Load module data
        this.loadModuleData(moduleName);
    }

    async loadModuleData(moduleName) {
        switch (moduleName) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'notes':
                if (window.notesModule) window.notesModule.loadNotes();
                break;
            case 'banking':
                if (window.bankingModule) window.bankingModule.loadBankAccounts();
                break;
            case 'passwords':
                if (window.passwordsModule) window.passwordsModule.loadPasswords();
                break;
            case 'documents':
                if (window.documentsModule) window.documentsModule.loadDocuments();
                break;
            case 'creative':
                if (window.creativeModule) window.creativeModule.loadProjects();
                break;
            case 'todos':
                if (window.todosModule) window.todosModule.loadTodos();
                break;
        }
    }

    async loadDashboard() {
        try {
            const stats = await storageManager.getStats();
            
            // Update counters
            document.getElementById('notesCount').textContent = stats.notes || 0;
            document.getElementById('bankingCount').textContent = stats.banking || 0;
            document.getElementById('passwordsCount').textContent = stats.passwords || 0;
            document.getElementById('documentsCount').textContent = stats.documents || 0;
            document.getElementById('creativeCount').textContent = stats.creative || 0;
            document.getElementById('todosCount').textContent = stats.todos || 0;
            
            // Load recent items for each module
            await this.loadRecentItems();
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    async loadRecentItems() {
        const modules = ['notes', 'banking', 'passwords', 'documents', 'creative', 'todos'];
        
        for (const module of modules) {
            try {
                const data = await storageManager.loadData(module);
                const recent = data
                    .sort((a, b) => new Date(b.modified || b.created) - new Date(a.modified || a.created))
                    .slice(0, 3);
                
                const container = document.getElementById(`recent${module.charAt(0).toUpperCase() + module.slice(1)}`);
                if (container && recent.length > 0) {
                    container.innerHTML = recent.map(item => {
                        const title = item.title || item.name || item.website || item.bankName || 'Untitled';
                        const date = new Date(item.modified || item.created).toLocaleDateString();
                        return `<div class="recent-item" onclick="app.switchModule('${module}')">${title} - ${date}</div>`;
                    }).join('');
                } else if (container) {
                    container.innerHTML = '<div class="recent-item text-muted">No items yet</div>';
                }
            } catch (error) {
                console.error(`Error loading recent items for ${module}:`, error);
            }
        }
    }

    async performGlobalSearch(query) {
        if (!query || query.length < 2) return;
        
        try {
            const modules = ['notes', 'banking', 'passwords', 'documents', 'creative', 'todos'];
            const results = [];
            
            for (const module of modules) {
                const items = await storageManager.searchItems(module, query);
                items.forEach(item => {
                    results.push({
                        module,
                        item,
                        title: item.title || item.name || item.website || item.bankName || 'Untitled'
                    });
                });
            }
            
            this.showSearchResults(results);
        } catch (error) {
            console.error('Error performing search:', error);
        }
    }

    showSearchResults(results) {
        if (results.length === 0) return;
        
        const searchHtml = `
            <div class="modal-header">
                <h3><i class="fas fa-search"></i> Search Results</h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="search-results">
                ${results.map(result => `
                    <div class="search-result-item" onclick="app.openSearchResult('${result.module}', '${result.item.id}')">
                        <div class="search-result-header">
                            <span class="search-result-module">${result.module.charAt(0).toUpperCase() + result.module.slice(1)}</span>
                            <span class="search-result-title">${result.title}</span>
                        </div>
                        <div class="search-result-content">
                            ${result.item.content || result.item.description || ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.showModal(searchHtml);
    }

    openSearchResult(module, itemId) {
        this.closeModal();
        this.switchModule(module);
        
        // Focus on the specific item
        setTimeout(() => {
            const itemElement = document.querySelector(`[data-id="${itemId}"]`);
            if (itemElement) {
                itemElement.scrollIntoView({ behavior: 'smooth' });
                itemElement.classList.add('highlight');
                setTimeout(() => itemElement.classList.remove('highlight'), 2000);
            }
        }, 100);
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.switchModule('notes');
                    break;
                case '2':
                    e.preventDefault();
                    this.switchModule('banking');
                    break;
                case '3':
                    e.preventDefault();
                    this.switchModule('passwords');
                    break;
                case '4':
                    e.preventDefault();
                    this.switchModule('documents');
                    break;
                case '5':
                    e.preventDefault();
                    this.switchModule('creative');
                    break;
                case '6':
                    e.preventDefault();
                    this.switchModule('todos');
                    break;
                case 'f':
                    e.preventDefault();
                    document.getElementById('globalSearch').focus();
                    break;
                case 'l':
                    e.preventDefault();
                    this.lockApp();
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            this.closeModal();
        }
    }

    showModal(content) {
        document.getElementById('modalContent').innerHTML = content;
        document.getElementById('modalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    updatePasswordStrength(password, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !password) {
            container.style.display = 'none';
            return;
        }
        
        const strength = cryptoManager.calculatePasswordStrength(password);
        const fill = container.querySelector('.strength-fill');
        const text = container.querySelector('.strength-text');
        
        fill.style.width = strength.percentage + '%';
        fill.className = `strength-fill ${strength.strength}`;
        text.textContent = `Password strength: ${strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}`;
        
        if (strength.feedback.length > 0) {
            text.textContent += ` (${strength.feedback.join(', ')})`;
        }
        
        container.style.display = 'block';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 1rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            max-width: 300px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        if (type === 'success') {
            toast.style.borderLeft = '4px solid var(--success-color)';
        } else if (type === 'error') {
            toast.style.borderLeft = '4px solid var(--error-color)';
        } else if (type === 'warning') {
            toast.style.borderLeft = '4px solid var(--warning-color)';
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    async exportAllData() {
        try {
            const data = await storageManager.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `my-notes-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Failed to export data', 'error');
        }
    }
}

// Global functions for HTML onclick handlers
window.unlockApp = () => window.app.unlockApp();
window.setupMasterPassword = () => window.app.setupMasterPassword();
window.lockApp = () => window.app.lockApp();
window.toggleTheme = () => window.app.toggleTheme();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new NotesApp();
    window.app.init();
});

// CSS for search results and highlights
const additionalStyles = `
.search-results {
    max-height: 400px;
    overflow-y: auto;
}

.search-result-item {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.3s ease;
}

.search-result-item:hover {
    background: var(--bg-secondary);
}

.search-result-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
}

.search-result-module {
    background: var(--primary-color);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.search-result-title {
    font-weight: 600;
    color: var(--text-primary);
}

.search-result-content {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.highlight {
    background: rgba(37, 99, 235, 0.1) !important;
    border: 2px solid var(--primary-color) !important;
    transition: all 0.3s ease;
}

.recent-item {
    padding: 0.5rem 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
}

.recent-item:hover {
    color: var(--text-primary);
}

.recent-item:last-child {
    border-bottom: none;
}

.toast {
    font-family: inherit;
}
`;

// Add additional styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);