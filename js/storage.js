class StorageManager {
    constructor() {
        this.storageKey = 'myNotesAppData';
        this.masterPasswordKey = 'myNotesAppMasterPassword';
        this.isUnlocked = false;
        this.currentPassword = null;
        this.autoLockTimeout = null;
        this.autoLockDelay = 15 * 60 * 1000; // 15 minutes
    }

    async setMasterPassword(password) {
        try {
            const hashedPassword = await cryptoManager.hashPassword(password);
            localStorage.setItem(this.masterPasswordKey, hashedPassword);
            return true;
        } catch (error) {
            console.error('Error setting master password:', error);
            return false;
        }
    }

    async verifyMasterPassword(password) {
        try {
            const storedHash = localStorage.getItem(this.masterPasswordKey);
            if (!storedHash) return false;
            
            const hashedPassword = await cryptoManager.hashPassword(password);
            return hashedPassword === storedHash;
        } catch (error) {
            console.error('Error verifying master password:', error);
            return false;
        }
    }

    hasMasterPassword() {
        return localStorage.getItem(this.masterPasswordKey) !== null;
    }

    async unlock(password) {
        const isValid = await this.verifyMasterPassword(password);
        if (isValid) {
            this.isUnlocked = true;
            this.currentPassword = password;
            this.resetAutoLockTimer();
            return true;
        }
        return false;
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
        if (!this.isUnlocked || !this.currentPassword) {
            throw new Error('Application is locked');
        }

        try {
            const allData = await this.loadAllData() || {};
            allData[module] = data;
            
            const jsonData = JSON.stringify(allData);
            const encryptedData = await cryptoManager.encrypt(jsonData, this.currentPassword);
            
            localStorage.setItem(this.storageKey, encryptedData);
            this.resetAutoLockTimer();
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    async loadData(module) {
        if (!this.isUnlocked || !this.currentPassword) {
            throw new Error('Application is locked');
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
        if (!this.isUnlocked || !this.currentPassword) {
            throw new Error('Application is locked');
        }

        try {
            const encryptedData = localStorage.getItem(this.storageKey);
            if (!encryptedData) return null;
            
            const jsonData = await cryptoManager.decrypt(encryptedData, this.currentPassword);
            return JSON.parse(jsonData);
        } catch (error) {
            console.error('Error loading all data:', error);
            throw error;
        }
    }

    async exportData() {
        if (!this.isUnlocked || !this.currentPassword) {
            throw new Error('Application is locked');
        }

        try {
            const allData = await this.loadAllData();
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
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
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.masterPasswordKey);
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
        if (!this.isUnlocked) return {};
        
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