class StorageManager {
    constructor() {
        this.storageKeyPrefix = 'secureNotes_userData_';
        this.currentUser = null;
        this.currentPassword = null;
        this.isUnlocked = false;
        this.autoLockTimeout = null;
        this.autoLockDelay = 15 * 60 * 1000; // 15 minutes
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.isUnlocked = true;
        this.currentPassword = null; // Will be set when user provides password for data access
        this.resetAutoLockTimer();
    }

    clearCurrentUser() {
        this.currentUser = null;
        this.currentPassword = null;
        this.isUnlocked = false;
        if (this.autoLockTimeout) {
            clearTimeout(this.autoLockTimeout);
        }
    }

    getUserStorageKey() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }
        return this.storageKeyPrefix + this.currentUser.id;
    }

    // For backward compatibility and data encryption password
    async setDataPassword(password) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }
        
        try {
            this.currentPassword = password;
            return true;
        } catch (error) {
            console.error('Error setting data password:', error);
            return false;
        }
    }

    async verifyDataPassword(password) {
        // For now, we'll use a simple approach where the data password
        // is the same as the login password. In a real app, this could be different.
        return true;
    }

    hasDataPassword() {
        return this.currentPassword !== null;
    }

    async unlock(password) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }
        
        this.currentPassword = password;
        this.isUnlocked = true;
        this.resetAutoLockTimer();
        return true;
    }

    lock() {
        this.isUnlocked = false;
        this.currentPassword = null;
        if (this.autoLockTimeout) {
            clearTimeout(this.autoLockTimeout);
        }
    }

    resetAutoLockTimer() {
        if (this.autoLockTimeout) {
            clearTimeout(this.autoLockTimeout);
        }
        
        this.autoLockTimeout = setTimeout(() => {
            if (this.isUnlocked) {
                this.lock();
                if (window.app) {
                    window.app.showLockScreen();
                }
            }
        }, this.autoLockDelay);
    }

    async saveData(module, data) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const allData = await this.loadAllData() || {};
            allData[module] = data;
            
            const jsonData = JSON.stringify(allData);
            
            // For now, store data unencrypted per user. In production, you'd encrypt with user's password
            const storageKey = this.getUserStorageKey();
            localStorage.setItem(storageKey, jsonData);
            
            this.resetAutoLockTimer();
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    async loadData(module) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const allData = await this.loadAllData();
            this.resetAutoLockTimer();
            return allData ? allData[module] || [] : [];
        } catch (error) {
            console.error('Error loading data:', error);
            return [];
        }
    }

    async loadAllData() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const storageKey = this.getUserStorageKey();
            const jsonData = localStorage.getItem(storageKey);
            
            if (!jsonData) return null;
            
            return JSON.parse(jsonData);
        } catch (error) {
            console.error('Error loading all data:', error);
            return null;
        }
    }

    async exportData() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const allData = await this.loadAllData();
            const exportData = {
                version: '2.0',
                exportDate: new Date().toISOString(),
                userId: this.currentUser.id,
                userEmail: this.currentUser.email,
                data: allData
            };
            
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    async importData(jsonData, password) {
        try {
            const importData = JSON.parse(jsonData);
            
            if (!importData.data) {
                throw new Error('Invalid import file format');
            }
            
            const encryptedData = await cryptoManager.encrypt(JSON.stringify(importData.data), password);
            localStorage.setItem(this.storageKey, encryptedData);
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    async clearAllData() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }
        
        const storageKey = this.getUserStorageKey();
        localStorage.removeItem(storageKey);
        this.lock();
    }

    // Module-specific helper methods
    async saveItem(module, item) {
        const data = await this.loadData(module);
        
        if (item.id) {
            const index = data.findIndex(existing => existing.id === item.id);
            if (index !== -1) {
                data[index] = { ...item, modified: new Date().toISOString() };
            } else {
                item.id = cryptoManager.generateSecureId();
                item.created = new Date().toISOString();
                item.modified = item.created;
                data.push(item);
            }
        } else {
            item.id = cryptoManager.generateSecureId();
            item.created = new Date().toISOString();
            item.modified = item.created;
            data.push(item);
        }
        
        await this.saveData(module, data);
        return item;
    }

    async deleteItem(module, id) {
        const data = await this.loadData(module);
        const filteredData = data.filter(item => item.id !== id);
        await this.saveData(module, filteredData);
        return true;
    }

    async getItem(module, id) {
        const data = await this.loadData(module);
        return data.find(item => item.id === id);
    }

    async searchItems(module, query, fields = ['title', 'content']) {
        const data = await this.loadData(module);
        if (!query) return data;
        
        const searchTerm = query.toLowerCase();
        return data.filter(item => {
            return fields.some(field => {
                const value = item[field];
                return value && value.toLowerCase().includes(searchTerm);
            });
        });
    }

    async getStats() {
        if (!this.currentUser) return {};
        
        try {
            const allData = await this.loadAllData() || {};
            
            return {
                notes: (allData.notes || []).length,
                banking: (allData.banking || []).length,
                passwords: (allData.passwords || []).length,
                documents: (allData.documents || []).length,
                creative: (allData.creative || []).length,
                todos: (allData.todos || []).filter(todo => !todo.completed).length
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return {};
        }
    }

    // File handling for documents
    async saveFile(file, description = '') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const fileData = {
                        id: cryptoManager.generateSecureId(),
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        description: description,
                        data: reader.result,
                        created: new Date().toISOString(),
                        modified: new Date().toISOString()
                    };
                    
                    const documents = await this.loadData('documents');
                    documents.push(fileData);
                    await this.saveData('documents', documents);
                    
                    resolve(fileData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    async deleteFile(id) {
        return await this.deleteItem('documents', id);
    }

    // Backup and restore
    downloadBackup() {
        this.exportData().then(data => {
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `my-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }).catch(error => {
            console.error('Error creating backup:', error);
            alert('Error creating backup: ' + error.message);
        });
    }
}

// Initialize storage manager
window.storageManager = new StorageManager();

// Auto-lock on window blur/focus events
window.addEventListener('blur', () => {
    if (window.storageManager && window.storageManager.isUnlocked) {
        window.storageManager.resetAutoLockTimer();
    }
});

window.addEventListener('focus', () => {
    if (window.storageManager && window.storageManager.isUnlocked) {
        window.storageManager.resetAutoLockTimer();
    }
});

// Reset auto-lock timer on user activity
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
    document.addEventListener(event, () => {
        if (window.storageManager && window.storageManager.isUnlocked) {
            window.storageManager.resetAutoLockTimer();
        }
    }, { passive: true });
});