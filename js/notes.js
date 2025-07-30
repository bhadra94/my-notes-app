class NotesModule {
    constructor() {
        this.currentNote = null;
        this.autoSaveTimeout = null;
        this.autoSaveDelay = 2000; // 2 seconds
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('notesSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchNotes(e.target.value);
                }, 300);
            });
        }

        // Sort functionality
        const sortSelect = document.getElementById('notesSortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.loadNotes();
            });
        }
    }

    async loadNotes() {
        try {
            const notes = await storageManager.loadData('notes');
            const sortBy = document.getElementById('notesSortBy')?.value || 'modified';
            
            // Sort notes
            const sortedNotes = notes.sort((a, b) => {
                switch (sortBy) {
                    case 'title':
                        return (a.title || '').localeCompare(b.title || '');
                    case 'created':
                        return new Date(b.created) - new Date(a.created);
                    case 'modified':
                    default:
                        return new Date(b.modified || b.created) - new Date(a.modified || a.created);
                }
            });

            this.renderNotes(sortedNotes);
        } catch (error) {
            console.error('Error loading notes:', error);
            app.showToast('Error loading notes', 'error');
        }
    }

    async searchNotes(query) {
        try {
            const notes = await storageManager.searchItems('notes', query, ['title', 'content', 'tags']);
            this.renderNotes(notes);
        } catch (error) {
            console.error('Error searching notes:', error);
        }
    }

    renderNotes(notes) {
        const container = document.getElementById('notesList');
        
        if (notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sticky-note fa-3x text-muted"></i>
                    <h3>No Notes Yet</h3>
                    <p>Create your first note to get started</p>
                    <button class="btn-primary" onclick="createNote()">
                        <i class="fas fa-plus"></i> Create Note
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = notes.map(note => this.renderNoteCard(note)).join('');
    }

    renderNoteCard(note) {
        const createdDate = new Date(note.created).toLocaleDateString();
        const modifiedDate = new Date(note.modified || note.created).toLocaleDateString();
        const timeAgo = this.getTimeAgo(new Date(note.modified || note.created));
        
        const tags = note.tags || [];
        const tagsHtml = tags.length > 0 ? 
            `<div class="item-tags">
                ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>` : '';

        const preview = note.content ? 
            note.content.replace(/<[^>]*>/g, '').substring(0, 150) + 
            (note.content.length > 150 ? '...' : '') : 
            'No content';

        return `
            <div class="item-card note-card" data-id="${note.id}">
                <div class="item-header">
                    <div class="item-info">
                        <div class="item-title">${note.title || 'Untitled Note'}</div>
                        <div class="item-meta">
                            Created: ${createdDate} • Modified: ${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="item-action" onclick="notesModule.editNote('${note.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action" onclick="notesModule.exportNote('${note.id}')" title="Export">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="item-action" onclick="notesModule.duplicateNote('${note.id}')" title="Duplicate">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="item-action text-error" onclick="notesModule.deleteNote('${note.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="item-content" onclick="notesModule.editNote('${note.id}')">
                    ${preview}
                </div>
                ${tagsHtml}
            </div>
        `;
    }

    async createNote() {
        this.showNoteEditor();
    }

    async editNote(id) {
        try {
            const note = await storageManager.getItem('notes', id);
            if (note) {
                this.currentNote = note;
                this.showNoteEditor(note);
            }
        } catch (error) {
            console.error('Error loading note:', error);
            app.showToast('Error loading note', 'error');
        }
    }

    showNoteEditor(note = null) {
        const isEditing = note !== null;
        const title = note?.title || '';
        const content = note?.content || '';
        const tags = note?.tags || [];
        
        const editorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-sticky-note"></i>
                    ${isEditing ? 'Edit Note' : 'New Note'}
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="note-editor">
                <div class="form-group">
                    <label class="form-label">Title</label>
                    <input type="text" id="noteTitle" class="form-input" value="${title}" placeholder="Enter note title..." />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Tags (comma-separated)</label>
                    <input type="text" id="noteTags" class="form-input" value="${tags.join(', ')}" placeholder="tag1, tag2, tag3..." />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Content</label>
                    <div class="editor-toolbar">
                        <button type="button" class="btn-secondary" onclick="notesModule.formatText('bold')">
                            <i class="fas fa-bold"></i>
                        </button>
                        <button type="button" class="btn-secondary" onclick="notesModule.formatText('italic')">
                            <i class="fas fa-italic"></i>
                        </button>
                        <button type="button" class="btn-secondary" onclick="notesModule.formatText('underline')">
                            <i class="fas fa-underline"></i>
                        </button>
                        <button type="button" class="btn-secondary" onclick="notesModule.formatText('insertUnorderedList')">
                            <i class="fas fa-list-ul"></i>
                        </button>
                        <button type="button" class="btn-secondary" onclick="notesModule.formatText('insertOrderedList')">
                            <i class="fas fa-list-ol"></i>
                        </button>
                        <button type="button" class="btn-secondary" onclick="notesModule.insertLink()">
                            <i class="fas fa-link"></i>
                        </button>
                    </div>
                    <div id="noteContent" class="note-content-editor" contenteditable="true">${content}</div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="notesModule.saveNote()">
                        <i class="fas fa-save"></i> Save Note
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(editorHtml);
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Focus on title if new note, content if editing
        if (isEditing) {
            document.getElementById('noteContent').focus();
        } else {
            document.getElementById('noteTitle').focus();
        }
    }

    setupAutoSave() {
        const titleInput = document.getElementById('noteTitle');
        const contentEditor = document.getElementById('noteContent');
        const tagsInput = document.getElementById('noteTags');
        
        const autoSave = () => {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = setTimeout(() => {
                this.autoSaveNote();
            }, this.autoSaveDelay);
        };
        
        if (titleInput) titleInput.addEventListener('input', autoSave);
        if (contentEditor) contentEditor.addEventListener('input', autoSave);
        if (tagsInput) tagsInput.addEventListener('input', autoSave);
    }

    async autoSaveNote() {
        if (!this.currentNote) return;
        
        try {
            const title = document.getElementById('noteTitle')?.value || '';
            const content = document.getElementById('noteContent')?.innerHTML || '';
            const tagsValue = document.getElementById('noteTags')?.value || '';
            const tags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag);
            
            const updatedNote = {
                ...this.currentNote,
                title,
                content,
                tags,
                modified: new Date().toISOString()
            };
            
            await storageManager.saveItem('notes', updatedNote);
            
            // Show subtle indication of auto-save
            const indicator = document.createElement('div');
            indicator.textContent = 'Auto-saved';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: var(--success-color);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                font-size: 0.8rem;
                z-index: 10001;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            document.body.appendChild(indicator);
            setTimeout(() => indicator.style.opacity = '1', 100);
            setTimeout(() => {
                indicator.style.opacity = '0';
                setTimeout(() => document.body.removeChild(indicator), 300);
            }, 1000);
            
        } catch (error) {
            console.error('Auto-save error:', error);
        }
    }

    async saveNote() {
        try {
            const title = document.getElementById('noteTitle').value.trim();
            const content = document.getElementById('noteContent').innerHTML.trim();
            const tagsValue = document.getElementById('noteTags').value.trim();
            const tags = tagsValue ? tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            
            if (!title && !content) {
                app.showToast('Please enter a title or content', 'warning');
                return;
            }
            
            const noteData = {
                title: title || 'Untitled Note',
                content,
                tags
            };
            
            if (this.currentNote) {
                noteData.id = this.currentNote.id;
            }
            
            await storageManager.saveItem('notes', noteData);
            
            app.closeModal();
            app.showToast('Note saved successfully', 'success');
            await this.loadNotes();
            
            this.currentNote = null;
            
        } catch (error) {
            console.error('Error saving note:', error);
            app.showToast('Error saving note', 'error');
        }
    }

    async deleteNote(id) {
        if (confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('notes', id);
                app.showToast('Note deleted successfully', 'success');
                await this.loadNotes();
            } catch (error) {
                console.error('Error deleting note:', error);
                app.showToast('Error deleting note', 'error');
            }
        }
    }

    async duplicateNote(id) {
        try {
            const note = await storageManager.getItem('notes', id);
            if (note) {
                const duplicatedNote = {
                    title: (note.title || 'Untitled Note') + ' (Copy)',
                    content: note.content,
                    tags: [...(note.tags || [])]
                };
                
                await storageManager.saveItem('notes', duplicatedNote);
                app.showToast('Note duplicated successfully', 'success');
                await this.loadNotes();
            }
        } catch (error) {
            console.error('Error duplicating note:', error);
            app.showToast('Error duplicating note', 'error');
        }
    }

    async exportNote(id) {
        try {
            const note = await storageManager.getItem('notes', id);
            if (note) {
                const exportData = {
                    title: note.title,
                    content: note.content?.replace(/<[^>]*>/g, '') || '', // Strip HTML
                    tags: note.tags || [],
                    created: note.created,
                    modified: note.modified
                };
                
                const exportText = `# ${exportData.title}\n\n${exportData.content}\n\nTags: ${exportData.tags.join(', ')}\nCreated: ${new Date(exportData.created).toLocaleString()}\nModified: ${new Date(exportData.modified).toLocaleString()}`;
                
                const blob = new Blob([exportText], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${note.title || 'note'}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                app.showToast('Note exported successfully', 'success');
            }
        } catch (error) {
            console.error('Error exporting note:', error);
            app.showToast('Error exporting note', 'error');
        }
    }

    formatText(command) {
        document.execCommand(command, false, null);
        document.getElementById('noteContent').focus();
    }

    insertLink() {
        const url = prompt('Enter URL:');
        if (url) {
            const selection = window.getSelection();
            const text = selection.toString() || url;
            document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${text}</a>`);
        }
        document.getElementById('noteContent').focus();
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

// Global functions for HTML onclick handlers
window.createNote = () => window.notesModule.createNote();

// Initialize notes module
window.notesModule = new NotesModule();

// Additional CSS for note editor
const noteEditorStyles = `
.note-editor {
    width: 600px;
    max-width: 90vw;
}

.editor-toolbar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius);
    flex-wrap: wrap;
}

.editor-toolbar button {
    padding: 0.5rem;
    min-width: 36px;
    font-size: 0.9rem;
}

.note-content-editor {
    min-height: 300px;
    max-height: 500px;
    overflow-y: auto;
    padding: 1rem;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
    line-height: 1.6;
    outline: none;
}

.note-content-editor:focus {
    border-color: var(--primary-color);
}

.note-content-editor p {
    margin-bottom: 1rem;
}

.note-content-editor ul,
.note-content-editor ol {
    margin-left: 2rem;
    margin-bottom: 1rem;
}

.note-content-editor a {
    color: var(--primary-color);
    text-decoration: underline;
}

.note-content-editor blockquote {
    border-left: 4px solid var(--border-color);
    margin-left: 0;
    padding-left: 1rem;
    color: var(--text-secondary);
}

.empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
}

.empty-state i {
    margin-bottom: 1rem;
}

.empty-state h3 {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
}

.empty-state p {
    margin-bottom: 2rem;
}

.note-card {
    cursor: pointer;
}

.note-card .item-content {
    cursor: pointer;
}
`;

// Add note editor styles to head
const noteStyleSheet = document.createElement('style');
noteStyleSheet.textContent = noteEditorStyles;
document.head.appendChild(noteStyleSheet);