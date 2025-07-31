class DocumentsModule {
    constructor() {
        this.currentFolder = 'root';
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.sortBy = 'name';
        this.folders = new Map();
        this.allDocuments = [];
        this.selectedItems = new Set();
        this.maxFileSize = 10 * 1024 * 1024; // 10MB limit
        this.allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        this.setupEventListeners();
        this.initializeDefaultFolders();
    }

    initializeDefaultFolders() {
        // Initialize default folder structure
        this.folders.set('root', {
            id: 'root',
            name: 'All Documents',
            parent: null,
            children: ['images', 'documents', 'pdfs', 'spreadsheets'],
            created: new Date().toISOString()
        });
        
        this.folders.set('images', {
            id: 'images',
            name: 'Images',
            parent: 'root',
            children: [],
            created: new Date().toISOString()
        });
        
        this.folders.set('documents', {
            id: 'documents',
            name: 'Documents',
            parent: 'root',
            children: [],
            created: new Date().toISOString()
        });
        
        this.folders.set('pdfs', {
            id: 'pdfs',
            name: 'PDFs',
            parent: 'root',
            children: [],
            created: new Date().toISOString()
        });
        
        this.folders.set('spreadsheets', {
            id: 'spreadsheets',
            name: 'Spreadsheets',
            parent: 'root',
            children: [],
            created: new Date().toISOString()
        });
    }

    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('documentUpload');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }

        // Search functionality
        const searchInput = document.getElementById('documentsSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchDocuments(e.target.value);
                }, 300);
            });
        }

        // Filter functionality
        const filterSelect = document.getElementById('documentsFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                this.filterDocuments();
            });
        }

        // Setup drag and drop
        this.setupDragAndDrop();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (document.querySelector('#documents.active')) {
                this.handleKeyboardShortcuts(e);
            }
        });
    }

    setupDragAndDrop() {
        const documentsContainer = document.getElementById('documents');
        
        if (documentsContainer) {
            documentsContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                documentsContainer.classList.add('drag-over');
            });

            documentsContainer.addEventListener('dragleave', (e) => {
                if (!documentsContainer.contains(e.relatedTarget)) {
                    documentsContainer.classList.remove('drag-over');
                }
            });

            documentsContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                documentsContainer.classList.remove('drag-over');
                this.handleFileUpload(e.dataTransfer.files);
            });
        }
    }

    async loadDocuments() {
        try {
            // Load documents and folders from storage
            const documents = await storageManager.loadData('documents') || [];
            const storedFolders = await storageManager.loadData('folders') || {};
            
            // Merge stored folders with default folders
            Object.entries(storedFolders).forEach(([id, folder]) => {
                this.folders.set(id, folder);
            });
            
            // Auto-organize documents into appropriate folders if not already organized
            documents.forEach(doc => {
                if (!doc.folderId) {
                    doc.folderId = this.getAutoFolder(doc.type);
                }
            });
            
            this.allDocuments = documents;
            this.renderFolderTree();
            this.renderCurrentFolder();
            this.updateDocumentsCount();
        } catch (error) {
            console.error('Error loading documents:', error);
            app.showToast('Error loading documents', 'error');
        }
    }

    setupDragAndDrop() {
        const documentsContainer = document.getElementById('documents');
        
        if (documentsContainer) {
            // Global drag and drop for file uploads
            documentsContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer.types.includes('Files')) {
                    documentsContainer.classList.add('drag-over');
                }
            });

            documentsContainer.addEventListener('dragleave', (e) => {
                if (!documentsContainer.contains(e.relatedTarget)) {
                    documentsContainer.classList.remove('drag-over');
                }
            });

            documentsContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                documentsContainer.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(e.dataTransfer.files);
                }
            });
        }
        
        // Setup folder drop zones
        this.setupFolderDropZones();
    }
    
    setupFolderDropZones() {
        document.addEventListener('dragover', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                e.preventDefault();
                folderItem.classList.add('drag-over');
            }
        });
        
        document.addEventListener('dragleave', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem && !folderItem.contains(e.relatedTarget)) {
                folderItem.classList.remove('drag-over');
            }
        });
        
        document.addEventListener('drop', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                e.preventDefault();
                folderItem.classList.remove('drag-over');
                
                const folderId = folderItem.dataset.folderId;
                const documentId = e.dataTransfer.getData('text/plain');
                
                if (documentId && folderId) {
                    this.moveDocumentToFolder(documentId, folderId);
                }
            }
        });
    }
    
    async moveDocumentToFolder(documentId, folderId) {
        try {
            const document = await storageManager.getItem('documents', documentId);
            if (document && document.folderId !== folderId) {
                document.folderId = folderId;
                document.modified = new Date().toISOString();
                
                await storageManager.saveItem('documents', document);
                
                const folderName = this.folders.get(folderId)?.name || 'Unknown';
                app.showToast(`Moved "${document.name}" to "${folderName}"`, 'success');
                
                await this.loadDocuments();
            }
        } catch (error) {
            console.error('Error moving document:', error);
            app.showToast('Error moving document', 'error');
        }
    }

    async searchDocuments(query) {
        try {
            if (!query.trim()) {
                this.renderCurrentFolder();
                return;
            }
            
            const filteredDocuments = this.allDocuments.filter(doc => 
                (doc.name || '').toLowerCase().includes(query.toLowerCase()) ||
                (doc.description || '').toLowerCase().includes(query.toLowerCase())
            );
            
            this.renderSearchResults(filteredDocuments, query);
        } catch (error) {
            console.error('Error searching documents:', error);
        }
    }
    
    renderSearchResults(documents, query) {
        const emptyState = document.getElementById('documentsEmptyState');
        const gridContainer = document.getElementById('documentsGrid');
        const listContainer = document.getElementById('documentsList');
        
        // Update breadcrumb to show search
        const breadcrumb = document.getElementById('documentsBreadcrumb');
        if (breadcrumb) {
            breadcrumb.innerHTML = `
                <span class="breadcrumb-item" onclick="documentsModule.clearSearch()">All Documents</span>
                <i class="fas fa-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-item active">Search: "${query}"</span>
            `;
        }
        
        if (documents.length === 0) {
            emptyState.classList.remove('hidden');
            gridContainer.classList.add('hidden');
            listContainer.classList.add('hidden');
            
            // Update empty state message for search
            emptyState.innerHTML = `
                <div class="file-upload-area">
                    <i class="fas fa-search fa-4x"></i>
                    <h3>No Results Found</h3>
                    <p>No documents match your search for "${query}"</p>
                    <button class="btn-primary" onclick="documentsModule.clearSearch()">
                        <i class="fas fa-arrow-left"></i> Back to Documents
                    </button>
                </div>
            `;
            return;
        }
        
        emptyState.classList.add('hidden');
        
        // Sort search results
        const sortedDocuments = this.sortDocuments(documents, this.sortBy);
        
        if (this.viewMode === 'grid') {
            gridContainer.classList.remove('hidden');
            listContainer.classList.add('hidden');
            gridContainer.innerHTML = sortedDocuments.map(doc => this.renderDocumentCard(doc)).join('');
        } else {
            listContainer.classList.remove('hidden');
            gridContainer.classList.add('hidden');
            listContainer.innerHTML = sortedDocuments.map(doc => this.renderDocumentListItem(doc)).join('');
        }
    }
    
    clearSearch() {
        const searchInput = document.getElementById('documentsSearch');
        if (searchInput) searchInput.value = '';
        this.renderCurrentFolder();
    }

    async filterDocuments() {
        try {
            const filter = document.getElementById('documentsFilter').value;
            
            // Clear search when applying filter
            const searchInput = document.getElementById('documentsSearch');
            if (searchInput) searchInput.value = '';
            
            // Apply filter and re-render
            this.currentFilter = filter;
            this.renderCurrentFolder();
        } catch (error) {
            console.error('Error filtering documents:', error);
        }
    }
    
    getFilteredDocuments(documents) {
        if (!this.currentFilter) return documents;
        
        switch (this.currentFilter) {
            case 'pdf':
                return documents.filter(doc => doc.type === 'application/pdf');
            case 'doc':
                return documents.filter(doc => 
                    doc.type === 'application/msword' || 
                    doc.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    doc.type === 'text/plain'
                );
            case 'image':
                return documents.filter(doc => doc.type.startsWith('image/'));
            case 'spreadsheet':
                return documents.filter(doc => 
                    doc.type.includes('excel') || 
                    doc.type.includes('spreadsheet')
                );
            default:
                return documents;
        }
    }

    getAutoFolder(fileType) {
        if (fileType.startsWith('image/')) return 'images';
        if (fileType === 'application/pdf') return 'pdfs';
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'spreadsheets';
        return 'documents';
    }
    
    async saveFolders() {
        try {
            const foldersObj = {};
            this.folders.forEach((folder, id) => {
                if (id !== 'root') { // Don't save root folder structure
                    foldersObj[id] = folder;
                }
            });
            await storageManager.saveData('folders', foldersObj);
        } catch (error) {
            console.error('Error saving folders:', error);
        }
    }
    
    renderFolderTree() {
        const container = document.getElementById('folderTree');
        const rootHtml = this.renderFolderItem(this.folders.get('root'), 0);
        container.innerHTML = rootHtml;
    }
    
    renderFolderItem(folder, level) {
        const isSelected = this.currentFolder === folder.id;
        const hasChildren = folder.children && folder.children.length > 0;
        
        let html = `
            <div class="folder-item ${isSelected ? 'selected' : ''}" 
                 data-folder-id="${folder.id}" 
                 style="margin-left: ${level * 20}px"
                 onclick="documentsModule.selectFolder('${folder.id}')">
                <div class="folder-content">
                    ${hasChildren ? '<i class="fas fa-chevron-right folder-toggle" onclick="documentsModule.toggleFolder(event, \'${folder.id}\')"></i>' : '<span class="folder-spacer"></span>'}
                    <i class="${folder.id === 'root' ? 'fas fa-home' : 'fas fa-folder'}"></i>
                    <span class="folder-name">${folder.name}</span>
                    <span class="folder-count">${this.getDocumentCountInFolder(folder.id)}</span>
                </div>
                ${folder.id !== 'root' ? `
                    <div class="folder-actions">
                        <button class="folder-action" onclick="documentsModule.renameFolder(event, '${folder.id}')" title="Rename">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="folder-action" onclick="documentsModule.deleteFolder(event, '${folder.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
                </div>
            `;
        
        if (hasChildren && folder.expanded !== false) {
            folder.children.forEach(childId => {
                const childFolder = this.folders.get(childId);
                if (childFolder) {
                    html += this.renderFolderItem(childFolder, level + 1);
                }
            });
        }
        
        return html;
    }

    getDocumentCountInFolder(folderId) {
        if (folderId === 'root') {
            return this.allDocuments.length;
        }
        return this.allDocuments.filter(doc => doc.folderId === folderId).length;
    }
    
    renderCurrentFolder() {
        const documents = this.getDocumentsInCurrentFolder();
        const emptyState = document.getElementById('documentsEmptyState');
        const gridContainer = document.getElementById('documentsGrid');
        const listContainer = document.getElementById('documentsList');
        
        // Update breadcrumb
        this.updateBreadcrumb();
        
        if (documents.length === 0) {
            emptyState.classList.remove('hidden');
            gridContainer.classList.add('hidden');
            listContainer.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        if (this.viewMode === 'grid') {
            gridContainer.classList.remove('hidden');
            listContainer.classList.add('hidden');
            gridContainer.innerHTML = documents.map(doc => this.renderDocumentCard(doc)).join('');
        } else {
            listContainer.classList.remove('hidden');
            gridContainer.classList.add('hidden');
            listContainer.innerHTML = documents.map(doc => this.renderDocumentListItem(doc)).join('');
        }
    }
    
    getDocumentsInCurrentFolder() {
        let documents;
        if (this.currentFolder === 'root') {
            documents = [...this.allDocuments];
        } else {
            documents = this.allDocuments.filter(doc => doc.folderId === this.currentFolder);
        }
        
        // Apply filter
        documents = this.getFilteredDocuments(documents);
        
        // Apply sorting
        return this.sortDocuments(documents, this.sortBy);
    }
    
    sortDocuments(documents, sortBy) {
        return documents.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'date':
                    return new Date(b.modified || b.created) - new Date(a.modified || a.created);
                case 'size':
                    return b.size - a.size;
                case 'type':
                    return a.type.localeCompare(b.type);
                default:
                    return 0;
            }
        });
    }

    renderDocumentCard(document) {
        const timeAgo = this.getTimeAgo(new Date(document.modified || document.created));
        const fileSize = this.formatFileSize(document.size);
        const fileIcon = this.getFileIcon(document.type);
        const isImage = document.type.startsWith('image/');
        const isSelected = this.selectedItems.has(document.id);
        
        return `
            <div class="document-card ${isSelected ? 'selected' : ''}" 
                 data-id="${document.id}" 
                 draggable="true" 
                 ondragstart="documentsModule.handleDragStart(event, '${document.id}')"
                 onclick="documentsModule.selectDocument(event, '${document.id}')">
                <div class="document-header">
                    <div class="document-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="documentsModule.toggleSelection('${document.id}', this.checked)">
                        </div>
                    <div class="document-actions">
                        ${isImage ? `
                            <button class="doc-action" onclick="documentsModule.previewDocument(event, '${document.id}')" title="Preview">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                        <button class="doc-action" onclick="documentsModule.downloadDocument(event, '${document.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="doc-action" onclick="documentsModule.editDocument(event, '${document.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="doc-action text-error" onclick="documentsModule.deleteDocument(event, '${document.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="document-preview" onclick="documentsModule.previewDocument(event, '${document.id}')">
                ${isImage ? `
                        <img src="${document.data}" alt="${document.name}" class="document-thumbnail" />
                    ` : `
                        <div class="document-icon">
                            <i class="${fileIcon}"></i>
                    </div>
                    `}
                </div>
                
                <div class="document-info">
                    <div class="document-title" title="${document.name}">${document.name}</div>
                    <div class="document-meta">
                        <span class="type-badge ${this.getTypeBadgeClass(document.type)}">
                            ${this.getFileTypeLabel(document.type)}
                        </span>
                        <span class="file-size">${fileSize}</span>
                    </div>
                    <div class="document-date">${timeAgo}</div>
                </div>
            </div>
        `;
    }
    
    renderDocumentListItem(document) {
        const timeAgo = this.getTimeAgo(new Date(document.modified || document.created));
        const fileSize = this.formatFileSize(document.size);
        const fileIcon = this.getFileIcon(document.type);
        const isSelected = this.selectedItems.has(document.id);
        
        return `
            <div class="document-list-item ${isSelected ? 'selected' : ''}" 
                 data-id="${document.id}" 
                 draggable="true" 
                 ondragstart="documentsModule.handleDragStart(event, '${document.id}')"
                 onclick="documentsModule.selectDocument(event, '${document.id}')">
                <div class="list-item-content">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="documentsModule.toggleSelection('${document.id}', this.checked)">
                    <i class="${fileIcon} file-icon"></i>
                    <div class="file-details">
                        <div class="file-name">${document.name}</div>
                        <div class="file-meta">
                            <span class="type-badge ${this.getTypeBadgeClass(document.type)}">
                                ${this.getFileTypeLabel(document.type)}
                            </span>
                            <span>${fileSize}</span>
                            <span>${timeAgo}</span>
                    </div>
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="doc-action" onclick="documentsModule.downloadDocument(event, '${document.id}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="doc-action" onclick="documentsModule.editDocument(event, '${document.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="doc-action text-error" onclick="documentsModule.deleteDocument(event, '${document.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        const validFiles = Array.from(files).filter(file => this.validateFile(file));
        
        if (validFiles.length === 0) {
            app.showToast('No valid files selected', 'warning');
            return;
        }
        
        app.showToast(`Uploading ${validFiles.length} file(s)...`, 'info');
        
        for (const file of validFiles) {
            try {
                const fileData = await this.processFile(file);
                fileData.folderId = this.currentFolder === 'root' ? this.getAutoFolder(file.type) : this.currentFolder;
                await storageManager.saveItem('documents', fileData);
            } catch (error) {
                console.error('Error uploading file:', error);
                app.showToast(`Error uploading ${file.name}`, 'error');
            }
        }
        
        app.showToast('Files uploaded successfully', 'success');
        await this.loadDocuments();
        
        // Reset file input
        const fileInput = document.getElementById('documentUpload');
        if (fileInput) fileInput.value = '';
    }
    
    async processFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    id: cryptoManager.generateSecureId(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: reader.result,
                    description: '',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    validateFile(file) {
        if (!this.allowedTypes.includes(file.type)) {
            app.showToast(`File type not supported: ${file.name}`, 'error');
            return false;
        }
        
        if (file.size > this.maxFileSize) {
            app.showToast(`File too large: ${file.name} (max 10MB)`, 'error');
            return false;
        }
        
        return true;
    }

    // ===== FOLDER MANAGEMENT METHODS =====
    
    async createFolder() {
        const name = prompt('Enter folder name:');
        if (!name || !name.trim()) return;
        
        const id = cryptoManager.generateSecureId();
        const folder = {
            id,
            name: name.trim(),
            parent: this.currentFolder,
            children: [],
            created: new Date().toISOString()
        };
        
        this.folders.set(id, folder);
        
        // Add to parent's children
        const parent = this.folders.get(this.currentFolder);
        if (parent) {
            parent.children.push(id);
        }
        
        await this.saveFolders();
        this.renderFolderTree();
        app.showToast('Folder created successfully', 'success');
    }
    
    selectFolder(folderId) {
        this.currentFolder = folderId;
        this.selectedItems.clear();
        
        // Update UI
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.folderId === folderId);
        });
        
        this.renderCurrentFolder();
    }
    
    async renameFolder(event, folderId) {
        event.stopPropagation();
        
        const folder = this.folders.get(folderId);
        if (!folder) return;
        
        const newName = prompt('Enter new folder name:', folder.name);
        if (!newName || !newName.trim() || newName.trim() === folder.name) return;
        
        folder.name = newName.trim();
        await this.saveFolders();
        this.renderFolderTree();
        this.updateBreadcrumb();
        app.showToast('Folder renamed successfully', 'success');
    }
    
    async deleteFolder(event, folderId) {
        event.stopPropagation();
        
        const folder = this.folders.get(folderId);
        if (!folder) return;
        
        const documentsInFolder = this.allDocuments.filter(doc => doc.folderId === folderId);
        const hasSubfolders = folder.children && folder.children.length > 0;
        
        let message = `Are you sure you want to delete the folder "${folder.name}"?`;
        if (documentsInFolder.length > 0) {
            message += `\n\nThis will move ${documentsInFolder.length} document(s) to the parent folder.`;
        }
        if (hasSubfolders) {
            message += `\n\nThis folder contains subfolders that will also be moved.`;
        }
        
        if (!confirm(message)) return;
        
        // Move documents to parent folder
        documentsInFolder.forEach(doc => {
            doc.folderId = folder.parent || 'root';
        });
        
        // Move subfolders to parent
        if (hasSubfolders) {
            folder.children.forEach(childId => {
                const child = this.folders.get(childId);
                if (child) {
                    child.parent = folder.parent || 'root';
                    const parent = this.folders.get(child.parent);
                    if (parent && !parent.children.includes(childId)) {
                        parent.children.push(childId);
                    }
                }
            });
        }
        
        // Remove from parent's children
        const parent = this.folders.get(folder.parent);
        if (parent) {
            parent.children = parent.children.filter(id => id !== folderId);
        }
        
        // Delete folder
        this.folders.delete(folderId);
        
        // If we're currently in the deleted folder, go to parent
        if (this.currentFolder === folderId) {
            this.selectFolder(folder.parent || 'root');
        }
        
        await this.saveFolders();
        await storageManager.saveData('documents', this.allDocuments);
        this.renderFolderTree();
        this.renderCurrentFolder();
        app.showToast('Folder deleted successfully', 'success');
    }
    
    toggleFolder(event, folderId) {
        event.stopPropagation();
        
        const folder = this.folders.get(folderId);
        if (!folder) return;
        
        folder.expanded = !folder.expanded;
        this.renderFolderTree();
    }
    
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('documentsBreadcrumb');
        if (!breadcrumb) return;
        
        const path = this.getFolderPath(this.currentFolder);
        const breadcrumbHtml = path.map((folder, index) => {
            const isLast = index === path.length - 1;
            return `
                <span class="breadcrumb-item ${isLast ? 'active' : ''}" 
                      ${!isLast ? `onclick="documentsModule.selectFolder('${folder.id}')"` : ''}>
                    ${folder.name}
                </span>
                ${!isLast ? '<i class="fas fa-chevron-right breadcrumb-separator"></i>' : ''}
            `;
        }).join('');
        
        breadcrumb.innerHTML = breadcrumbHtml;
    }
    
    getFolderPath(folderId) {
        const path = [];
        let currentId = folderId;
        
        while (currentId) {
            const folder = this.folders.get(currentId);
            if (!folder) break;
            
            path.unshift(folder);
            currentId = folder.parent;
        }
        
        return path;
    }
    
    // ===== DOCUMENT MANAGEMENT METHODS =====
    
    async editDocument(event, id) {
        if (event) event.stopPropagation();
        
        try {
            const document = await storageManager.getItem('documents', id);
            if (document) {
                this.showDocumentEditor(document);
            }
        } catch (error) {
            console.error('Error loading document:', error);
            app.showToast('Error loading document', 'error');
        }
    }

    showDocumentEditor(document) {
        const folderOptions = this.generateFolderOptions(document.folderId);
        
        const editorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-edit"></i>
                    Edit Document Info
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="document-editor">
                <div class="form-group">
                    <label class="form-label">File Name</label>
                    <input type="text" id="documentName" class="form-input" value="${document.name}" readonly />
                    <small class="form-help">File name cannot be changed</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Folder</label>
                    <select id="documentFolder" class="form-select">
                        ${folderOptions}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea id="documentDescription" class="form-textarea" placeholder="Add a description for this document...">${document.description || ''}</textarea>
                </div>
                
                <div class="document-details">
                    <div class="detail-row">
                        <span class="detail-label">File Size:</span>
                        <span class="detail-value">${this.formatFileSize(document.size)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">File Type:</span>
                        <span class="detail-value">${this.getFileTypeLabel(document.type)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Uploaded:</span>
                        <span class="detail-value">${new Date(document.created).toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="documentsModule.saveDocumentInfo('${document.id}')">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(editorHtml);
        document.getElementById('documentDescription').focus();
    }
    
    generateFolderOptions(selectedFolderId) {
        let options = '';
        
        const addFolderOption = (folder, level = 0) => {
            const indent = '  '.repeat(level);
            const selected = folder.id === selectedFolderId ? 'selected' : '';
            options += `<option value="${folder.id}" ${selected}>${indent}${folder.name}</option>`;
            
            if (folder.children) {
                folder.children.forEach(childId => {
                    const child = this.folders.get(childId);
                    if (child) {
                        addFolderOption(child, level + 1);
                    }
                });
            }
        };
        
        // Add root folder and all its children
        addFolderOption(this.folders.get('root'));
        
        return options;
    }

    async saveDocumentInfo(id) {
        try {
            const document = await storageManager.getItem('documents', id);
            if (document) {
                const description = document.getElementById('documentDescription').value.trim();
                const folderId = document.getElementById('documentFolder').value;
                
                document.description = description;
                document.folderId = folderId;
                document.modified = new Date().toISOString();
                
                await storageManager.saveItem('documents', document);
                
                app.closeModal();
                app.showToast('Document info updated successfully', 'success');
                await this.loadDocuments();
            }
        } catch (error) {
            console.error('Error saving document info:', error);
            app.showToast('Error saving document info', 'error');
        }
    }

    async previewDocument(event, id) {
        if (event) event.stopPropagation();
        
        try {
            const document = await storageManager.getItem('documents', id);
            if (document) {
                if (document.type.startsWith('image/')) {
                    this.showImagePreview(document);
                } else if (document.type === 'application/pdf') {
                    this.showPdfPreview(document);
                } else {
                    app.showToast('Preview not available for this file type', 'info');
                }
            }
        } catch (error) {
            console.error('Error previewing document:', error);
            app.showToast('Error previewing document', 'error');
        }
    }

    showImagePreview(document) {
        const previewHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-image"></i>
                    ${document.name}
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="image-preview">
                <img src="${document.data}" alt="${document.name}" class="preview-image" />
                <div class="preview-actions">
                    <button class="btn-secondary" onclick="documentsModule.downloadDocument('${document.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(previewHtml);
    }

    showPdfPreview(document) {
        const previewHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-file-pdf"></i>
                    ${document.name}
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="pdf-preview">
                <iframe src="${document.data}" class="pdf-iframe"></iframe>
                <div class="preview-actions">
                    <button class="btn-secondary" onclick="documentsModule.downloadDocument('${document.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(previewHtml);
    }

    async downloadDocument(event, id) {
        if (event) event.stopPropagation();
        
        try {
            const document = await storageManager.getItem('documents', id);
            if (document) {
                const link = document.createElement('a');
                link.href = document.data;
                link.download = document.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                app.showToast('Download started', 'success');
            }
        } catch (error) {
            console.error('Error downloading document:', error);
            app.showToast('Error downloading document', 'error');
        }
    }

    async deleteDocument(event, id) {
        if (event) event.stopPropagation();
        
        if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('documents', id);
                this.selectedItems.delete(id);
                app.showToast('Document deleted successfully', 'success');
                await this.loadDocuments();
            } catch (error) {
                console.error('Error deleting document:', error);
                app.showToast('Error deleting document', 'error');
            }
        }
    }

    getFileIcon(type) {
        if (type.startsWith('image/')) return 'fas fa-image';
        if (type === 'application/pdf') return 'fas fa-file-pdf';
        if (type === 'application/msword' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') 
            return 'fas fa-file-word';
        if (type === 'application/vnd.ms-excel' || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') 
            return 'fas fa-file-excel';
        if (type === 'text/plain') return 'fas fa-file-alt';
        return 'fas fa-file';
    }

    getFileTypeLabel(type) {
        const typeMap = {
            'application/pdf': 'PDF',
            'application/msword': 'Word Document',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
            'text/plain': 'Text File',
            'image/jpeg': 'JPEG Image',
            'image/png': 'PNG Image',
            'image/gif': 'GIF Image',
            'image/webp': 'WebP Image',
            'application/vnd.ms-excel': 'Excel Spreadsheet',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet'
        };
        
        return typeMap[type] || 'Unknown';
    }

    getTypeBadgeClass(type) {
        if (type.startsWith('image/')) return 'type-image';
        if (type === 'application/pdf') return 'type-pdf';
        if (type.includes('word') || type === 'text/plain') return 'type-document';
        if (type.includes('excel')) return 'type-spreadsheet';
        return 'type-other';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

    // ===== UI INTERACTION METHODS =====
    
    selectDocument(event, id) {
        if (event.ctrlKey || event.metaKey) {
            // Multi-select with Ctrl/Cmd
            this.toggleSelection(id, !this.selectedItems.has(id));
        } else if (event.shiftKey && this.lastSelectedId) {
            // Range select with Shift
            this.selectRange(this.lastSelectedId, id);
        } else {
            // Single select
            this.selectedItems.clear();
            this.selectedItems.add(id);
            this.lastSelectedId = id;
        }
        
        this.updateSelectionUI();
    }
    
    toggleSelection(id, selected) {
        if (selected) {
            this.selectedItems.add(id);
            this.lastSelectedId = id;
        } else {
            this.selectedItems.delete(id);
        }
        this.updateSelectionUI();
    }
    
    updateSelectionUI() {
        // Update checkboxes and visual selection
        document.querySelectorAll('.document-card, .document-list-item').forEach(item => {
            const id = item.dataset.id;
            const isSelected = this.selectedItems.has(id);
            const checkbox = item.querySelector('input[type="checkbox"]');
            
            item.classList.toggle('selected', isSelected);
            if (checkbox) checkbox.checked = isSelected;
        });
    }
    
    changeViewMode(mode) {
        this.viewMode = mode;
        this.renderCurrentFolder();
    }
    
    sortDocuments(sortBy) {
        this.sortBy = sortBy;
        this.renderCurrentFolder();
    }
    
    updateDocumentsCount() {
        const countElement = document.getElementById('documentsCount');
        if (countElement) {
            const count = this.getDocumentCountInFolder(this.currentFolder);
            countElement.textContent = `${count} item${count !== 1 ? 's' : ''}`;
        }
    }
    
    // ===== DRAG AND DROP METHODS =====
    
    handleDragStart(event, id) {
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
        
        // If dragging a non-selected item, select it
        if (!this.selectedItems.has(id)) {
            this.selectedItems.clear();
            this.selectedItems.add(id);
            this.updateSelectionUI();
        }
    }
    
    handleKeyboardShortcuts(event) {
        // Ctrl+A - Select All
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            event.preventDefault();
            this.selectAll();
        }
        
        // Delete - Delete selected
        if (event.key === 'Delete' && this.selectedItems.size > 0) {
            event.preventDefault();
            this.deleteSelected();
        }
        
        // Escape - Clear selection
        if (event.key === 'Escape') {
            this.selectedItems.clear();
            this.updateSelectionUI();
        }
    }
    
    selectAll() {
        const documents = this.getDocumentsInCurrentFolder();
        documents.forEach(doc => this.selectedItems.add(doc.id));
        this.updateSelectionUI();
    }
    
    async deleteSelected() {
        if (this.selectedItems.size === 0) return;
        
        const count = this.selectedItems.size;
        if (!confirm(`Are you sure you want to delete ${count} document${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            for (const id of this.selectedItems) {
                await storageManager.deleteItem('documents', id);
            }
            
            this.selectedItems.clear();
            app.showToast(`${count} document${count > 1 ? 's' : ''} deleted successfully`, 'success');
            await this.loadDocuments();
        } catch (error) {
            console.error('Error deleting documents:', error);
            app.showToast('Error deleting documents', 'error');
    }
}

// Initialize documents module
window.documentsModule = new DocumentsModule();

// Additional CSS for documents module with folder support
const documentsStyles = `
/* Documents Manager Container */
.documents-manager-container {
    display: flex;
    height: calc(100vh - 200px);
    min-height: 600px;
    background: var(--bg-primary);
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
}

/* Documents Sidebar */
.documents-sidebar {
    width: 280px;
    min-width: 250px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
}

.documents-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-tertiary);
}

.documents-sidebar-header h2 {
    font-size: 1.2rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.sidebar-actions {
    display: flex;
    gap: 0.5rem;
}

.documents-sidebar-search {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.documents-sidebar-search input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
}

.documents-sidebar-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.85rem;
}

.documents-sidebar-controls select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.85rem;
}

.documents-count {
    color: var(--text-secondary);
    font-size: 0.8rem;
}

/* Folder Tree */
.folder-tree {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
}

.folder-item {
    position: relative;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-left: 3px solid transparent;
}

.folder-item:hover {
    background: var(--bg-tertiary);
}

.folder-item.selected {
    background: var(--primary-color);
    color: white;
    border-left-color: var(--primary-hover);
}

.folder-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
}

.folder-toggle {
    font-size: 0.7rem;
    cursor: pointer;
    transition: transform 0.2s ease;
}

.folder-toggle.expanded {
    transform: rotate(90deg);
}

.folder-spacer {
    width: 10px;
}

.folder-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.folder-count {
    font-size: 0.75rem;
    background: var(--border-color);
    color: var(--text-secondary);
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
}

.folder-item.selected .folder-count {
    background: rgba(255, 255, 255, 0.2);
    color: white;
}

.folder-actions {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: none;
    gap: 0.25rem;
}

.folder-item:hover .folder-actions {
    display: flex;
}

.folder-action {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 3px;
    transition: all 0.2s ease;
    font-size: 0.8rem;
}

.folder-action:hover {
    background: var(--bg-primary);
    color: var(--text-primary);
}

.folder-item.drag-over {
    background: rgba(107, 182, 255, 0.2);
    border-left-color: var(--primary-color);
}

.documents.drag-over {
    background: rgba(107, 182, 255, 0.05);
}

.documents.drag-over::before {
    content: "Drop files here to upload";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--primary-color);
    color: white;
    padding: 1rem 2rem;
    border-radius: var(--border-radius);
    font-size: 1.2rem;
    font-weight: 500;
    z-index: 1000;
    pointer-events: none;
}

/* Documents Main Area */
.documents-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
}

/* Documents Toolbar */
.documents-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    min-height: 50px;
}

.toolbar-left {
    flex: 1;
}

.toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.toolbar-right select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
}

/* Breadcrumb */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
}

.breadcrumb-item {
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.2s ease;
}

.breadcrumb-item:hover:not(.active) {
    color: var(--primary-color);
}

.breadcrumb-item.active {
    color: var(--text-primary);
    font-weight: 500;
    cursor: default;
}

.breadcrumb-separator {
    color: var(--text-muted);
    font-size: 0.7rem;
}

/* Documents Content */
.documents-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
}

/* Documents Grid */
.documents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
}

.document-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.document-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
}

.document-card.selected {
    border-color: var(--primary-color);
    background: rgba(107, 182, 255, 0.1);
}

.document-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
}

.document-checkbox input {
    cursor: pointer;
}

.document-actions {
    display: none;
    gap: 0.25rem;
}

.document-card:hover .document-actions {
    display: flex;
}

.doc-action {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 3px;
    transition: all 0.2s ease;
    font-size: 0.8rem;
}

.doc-action:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.document-preview {
    text-align: center;
    margin: 1rem 0;
    border-radius: var(--border-radius);
    overflow: hidden;
    background: var(--bg-tertiary);
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.document-thumbnail {
    max-width: 100%;
    max-height: 120px;
    border-radius: 4px;
}

.document-icon {
    font-size: 3rem;
    color: var(--text-muted);
}

.document-info {
    text-align: center;
}

.document-title {
    font-weight: 500;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    title: attr(title);
}

.document-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    flex-wrap: wrap;
}

.file-size {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.document-date {
    font-size: 0.75rem;
    color: var(--text-muted);
}

/* Documents List View */
.documents-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
}

.document-list-item {
    background: var(--bg-secondary);
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.document-list-item:hover {
    background: var(--bg-tertiary);
}

.document-list-item.selected {
    background: rgba(107, 182, 255, 0.1);
    border-left: 3px solid var(--primary-color);
}

.list-item-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
}

.file-icon {
    font-size: 1.5rem;
    color: var(--primary-color);
    width: 24px;
    text-align: center;
}

.file-details {
    flex: 1;
}

.file-name {
    font-weight: 500;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
}

.file-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
}

.list-item-actions {
    display: none;
    gap: 0.5rem;
}

.document-list-item:hover .list-item-actions {
    display: flex;
}

/* Empty State */
.documents-empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.file-upload-area {
    text-align: center;
    padding: 3rem;
    border: 2px dashed var(--border-color);
    border-radius: var(--border-radius);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.3s ease;
    background: var(--bg-secondary);
}

.file-upload-area:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: rgba(107, 182, 255, 0.05);
}

.file-upload-area i {
    margin-bottom: 1rem;
    opacity: 0.5;
}

.file-upload-area h3 {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
}

.file-upload-area p {
    margin-bottom: 2rem;
    color: var(--text-muted);
}

/* Responsive Design */
@media (max-width: 768px) {
    .documents-manager-container {
        flex-direction: column;
        height: calc(100vh - 120px);
    }
    
    .documents-sidebar {
        width: 100%;
        max-height: 40%;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
    }
    
    .documents-main {
        flex: 1;
    }
    
    .documents-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.75rem;
    }
    
    .document-card {
        padding: 0.75rem;
    }
    
    .file-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
    }
    
    .toolbar-right {
        gap: 0.25rem;
    }
    
    .file-upload-area {
        padding: 2rem 1rem;
    }
}

.document-editor {
    width: 500px;
    max-width: 90vw;
}

.form-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s ease;
}

.form-select:focus {
    border-color: var(--primary-color);
}

/* Legacy styles - these are replaced by the new styles above */

.type-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.type-image {
    background: #10b981;
    color: white;
}

.type-pdf {
    background: #ef4444;
    color: white;
}

.type-document {
    background: #3b82f6;
    color: white;
}

.type-spreadsheet {
    background: #10b981;
    color: white;
}

.type-other {
    background: var(--text-muted);
    color: white;
}

.document-details {
    background: var(--bg-tertiary);
    padding: 1rem;
    border-radius: var(--border-radius);
    margin: 1rem 0;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
}

.detail-row:last-child {
    margin-bottom: 0;
}

.detail-label {
    font-weight: 500;
    color: var(--text-secondary);
}

.detail-value {
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
}

.form-help {
    color: var(--text-muted);
    font-size: 0.8rem;
    margin-top: 0.25rem;
    display: block;
}

.image-preview {
    text-align: center;
    padding: 1rem;
}

.preview-image {
    max-width: 90vw;
    max-height: 70vh;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
}

.pdf-preview {
    width: 90vw;
    height: 80vh;
    display: flex;
    flex-direction: column;
}

.pdf-iframe {
    flex: 1;
    border: none;
    border-radius: var(--border-radius);
    background: white;
}

.preview-actions {
    margin-top: 1rem;
    text-align: center;
}

.file-upload-area {
    border: 2px dashed var(--border-color);
    border-radius: var(--border-radius);
    padding: 3rem 2rem;
    text-align: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.3s ease;
    background: var(--bg-secondary);
}

.file-upload-area:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: var(--bg-tertiary);
}

.file-upload-area.dragover {
    border-color: var(--primary-color);
    background: rgba(37, 99, 235, 0.1);
    color: var(--primary-color);
}

.file-upload-area i {
    margin-bottom: 1rem;
}

.file-upload-area h3 {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
}

.file-upload-area p {
    margin-bottom: 2rem;
    color: var(--text-muted);
}

.documents.drag-over {
    background: rgba(37, 99, 235, 0.05);
}

.documents.drag-over::before {
    content: "Drop files here to upload";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--primary-color);
    color: white;
    padding: 1rem 2rem;
    border-radius: var(--border-radius);
    font-size: 1.2rem;
    font-weight: 500;
    z-index: 1000;
    pointer-events: none;
}

@media (max-width: 768px) {
    .detail-row {
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .pdf-preview {
        width: 95vw;
        height: 70vh;
    }
    
    .preview-image {
        max-width: 95vw;
        max-height: 60vh;
    }
    
    .file-upload-area {
        padding: 2rem 1rem;
    }
}
`;

// Add documents styles to head
const documentsStyleSheet = document.createElement('style');
documentsStyleSheet.textContent = documentsStyles;
document.head.appendChild(documentsStyleSheet);