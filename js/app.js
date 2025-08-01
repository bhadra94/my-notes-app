class NotesApp {
    constructor() {
        this.currentModule = 'dashboard';
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        this.setupEventListeners();
        this.setupTheme();
        
        // Wait for auth manager to be available
        this.waitForAuthManager();
        
        this.initialized = true;
    }

    waitForAuthManager() {
        const checkAuthManager = () => {
            if (window.firebaseAuthManager && window.firebaseAuthManager.isAuthenticated) {
                // User is already logged in, show main app
                this.loadDashboard();
            } else if (window.firebaseAuthManager) {
                // Auth manager is ready but user not logged in
                // Auth manager will handle showing login screen
            } else {
                // Wait for auth manager to initialize
                setTimeout(checkAuthManager, 100);
            }
        };
        checkAuthManager();
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

        // Remove old master password input listener - handled by auth system now
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.querySelector('.theme-toggle i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Authentication is now handled by AuthManager
    // These methods are kept for compatibility but redirect to auth system
    
    lockApp() {
        if (window.authManager) {
            window.authManager.logoutUser();
        }
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
        console.log('App.switchModule called with:', moduleName);
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.module === moduleName);
        });
        
        // Update content
        document.querySelectorAll('.module-content').forEach(content => {
            content.classList.toggle('active', content.id === moduleName);
        });
        
        this.currentModule = moduleName;
        console.log('Current module set to:', this.currentModule);
        
        // Load module data
        console.log('Loading module data for:', moduleName);
        this.loadModuleData(moduleName);
    }

    async loadModuleData(moduleName) {
        console.log('App.loadModuleData called with:', moduleName);
        
        switch (moduleName) {
            case 'dashboard':
                console.log('Loading dashboard...');
                await this.loadDashboard();
                break;
            case 'notes':
                console.log('Loading notes module...');
                if (window.notesModule) {
                    window.notesModule.loadNotes();
                } else {
                    console.error('notesModule not available');
                }
                break;
            case 'banking':
                console.log('Loading banking module...');
                if (window.bankingModule) {
                    window.bankingModule.loadBankAccounts();
                } else {
                    console.error('bankingModule not available');
                }
                break;
            case 'passwords':
                console.log('Loading passwords module...');
                if (window.passwordsModule) {
                    console.log('passwordsModule found, calling loadPasswords()');
                    window.passwordsModule.loadPasswords();
                } else {
                    console.error('passwordsModule not available');
                }
                break;
            case 'documents':
                console.log('Loading documents module...');
                if (window.documentsModule) {
                    window.documentsModule.loadDocuments();
                } else {
                    console.error('documentsModule not available');
                }
                break;
            case 'creative':
                console.log('Loading creative module...');
                if (window.creativeModule) {
                    window.creativeModule.loadProjects();
                } else {
                    console.error('creativeModule not available');
                }
                break;
            case 'todos':
                console.log('Loading todos module...');
                if (window.todosModule) {
                    window.todosModule.loadTodos();
                } else {
                    console.error('todosModule not available');
                }
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
                    if (window.authManager) {
                        window.authManager.logoutUser();
                    }
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
window.toggleTheme = () => window.app.toggleTheme();
window.exportAllData = () => window.app.exportAllData();

// Mobile navigation functions
window.toggleMobileMenu = () => {
    const overlay = document.getElementById('mobileNavOverlay');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const body = document.body;
    
    if (overlay.classList.contains('active')) {
        // Close menu
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
        body.style.overflow = '';
    } else {
        // Open menu
        overlay.classList.add('active');
        menuToggle.classList.add('active');
        body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Sync mobile nav with current active module
        syncMobileNavState();
    }
};

window.navigateToModule = (module) => {
    // Close mobile menu first
    window.toggleMobileMenu();
    
    // Navigate to module using the existing function
    if (window.app) {
        window.app.switchModule(module);
    }
};

function syncMobileNavState() {
    // Sync the active state between desktop and mobile nav
    const activeDesktopItem = document.querySelector('.nav-item.active');
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    
    // Remove active class from all mobile nav items
    mobileNavItems.forEach(item => item.classList.remove('active'));
    
    if (activeDesktopItem) {
        const activeModule = activeDesktopItem.dataset.module;
        const activeMobileItem = document.querySelector(`.mobile-nav-item[data-module="${activeModule}"]`);
        if (activeMobileItem) {
            activeMobileItem.classList.add('active');
        }
    }
}

function syncUserInfoToMobile() {
    // Sync user info from desktop to mobile menu
    const userName = document.getElementById('userName')?.textContent || 'User';
    const userEmail = document.getElementById('userEmail')?.textContent || '';
    
    const mobileUserName = document.getElementById('mobileUserName');
    const mobileUserEmail = document.getElementById('mobileUserEmail');
    
    if (mobileUserName) mobileUserName.textContent = userName;
    if (mobileUserEmail) mobileUserEmail.textContent = userEmail;
}

// Close mobile menu when clicking on overlay background
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('mobileNavOverlay');
    if (overlay && e.target === overlay) {
        window.toggleMobileMenu();
    }
});

// Handle escape key to close mobile menu
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const navOverlay = document.getElementById('mobileNavOverlay');
        const searchOverlay = document.getElementById('mobileSearchOverlay');
        
        if (searchOverlay && searchOverlay.classList.contains('active')) {
            window.closeMobileSearch();
        } else if (navOverlay && navOverlay.classList.contains('active')) {
            window.toggleMobileMenu();
        }
    }
});

// Mobile Search Functions
window.openMobileSearch = () => {
    const overlay = document.getElementById('mobileSearchOverlay');
    const searchInput = document.getElementById('mobileSearchInput');
    const body = document.body;
    
    if (overlay) {
        overlay.classList.add('active');
        body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Auto-focus the search input after animation
        setTimeout(() => {
            if (searchInput) {
                searchInput.focus();
            }
        }, 100);
        
        // Show suggestions by default
        showMobileSearchSuggestions();
    }
};

window.closeMobileSearch = () => {
    const overlay = document.getElementById('mobileSearchOverlay');
    const searchInput = document.getElementById('mobileSearchInput');
    const body = document.body;
    
    if (overlay) {
        overlay.classList.remove('active');
        body.style.overflow = '';
        
        // Clear search input
        if (searchInput) {
            searchInput.value = '';
            handleMobileSearchInput();
        }
    }
};

window.clearMobileSearch = () => {
    const searchInput = document.getElementById('mobileSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        handleMobileSearchInput();
    }
};

window.navigateToModuleAndClose = (module) => {
    // Close search overlay first
    window.closeMobileSearch();
    
    // Navigate to module
    if (window.app) {
        window.app.switchModule(module);
    }
};

function handleMobileSearchInput() {
    const searchInput = document.getElementById('mobileSearchInput');
    const clearBtn = document.getElementById('mobileSearchClear');
    const suggestions = document.getElementById('mobileSearchSuggestions');
    const results = document.getElementById('mobileSearchResults');
    const empty = document.getElementById('mobileSearchEmpty');
    
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    
    // Show/hide clear button
    if (clearBtn) {
        clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    }
    
    if (query.length === 0) {
        // Show suggestions when no search query
        showMobileSearchSuggestions();
    } else if (query.length >= 2) {
        // Perform search when query is 2+ characters
        performMobileSearch(query);
    } else {
        // Hide all sections for queries 1 character long
        hideAllMobileSearchSections();
    }
}

function showMobileSearchSuggestions() {
    const suggestions = document.getElementById('mobileSearchSuggestions');
    const results = document.getElementById('mobileSearchResults');
    const empty = document.getElementById('mobileSearchEmpty');
    
    if (suggestions) suggestions.classList.remove('hidden');
    if (results) results.classList.add('hidden');
    if (empty) empty.classList.add('hidden');
}

function hideAllMobileSearchSections() {
    const suggestions = document.getElementById('mobileSearchSuggestions');
    const results = document.getElementById('mobileSearchResults');
    const empty = document.getElementById('mobileSearchEmpty');
    
    if (suggestions) suggestions.classList.add('hidden');
    if (results) results.classList.add('hidden');
    if (empty) empty.classList.add('hidden');
}

function performMobileSearch(query) {
    const suggestions = document.getElementById('mobileSearchSuggestions');
    const results = document.getElementById('mobileSearchResults');
    const empty = document.getElementById('mobileSearchEmpty');
    const resultsList = document.getElementById('mobileSearchResultsList');
    
    // Hide suggestions
    if (suggestions) suggestions.classList.add('hidden');
    
    // Simulate search (replace with actual search logic)
    const mockResults = [
        {
            title: `Note about ${query}`,
            description: `This is a sample note that contains information about ${query}...`,
            module: 'Notes',
            icon: 'fas fa-pen'
        },
        {
            title: `Password for ${query}`,
            description: `Saved password entry for ${query} account`,
            module: 'Passwords',
            icon: 'fas fa-key'
        }
    ];
    
    if (mockResults.length > 0) {
        // Show results
        if (results) results.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
        
        // Populate results
        if (resultsList) {
            resultsList.innerHTML = mockResults.map(result => `
                <div class="mobile-search-result-item" onclick="selectMobileSearchResult('${result.module}')">
                    <div class="mobile-search-result-icon">
                        <i class="${result.icon}"></i>
                    </div>
                    <div class="mobile-search-result-content">
                        <div class="mobile-search-result-title">${result.title}</div>
                        <div class="mobile-search-result-description">${result.description}</div>
                        <div class="mobile-search-result-module">${result.module}</div>
                    </div>
                </div>
            `).join('');
        }
    } else {
        // Show empty state
        if (results) results.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
    }
}

function selectMobileSearchResult(module) {
    // Close search and navigate to module
    window.closeMobileSearch();
    if (window.app && module) {
        window.app.switchModule(module.toLowerCase());
    }
}

// Add event listener for mobile search input
document.addEventListener('DOMContentLoaded', () => {
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', handleMobileSearchInput);
    }
});

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