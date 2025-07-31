// Enhanced Documents Module with Folder Management
class DocumentsFolderManager {
    constructor(documentsModule) {
        this.documentsModule = documentsModule;
        this.currentFolderId = ''; // Root folder
        this.currentPath = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Sort functionality
        const sortSelect = document.getElementById('documentsSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.loadCurrentFolder();
            });
        }

        // Context menu for right-click operations
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.folder-item') || e.target.closest('.document-item')) {
                e.preventDefault();
                this.showContextMenu(e);
            }
        });

        // Close context menu when clicking elsewhere
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Enhanced drag and drop for folders and files
        this.setupAdvancedDragAndDrop();
    }

    setupAdvancedDragAndDrop() {
        const documentsContainer = document.getElementById('documents');
        
        if (documentsContainer) {
            // Global drag and drop for files from outside
            documentsContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showDropZone();
            });

            documentsContainer.addEventListener('dragleave', (e) => {
                if (!documentsContainer.contains(e.relatedTarget)) {
                    this.hideDropZone();
                }
            });

            documentsContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hideDropZone();
                
                if (e.dataTransfer.files.length > 0) {
                    // Handle file uploads
                    this.documentsModule.handleFileUpload(e.dataTransfer.files);
                } else {
                    // Handle internal drag and drop
                    this.handleInternalDrop(e);
                }
            });
        }

        // Setup drag and drop for internal items (files and folders)
        this.setupInternalDragAndDrop();
    }

    setupInternalDragAndDrop() {
        // Use event delegation for dynamically created elements
        document.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.folder-item, .document-card');
            if (item) {
                const itemId = item.dataset.id;
                const itemType = item.classList.contains('folder-item') ? 'folder' : 'file';
                
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    id: itemId,
                    type: itemType
                }));
                
                item.classList.add('dragging');
                this.draggedItem = { id: itemId, type: itemType };
            }
        });

        document.addEventListener('dragend', (e) => {
            const item = e.target.closest('.folder-item, .document-card');
            if (item) {
                item.classList.remove('dragging');
                this.draggedItem = null;
            }
            
            // Remove all drop zone highlights
            document.querySelectorAll('.drop-zone-active').forEach(el => {
                el.classList.remove('drop-zone-active');
            });
        });

        document.addEventListener('dragover', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem && this.draggedItem && this.draggedItem.type === 'file') {
                e.preventDefault();
                folderItem.classList.add('drop-zone-active');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                folderItem.classList.remove('drop-zone-active');
            }
        });

        document.addEventListener('drop', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem && this.draggedItem) {
                e.preventDefault();
                e.stopPropagation();
                
                const targetFolderId = folderItem.dataset.id;
                this.handleItemDrop(this.draggedItem, targetFolderId);
                
                folderItem.classList.remove('drop-zone-active');
            }
        });
    }

    async handleItemDrop(draggedItem, targetFolderId) {
        try {
            if (draggedItem.type === 'file') {
                await this.moveFile(draggedItem.id, targetFolderId);
            } else if (draggedItem.type === 'folder') {
                // Check if we're not trying to move a folder into itself or its children
                if (await this.isValidFolderMove(draggedItem.id, targetFolderId)) {
                    await this.moveFolder(draggedItem.id, targetFolderId);
                } else {
                    app.showToast('Cannot move folder into itself or its children', 'error');
                }
            }
        } catch (error) {
            console.error('Error handling item drop:', error);
            app.showToast('Error moving item', 'error');
        }
    }

    async isValidFolderMove(sourceFolderId, targetFolderId) {
        // Cannot move folder into itself
        if (sourceFolderId === targetFolderId) return false;
        
        // Cannot move folder into its own children
        let currentId = targetFolderId;
        while (currentId) {
            if (currentId === sourceFolderId) return false;
            
            try {
                const folder = await storageManager.getItem('folders', currentId);
                currentId = folder ? folder.parentId : null;
            } catch (error) {
                break;
            }
        }
        
        return true;
    }

    showDropZone() {
        const documentsContent = document.querySelector('.documents-content');
        if (documentsContent) {
            documentsContent.classList.add('drop-zone-active');
        }
        
        // Show drop overlay
        if (!this.dropOverlay) {
            this.dropOverlay = document.createElement('div');
            this.dropOverlay.className = 'drop-overlay';
            this.dropOverlay.innerHTML = `
                <div class="drop-overlay-content">
                    <i class="fas fa-cloud-upload-alt fa-3x"></i>
                    <h3>Drop files here to upload</h3>
                    <p>Files will be uploaded to the current folder</p>
                </div>
            `;
            document.body.appendChild(this.dropOverlay);
        }
        
        this.dropOverlay.style.display = 'flex';
    }

    hideDropZone() {
        const documentsContent = document.querySelector('.documents-content');
        if (documentsContent) {
            documentsContent.classList.remove('drop-zone-active');
        }
        
        if (this.dropOverlay) {
            this.dropOverlay.style.display = 'none';
        }
    }

    // Folder Management
    async createFolder(parentId = this.currentFolderId, name = null) {
        const folderName = name || prompt('Enter folder name:');
        if (!folderName || !folderName.trim()) return;

        try {
            const folderData = {
                name: folderName.trim(),
                parentId: parentId,
                type: 'folder',
                color: '#3b82f6',
                icon: 'fas fa-folder',
                description: '',
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };

            await storageManager.saveItem('folders', folderData);
            app.showToast('Folder created successfully', 'success');
            
            await this.loadCurrentFolder();
            await this.updateFolderTree();
            
        } catch (error) {
            console.error('Error creating folder:', error);
            app.showToast('Error creating folder', 'error');
        }
    }

    async renameFolder(folderId) {
        try {
            const folder = await storageManager.getItem('folders', folderId);
            if (!folder) return;

            const newName = prompt('Enter new folder name:', folder.name);
            if (!newName || !newName.trim()) return;

            folder.name = newName.trim();
            folder.modified = new Date().toISOString();

            await storageManager.saveItem('folders', folder);
            app.showToast('Folder renamed successfully', 'success');
            
            await this.loadCurrentFolder();
            await this.updateFolderTree();
            
        } catch (error) {
            console.error('Error renaming folder:', error);
            app.showToast('Error renaming folder', 'error');
        }
    }

    async deleteFolder(folderId) {
        if (!confirm('Are you sure you want to delete this folder and all its contents? This action cannot be undone.')) {
            return;
        }

        try {
            // Get all subfolders and files
            const subfolders = await this.getFolderChildren(folderId);
            const files = await this.getFilesInFolder(folderId);

            // Delete all files in folder
            for (const file of files) {
                await storageManager.deleteItem('documents', file.id);
            }

            // Recursively delete subfolders
            for (const subfolder of subfolders) {
                await this.deleteFolder(subfolder.id);
            }

            // Delete the folder itself
            await storageManager.deleteItem('folders', folderId);
            
            app.showToast('Folder deleted successfully', 'success');
            
            await this.loadCurrentFolder();
            await this.updateFolderTree();
            
        } catch (error) {
            console.error('Error deleting folder:', error);
            app.showToast('Error deleting folder', 'error');
        }
    }

    async moveFolder(folderId, newParentId) {
        try {
            const folder = await storageManager.getItem('folders', folderId);
            if (!folder) return;

            folder.parentId = newParentId;
            folder.modified = new Date().toISOString();

            await storageManager.saveItem('folders', folder);
            app.showToast('Folder moved successfully', 'success');
            
            await this.loadCurrentFolder();
            await this.updateFolderTree();
            
        } catch (error) {
            console.error('Error moving folder:', error);
            app.showToast('Error moving folder', 'error');
        }
    }

    // Navigation
    async navigateToFolder(folderId) {
        this.currentFolderId = folderId;
        await this.updateCurrentPath();
        await this.loadCurrentFolder();
        this.updateBreadcrumb();
        this.updateFolderInfo();
    }

    async updateCurrentPath() {
        this.currentPath = [];
        let currentId = this.currentFolderId;

        while (currentId) {
            try {
                const folder = await storageManager.getItem('folders', currentId);
                if (folder) {
                    this.currentPath.unshift(folder);
                    currentId = folder.parentId;
                } else {
                    break;
                }
            } catch (error) {
                break;
            }
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('folderBreadcrumb');
        if (!breadcrumb) return;

        let breadcrumbHtml = `
            <span class="breadcrumb-item ${this.currentFolderId === '' ? 'active' : ''}" 
                  onclick="documentsModule.folderManager.navigateToFolder('')">
                <i class="fas fa-home"></i> Root
            </span>
        `;

        for (let i = 0; i < this.currentPath.length; i++) {
            const folder = this.currentPath[i];
            const isLast = i === this.currentPath.length - 1;
            
            breadcrumbHtml += `
                <i class="fas fa-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-item ${isLast ? 'active' : ''}" 
                      onclick="documentsModule.folderManager.navigateToFolder('${folder.id}')">
                    <i class="${folder.icon}" style="color: ${folder.color}"></i>
                    ${folder.name}
                </span>
            `;
        }

        breadcrumb.innerHTML = breadcrumbHtml;
    }

    async updateFolderInfo() {
        const folderName = document.getElementById('currentFolderName');
        const folderCount = document.getElementById('folderCount');
        const fileCount = document.getElementById('fileCount');

        if (folderName) {
            if (this.currentFolderId === '') {
                folderName.textContent = 'Root Folder';
            } else {
                const folder = await storageManager.getItem('folders', this.currentFolderId);
                folderName.textContent = folder ? folder.name : 'Unknown Folder';
            }
        }

        // Update counts
        const folders = await this.getFolderChildren(this.currentFolderId);
        const files = await this.getFilesInFolder(this.currentFolderId);

        if (folderCount) folderCount.textContent = folders.length;
        if (fileCount) fileCount.textContent = files.length;
    }

    // Data Retrieval
    async getFolderChildren(parentId) {
        try {
            const allFolders = await storageManager.loadData('folders');
            return allFolders.filter(folder => folder.parentId === parentId);
        } catch (error) {
            console.error('Error getting folder children:', error);
            return [];
        }
    }

    async getFilesInFolder(folderId) {
        try {
            const allFiles = await storageManager.loadData('documents');
            return allFiles.filter(file => (file.folderId || '') === folderId);
        } catch (error) {
            console.error('Error getting files in folder:', error);
            return [];
        }
    }

    async getFolderPath(folderId) {
        const path = [];
        let currentId = folderId;

        while (currentId) {
            try {
                const folder = await storageManager.getItem('folders', currentId);
                if (folder) {
                    path.unshift(folder.name);
                    currentId = folder.parentId;
                } else {
                    break;
                }
            } catch (error) {
                break;
            }
        }

        return path.join(' / ');
    }

    // Rendering
    async loadCurrentFolder() {
        try {
            const folders = await this.getFolderChildren(this.currentFolderId);
            const files = await this.getFilesInFolder(this.currentFolderId);
            
            // Apply sorting
            const sortBy = document.getElementById('documentsSort')?.value || 'name';
            this.sortItems(folders, sortBy);
            this.sortItems(files, sortBy);

            this.renderFoldersAndFiles(folders, files);
            await this.updateFolderTree();
            
        } catch (error) {
            console.error('Error loading current folder:', error);
            app.showToast('Error loading folder contents', 'error');
        }
    }

    sortItems(items, sortBy) {
        items.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'date':
                    return new Date(b.modified || b.created) - new Date(a.modified || a.created);
                case 'size':
                    return (b.size || 0) - (a.size || 0);
                case 'type':
                    return (a.type || '').localeCompare(b.type || '');
                default:
                    return 0;
            }
        });
    }

    renderFoldersAndFiles(folders, files) {
        const container = document.getElementById('documentsList');
        if (!container) return;

        if (folders.length === 0 && files.length === 0) {
            container.innerHTML = this.getEmptyStateHtml();
            return;
        }

        let html = '';

        // Render folders first
        folders.forEach(folder => {
            html += this.renderFolderItem(folder);
        });

        // Then render files
        files.forEach(file => {
            html += this.documentsModule.renderDocumentCard(file);
        });

        container.innerHTML = html;
    }

    renderFolderItem(folder) {
        const timeAgo = this.documentsModule.getTimeAgo(new Date(folder.modified || folder.created));
        
        return `
            <div class="item-card folder-item" data-id="${folder.id}" data-type="folder">
                <div class="item-header">
                    <div class="item-info">
                        <div class="item-title">
                            <i class="${folder.icon}" style="color: ${folder.color}"></i>
                            ${folder.name}
                        </div>
                        <div class="item-meta">
                            Folder • ${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="item-action" onclick="documentsModule.folderManager.navigateToFolder('${folder.id}')" title="Open Folder">
                            <i class="fas fa-folder-open"></i>
                        </button>
                        <button class="item-action" onclick="documentsModule.folderManager.renameFolder('${folder.id}')" title="Rename">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action text-error" onclick="documentsModule.folderManager.deleteFolder('${folder.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${folder.description ? `
                    <div class="item-content">
                        ${folder.description}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async updateFolderTree() {
        const treeContainer = document.getElementById('folderTree');
        if (!treeContainer) return;

        const rootFolders = await this.getFolderChildren('');
        let treeHtml = this.renderFolderTreeItems(rootFolders, 0);
        
        treeContainer.innerHTML = treeHtml || '<div class="tree-empty">No folders created yet</div>';
    }

    renderFolderTreeItems(folders, level) {
        let html = '';
        
        folders.forEach(folder => {
            const indent = level * 20;
            html += `
                <div class="tree-item" style="padding-left: ${indent}px">
                    <div class="tree-item-content ${folder.id === this.currentFolderId ? 'active' : ''}"
                         onclick="documentsModule.folderManager.navigateToFolder('${folder.id}')">
                        <i class="${folder.icon}" style="color: ${folder.color}"></i>
                        <span class="tree-item-name">${folder.name}</span>
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    getEmptyStateHtml() {
        return `
            <div class="empty-state">
                <div class="empty-state-content">
                    <i class="fas fa-folder-open fa-3x text-muted"></i>
                    <h3>Empty Folder</h3>
                    <p>This folder is empty. Upload files or create subfolders to get started.</p>
                    <div class="empty-state-actions">
                        <button class="btn-secondary" onclick="documentsModule.folderManager.createFolder()">
                            <i class="fas fa-folder-plus"></i> New Folder
                        </button>
                        <button class="btn-primary" onclick="document.getElementById('documentUpload').click()">
                            <i class="fas fa-upload"></i> Upload Files
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // File Operations
    async uploadFileToFolder(file, folderId = this.currentFolderId) {
        try {
            const fileData = await this.documentsModule.processFile(file);
            fileData.folderId = folderId;
            
            await storageManager.saveItem('documents', fileData);
            await this.loadCurrentFolder();
            
        } catch (error) {
            console.error('Error uploading file to folder:', error);
            throw error;
        }
    }

    async moveFile(fileId, newFolderId) {
        try {
            const file = await storageManager.getItem('documents', fileId);
            if (!file) return;

            file.folderId = newFolderId;
            file.modified = new Date().toISOString();

            await storageManager.saveItem('documents', file);
            app.showToast('File moved successfully', 'success');
            
            await this.loadCurrentFolder();
            
        } catch (error) {
            console.error('Error moving file:', error);
            app.showToast('Error moving file', 'error');
        }
    }

    async copyFile(fileId, targetFolderId) {
        try {
            const file = await storageManager.getItem('documents', fileId);
            if (!file) return;

            const copiedFile = {
                ...file,
                id: undefined, // Let storage manager generate new ID
                name: `Copy of ${file.name}`,
                folderId: targetFolderId,
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };

            await storageManager.saveItem('documents', copiedFile);
            app.showToast('File copied successfully', 'success');
            
            if (targetFolderId === this.currentFolderId) {
                await this.loadCurrentFolder();
            }
            
        } catch (error) {
            console.error('Error copying file:', error);
            app.showToast('Error copying file', 'error');
        }
    }

    // Search
    async searchFilesInFolder(folderId, query) {
        try {
            const files = await this.getFilesInFolder(folderId);
            return files.filter(file => 
                file.name.toLowerCase().includes(query.toLowerCase()) ||
                (file.description && file.description.toLowerCase().includes(query.toLowerCase()))
            );
        } catch (error) {
            console.error('Error searching files in folder:', error);
            return [];
        }
    }

    // Context Menu
    showContextMenu(e) {
        const target = e.target.closest('.folder-item, .document-item');
        if (!target) return;

        const itemId = target.dataset.id;
        const itemType = target.dataset.type || 'file';

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.style.zIndex = '1000';

        const menuItems = itemType === 'folder' ? 
            this.getFolderContextMenuItems(itemId) : 
            this.getFileContextMenuItems(itemId);

        contextMenu.innerHTML = menuItems;
        document.body.appendChild(contextMenu);

        this.currentContextMenu = contextMenu;
    }

    getFolderContextMenuItems(folderId) {
        return `
            <div class="context-menu-item" onclick="documentsModule.folderManager.navigateToFolder('${folderId}')">
                <i class="fas fa-folder-open"></i> Open
            </div>
            <div class="context-menu-item" onclick="documentsModule.folderManager.renameFolder('${folderId}')">
                <i class="fas fa-edit"></i> Rename
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" onclick="documentsModule.folderManager.deleteFolder('${folderId}')">
                <i class="fas fa-trash"></i> Delete
            </div>
        `;
    }

    getFileContextMenuItems(fileId) {
        return `
            <div class="context-menu-item" onclick="documentsModule.previewDocument('${fileId}')">
                <i class="fas fa-eye"></i> Preview
            </div>
            <div class="context-menu-item" onclick="documentsModule.downloadDocument('${fileId}')">
                <i class="fas fa-download"></i> Download
            </div>
            <div class="context-menu-item" onclick="documentsModule.editDocument('${fileId}')">
                <i class="fas fa-edit"></i> Edit Info
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" onclick="documentsModule.deleteDocument('${fileId}')">
                <i class="fas fa-trash"></i> Delete
            </div>
        `;
    }

    hideContextMenu() {
        if (this.currentContextMenu) {
            this.currentContextMenu.remove();
            this.currentContextMenu = null;
        }
    }
}

// Initialize folder manager when documents module is ready
document.addEventListener('DOMContentLoaded', () => {
    const initializeFolderManager = () => {
        if (window.documentsModule) {
            window.documentsModule.folderManager = new DocumentsFolderManager(window.documentsModule);
            console.log('Documents folder manager initialized');
        } else {
            // Wait for documents module to be available
            setTimeout(initializeFolderManager, 100);
        }
    };
    initializeFolderManager();
});

// Also make it available globally for easy access
window.addEventListener('load', () => {
    if (window.documentsModule && !window.documentsModule.folderManager) {
        window.documentsModule.folderManager = new DocumentsFolderManager(window.documentsModule);
        console.log('Documents folder manager initialized on window load');
    }
});