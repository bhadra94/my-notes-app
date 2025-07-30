class FirebaseStorageManager {
    constructor() {
        this.currentUser = null;
        this.isUnlocked = false;
        this.autoLockTimeout = null;
        this.autoLockDelay = 15 * 60 * 1000; // 15 minutes
        
        // Wait for Firebase to be available
        this.initializeWhenReady();
    }

    async initializeWhenReady() {
        // Wait for Firebase to be loaded
        while (!window.firebaseDb || !window.firebaseFunctions) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.db = window.firebaseDb;
        this.functions = window.firebaseFunctions;
        this.auth = window.firebaseAuth;
        
        // Listen for auth changes
        if (window.firebaseAuthManager) {
            window.firebaseAuthManager.onAuthStateChanged((user) => {
                if (user) {
                    this.setCurrentUser(user);
                } else {
                    this.clearCurrentUser();
                }
            });
        }
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.isUnlocked = true;
        this.resetAutoLockTimer();
    }

    clearCurrentUser() {
        this.currentUser = null;
        this.isUnlocked = false;
        if (this.autoLockTimeout) {
            clearTimeout(this.autoLockTimeout);
        }
    }

    getUserId() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }
        return this.currentUser.uid;
    }

    resetAutoLockTimer() {
        if (this.autoLockTimeout) {
            clearTimeout(this.autoLockTimeout);
        }
        
        this.autoLockTimeout = setTimeout(() => {
            if (this.isUnlocked && window.firebaseAuthManager) {
                window.firebaseAuthManager.logoutUser();
            }
        }, this.autoLockDelay);
    }

    lock() {
        this.isUnlocked = false;
        if (this.autoLockTimeout) {
            clearTimeout(this.autoLockTimeout);
        }
    }

    // For backward compatibility - Firebase handles authentication
    async unlock(password) {
        return this.isUnlocked;
    }

    hasDataPassword() {
        return this.isUnlocked;
    }

    async setDataPassword(password) {
        return true; // Firebase handles authentication
    }

    async verifyDataPassword(password) {
        return this.isUnlocked;
    }

    // Main data operations with Firestore
    async saveData(module, data) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const userId = this.getUserId();
            const docRef = this.functions.doc(this.db, 'userData', userId, 'modules', module);
            
            await this.functions.setDoc(docRef, {
                data: data,
                lastModified: this.functions.serverTimestamp(),
                version: 1
            });
            
            this.resetAutoLockTimer();
            return true;
        } catch (error) {
            console.error('Error saving data to Firestore:', error);
            throw error;
        }
    }

    async loadData(module) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const userId = this.getUserId();
            const docRef = this.functions.doc(this.db, 'userData', userId, 'modules', module);
            const docSnap = await this.functions.getDoc(docRef);
            
            this.resetAutoLockTimer();
            
            if (docSnap.exists()) {
                const docData = docSnap.data();
                return docData.data || [];
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error loading data from Firestore:', error);
            return [];
        }
    }

    async loadAllData() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const userId = this.getUserId();
            const modulesRef = this.functions.collection(this.db, 'userData', userId, 'modules');
            const querySnapshot = await this.functions.getDocs(modulesRef);
            
            const allData = {};
            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                allData[doc.id] = docData.data || [];
            });
            
            this.resetAutoLockTimer();
            return allData;
        } catch (error) {
            console.error('Error loading all data from Firestore:', error);
            return {};
        }
    }

    async exportData() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const allData = await this.loadAllData();
            const exportData = {
                version: '3.0', // Firebase version
                exportDate: new Date().toISOString(),
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                data: allData
            };
            
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    async importData(jsonData) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            const importData = JSON.parse(jsonData);
            
            if (!importData.data) {
                throw new Error('Invalid import file format');
            }
            
            // Import each module's data
            for (const [module, data] of Object.entries(importData.data)) {
                await this.saveData(module, data);
            }
            
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
        
        try {
            const userId = this.getUserId();
            const modulesRef = this.functions.collection(this.db, 'userData', userId, 'modules');
            const querySnapshot = await this.functions.getDocs(modulesRef);
            
            // Delete all module documents
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(this.functions.deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
            this.lock();
        } catch (error) {
            console.error('Error clearing all data:', error);
            throw error;
        }
    }

    // Module-specific helper methods
    async saveItem(module, item) {
        const data = await this.loadData(module);
        
        if (item.id) {
            // Update existing item
            const index = data.findIndex(existing => existing.id === item.id);
            if (index !== -1) {
                data[index] = { 
                    ...item, 
                    modified: new Date().toISOString(),
                    modifiedBy: this.currentUser.uid
                };
            } else {
                // Item with ID doesn't exist, add as new
                item.id = this.generateSecureId();
                item.created = new Date().toISOString();
                item.modified = item.created;
                item.createdBy = this.currentUser.uid;
                item.modifiedBy = this.currentUser.uid;
                data.push(item);
            }
        } else {
            // Create new item
            item.id = this.generateSecureId();
            item.created = new Date().toISOString();
            item.modified = item.created;
            item.createdBy = this.currentUser.uid;
            item.modifiedBy = this.currentUser.uid;
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
            const allData = await this.loadAllData();
            
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

    // File handling for documents - Enhanced for Firebase
    async saveFile(file, description = '') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const fileData = {
                        id: this.generateSecureId(),
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        description: description,
                        data: reader.result,
                        created: new Date().toISOString(),
                        modified: new Date().toISOString(),
                        createdBy: this.currentUser?.uid,
                        modifiedBy: this.currentUser?.uid
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

    // Enhanced backup and restore with Firebase metadata
    downloadBackup() {
        this.exportData().then(data => {
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const userName = this.currentUser?.displayName || this.currentUser?.email || 'user';
            const safeUserName = userName.replace(/[^a-zA-Z0-9]/g, '-');
            a.download = `securenotes-backup-${safeUserName}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }).catch(error => {
            console.error('Error creating backup:', error);
            if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast('Error creating backup: ' + error.message, 'error');
            }
        });
    }

    // Real-time data sync methods (for future enhancement)
    async subscribeToModuleChanges(module, callback) {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        // This would implement real-time listeners with Firestore
        // For now, we'll just return an unsubscribe function
        return () => {};
    }

    // Utility methods
    generateSecureId() {
        // Use crypto manager if available, otherwise fallback
        if (window.cryptoManager && typeof window.cryptoManager.generateSecureId === 'function') {
            return window.cryptoManager.generateSecureId();
        }
        
        // Fallback ID generation
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Migration helper for localStorage to Firebase
    async migrateFromLocalStorage() {
        if (!this.currentUser) {
            throw new Error('No user is currently logged in');
        }

        try {
            // Check if there's old localStorage data to migrate
            const oldData = localStorage.getItem('secureNotes_userData_' + this.currentUser.uid);
            if (oldData) {
                const parsedData = JSON.parse(oldData);
                
                // Migrate each module
                for (const [module, data] of Object.entries(parsedData)) {
                    if (Array.isArray(data) && data.length > 0) {
                        await this.saveData(module, data);
                    }
                }
                
                // Clear old localStorage data after successful migration
                localStorage.removeItem('secureNotes_userData_' + this.currentUser.uid);
                
                if (window.app && typeof window.app.showToast === 'function') {
                    window.app.showToast('Data successfully migrated to cloud storage!', 'success');
                }
                
                return true;
            }
        } catch (error) {
            console.error('Error migrating from localStorage:', error);
            if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast('Error migrating data: ' + error.message, 'error');
            }
        }
        
        return false;
    }

    // Offline support methods
    async enableOfflineSupport() {
        // This would enable Firestore offline persistence
        // For now, it's a placeholder
        console.log('Offline support would be enabled here');
    }

    async syncWhenOnline() {
        // This would handle syncing when coming back online
        // For now, it's a placeholder
        console.log('Sync when online would happen here');
    }
}

// Initialize Firebase storage manager
window.addEventListener('load', () => {
    if (!window.firebaseStorageManager) {
        window.firebaseStorageManager = new FirebaseStorageManager();
        
        // Set as the main storage manager for backward compatibility
        window.storageManager = window.firebaseStorageManager;
    }
});