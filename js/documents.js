class DocumentsModule {
    constructor() {
        this.setupEventListeners();
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
            const documents = await storageManager.loadData('documents');
            const sortedDocuments = documents.sort((a, b) => 
                new Date(b.modified || b.created) - new Date(a.modified || a.created)
            );
            this.renderDocuments(sortedDocuments);
        } catch (error) {
            console.error('Error loading documents:', error);
            app.showToast('Error loading documents', 'error');
        }
    }

    async searchDocuments(query) {
        try {
            const documents = await storageManager.searchItems('documents', query, ['name', 'description']);
            this.renderDocuments(documents);
        } catch (error) {
            console.error('Error searching documents:', error);
        }
    }

    async filterDocuments() {
        try {
            const filter = document.getElementById('documentsFilter').value;
            let documents = await storageManager.loadData('documents');
            
            if (filter === 'pdf') {
                documents = documents.filter(doc => doc.type === 'application/pdf');
            } else if (filter === 'doc') {
                documents = documents.filter(doc => 
                    doc.type === 'application/msword' || 
                    doc.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    doc.type === 'text/plain'
                );
            } else if (filter === 'image') {
                documents = documents.filter(doc => doc.type.startsWith('image/'));
            }
            
            this.renderDocuments(documents);
        } catch (error) {
            console.error('Error filtering documents:', error);
        }
    }

    renderDocuments(documents) {
        const container = document.getElementById('documentsList');
        
        if (documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="file-upload-area" onclick="document.getElementById('documentUpload').click()">
                        <i class="fas fa-cloud-upload-alt fa-3x text-muted"></i>
                        <h3>No Documents Yet</h3>
                        <p>Upload your first document or drag & drop files here</p>
                        <button class="btn-primary">
                            <i class="fas fa-upload"></i> Upload Document
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = documents.map(document => this.renderDocumentCard(document)).join('');
    }

    renderDocumentCard(document) {
        const createdDate = new Date(document.created).toLocaleDateString();
        const timeAgo = this.getTimeAgo(new Date(document.modified || document.created));
        const fileSize = this.formatFileSize(document.size);
        const fileIcon = this.getFileIcon(document.type);
        const isImage = document.type.startsWith('image/');
        
        return `
            <div class="item-card document-card" data-id="${document.id}">
                <div class="item-header">
                    <div class="item-info">
                        <div class="item-title">
                            <i class="${fileIcon}"></i>
                            ${document.name}
                        </div>
                        <div class="item-meta">
                            ${fileSize} • ${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        ${isImage ? `
                            <button class="item-action" onclick="documentsModule.previewDocument('${document.id}')" title="Preview">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                        <button class="item-action" onclick="documentsModule.downloadDocument('${document.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="item-action" onclick="documentsModule.editDocument('${document.id}')" title="Edit Info">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action text-error" onclick="documentsModule.deleteDocument('${document.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                ${isImage ? `
                    <div class="document-preview" onclick="documentsModule.previewDocument('${document.id}')">
                        <img src="${document.data}" alt="${document.name}" class="document-thumbnail" />
                    </div>
                ` : ''}
                
                <div class="document-info">
                    <div class="document-type">
                        <span class="type-badge ${this.getTypeBadgeClass(document.type)}">
                            ${this.getFileTypeLabel(document.type)}
                        </span>
                    </div>
                </div>
                
                ${document.description ? `
                    <div class="item-content">
                        <strong>Description:</strong> ${document.description}
                    </div>
                ` : ''}
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
                await storageManager.saveFile(file);
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

    async editDocument(id) {
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

    async saveDocumentInfo(id) {
        try {
            const document = await storageManager.getItem('documents', id);
            if (document) {
                const description = document.getElementById('documentDescription').value.trim();
                
                document.description = description;
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

    async previewDocument(id) {
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

    async downloadDocument(id) {
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

    async deleteDocument(id) {
        if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('documents', id);
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

// Initialize documents module
window.documentsModule = new DocumentsModule();

// Additional CSS for documents module
const documentsStyles = `
.document-editor {
    width: 500px;
    max-width: 90vw;
}

.document-card {
    border-left: 4px solid var(--primary-color);
}

.document-card .item-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.document-card .item-title i {
    color: var(--primary-color);
}

.document-preview {
    margin: 1rem 0;
    text-align: center;
    cursor: pointer;
}

.document-thumbnail {
    max-width: 100%;
    max-height: 200px;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-sm);
    transition: transform 0.3s ease;
}

.document-thumbnail:hover {
    transform: scale(1.02);
}

.document-info {
    margin: 1rem 0;
}

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