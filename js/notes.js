class NotesModule {
    constructor() {
        this.currentNote = null;
        this.autoSaveTimeout = null;
        this.autoSaveDelay = 1500; // 1.5 seconds
        this.allNotes = [];
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

        // Auto-save on editor changes
        this.setupAutoSave();
        
        // Setup swipe functionality
        this.setupSwipeFunctionality();
    }

    async loadNotes() {
        try {
            const notes = await storageManager.loadData('notes');
            const sortBy = document.getElementById('notesSortBy')?.value || 'modified';
            
            // Sort notes
            this.allNotes = notes.sort((a, b) => {
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

            this.renderNotesList(this.allNotes);
            this.updateNotesCount(this.allNotes.length);
        } catch (error) {
            console.error('Error loading notes:', error);
            app.showToast('Error loading notes', 'error');
        }
    }

    async searchNotes(query) {
        try {
            if (!query.trim()) {
                this.renderNotesList(this.allNotes);
                return;
            }
            
            const filteredNotes = this.allNotes.filter(note => 
                (note.title || '').toLowerCase().includes(query.toLowerCase()) ||
                (note.content || '').toLowerCase().includes(query.toLowerCase()) ||
                (note.tags || []).some(tag => tag.toLowerCase().includes(query.toLowerCase()))
            );
            
            this.renderNotesList(filteredNotes);
        } catch (error) {
            console.error('Error searching notes:', error);
        }
    }

    renderNotesList(notes) {
        const container = document.getElementById('notesList');
        
        if (notes.length === 0) {
            container.innerHTML = `
                <div class="notes-list-empty">
                    <i class="fas fa-sticky-note"></i>
                    <p>No notes found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = notes.map(note => this.renderNoteListItem(note)).join('');
        
        // Reset any active swipes when list is refreshed
        this.resetActiveSwipes();
    }

    renderNoteListItem(note) {
        const timeAgo = this.getTimeAgo(new Date(note.modified || note.created));
        const isSelected = this.currentNote && this.currentNote.id === note.id;
        
        const preview = note.content ? 
            note.content.replace(/<[^>]*>/g, '').substring(0, 80) + 
            (note.content.replace(/<[^>]*>/g, '').length > 80 ? '...' : '') : 
            'No additional text';

        return `
            <div class="note-list-item ${isSelected ? 'selected' : ''}" 
                 data-id="${note.id}" 
                 data-note-id="${note.id}">
                <div class="note-list-item-content" onclick="notesModule.selectNote('${note.id}')">
                    <div class="note-list-title">${note.title || 'Untitled Note'}</div>
                    <div class="note-list-time">${timeAgo}</div>
                    <div class="note-list-preview">${preview}</div>
                </div>
                <button class="note-delete-button" onclick="notesModule.showDeleteConfirmation('${note.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    updateNotesCount(count) {
        const countElement = document.getElementById('notesCount');
        if (countElement) {
            countElement.textContent = `${count} note${count !== 1 ? 's' : ''}`;
        }
    }

    async createNote() {
        try {
            // Create a new note with default values
            const newNote = {
                title: '',
                content: '',
                tags: []
            };
            
            const savedNote = await storageManager.saveItem('notes', newNote);
            
            // Add to our local notes array and refresh the list
            await this.loadNotes();
            
            // Select the new note
            this.selectNote(savedNote.id);
            
            // Focus on the title input
            const titleInput = document.getElementById('noteTitle');
            if (titleInput) {
                titleInput.focus();
            }
            
        } catch (error) {
            console.error('Error creating note:', error);
            app.showToast('Error creating note', 'error');
        }
    }

    async selectNote(id) {
        try {
            const note = await storageManager.getItem('notes', id);
            if (note) {
                this.currentNote = note;
                this.showNoteInEditor(note);
                this.renderNotesList(this.allNotes); // Refresh to show selection
            }
        } catch (error) {
            console.error('Error loading note:', error);
            app.showToast('Error loading note', 'error');
        }
    }

    showNoteInEditor(note) {
        // Hide empty state and show editor
        const emptyState = document.getElementById('notesEmptyState');
        const editor = document.getElementById('notesEditor');
        
        if (emptyState) emptyState.classList.add('hidden');
        if (editor) editor.classList.remove('hidden');
        
        // Populate the editor fields
        const titleInput = document.getElementById('noteTitle');
        const tagsInput = document.getElementById('noteTags');
        const contentEditor = document.getElementById('noteContent');
        
        if (titleInput) titleInput.value = note.title || '';
        if (tagsInput) tagsInput.value = (note.tags || []).join(', ');
        if (contentEditor) contentEditor.innerHTML = note.content || '';
        
        // Setup auto-save for this note
        this.setupAutoSave();
    }
    
    hideNoteEditor() {
        // Show empty state and hide editor
        const emptyState = document.getElementById('notesEmptyState');
        const editor = document.getElementById('notesEditor');
        
        if (emptyState) emptyState.classList.remove('hidden');
        if (editor) editor.classList.add('hidden');
        
        this.currentNote = null;
        this.renderNotesList(this.allNotes); // Refresh to remove selection
    }

    setupAutoSave() {
        // Remove existing listeners to avoid duplicates
        const titleInput = document.getElementById('noteTitle');
        const contentEditor = document.getElementById('noteContent');
        const tagsInput = document.getElementById('noteTags');
        
        const autoSave = () => {
            if (!this.currentNote) return;
            
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = setTimeout(() => {
                this.autoSaveNote();
            }, this.autoSaveDelay);
        };
        
        // Add event listeners for auto-save
        if (titleInput) {
            titleInput.removeEventListener('input', autoSave);
            titleInput.addEventListener('input', autoSave);
        }
        if (contentEditor) {
            contentEditor.removeEventListener('input', autoSave);
            contentEditor.addEventListener('input', autoSave);
        }
        if (tagsInput) {
            tagsInput.removeEventListener('input', autoSave);
            tagsInput.addEventListener('input', autoSave);
        }
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
        if (!this.currentNote) return;
        
        try {
            const title = document.getElementById('noteTitle')?.value?.trim() || '';
            const content = document.getElementById('noteContent')?.innerHTML?.trim() || '';
            const tagsValue = document.getElementById('noteTags')?.value?.trim() || '';
            const tags = tagsValue ? tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            
            const noteData = {
                id: this.currentNote.id,
                title: title || 'Untitled Note',
                content,
                tags
            };
            
            const savedNote = await storageManager.saveItem('notes', noteData);
            this.currentNote = savedNote;
            
            // Update the notes list to reflect changes
            await this.loadNotes();
            
        } catch (error) {
            console.error('Error saving note:', error);
            app.showToast('Error saving note', 'error');
        }
    }

    // New toolbar methods
    async exportCurrentNote() {
        if (!this.currentNote) {
            app.showToast('No note selected', 'warning');
            return;
        }
        await this.exportNote(this.currentNote.id);
    }

    async deleteCurrentNote() {
        if (!this.currentNote) {
            app.showToast('No note selected', 'warning');
            return;
        }
        
        this.showDeleteConfirmation(this.currentNote.id);
    }

    async shareNote() {
        if (!this.currentNote) {
            app.showToast('No note selected', 'warning');
            return;
        }
        
        const shareText = `${this.currentNote.title || 'Untitled Note'}\n\n${this.currentNote.content?.replace(/<[^>]*>/g, '') || ''}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: this.currentNote.title || 'Untitled Note',
                    text: shareText
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error sharing:', error);
                    this.fallbackShare(shareText);
                }
            }
        } else {
            this.fallbackShare(shareText);
        }
    }

    fallbackShare(text) {
        navigator.clipboard.writeText(text).then(() => {
            app.showToast('Note copied to clipboard', 'success');
        }).catch(() => {
            app.showToast('Unable to share note', 'error');
        });
    }

    async deleteNote(id) {
        this.showDeleteConfirmation(id);
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

    // Swipe-to-Delete Functionality
    setupSwipeFunctionality() {
        this.swipeThreshold = 80;
        this.swipeTimeout = null;
        this.activeSwipe = null;
        
        // Add touch event listeners to the notes list
        const notesList = document.getElementById('notesList');
        if (notesList) {
            notesList.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            notesList.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            notesList.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
            
            // Add keyboard support for accessibility
            notesList.addEventListener('keydown', this.handleKeyDown.bind(this));
        }
    }

    handleTouchStart(e) {
        const noteItem = e.target.closest('.note-list-item');
        if (!noteItem) return;

        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now();
        this.activeSwipe = noteItem;
        
        // Add swiping class to prevent transitions during swipe
        noteItem.classList.add('swiping');
    }

    handleTouchMove(e) {
        if (!this.activeSwipe) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = Math.abs(touch.clientY - this.touchStartY);
        
        // Only allow horizontal swipes with minimal vertical movement
        if (Math.abs(deltaX) < Math.abs(deltaY) * 2) return;
        
        e.preventDefault();
        
        // Limit swipe to left direction only
        if (deltaX > 0) return;
        
        const swipeDistance = Math.min(Math.abs(deltaX), this.swipeThreshold);
        const transform = `translateX(-${swipeDistance}px)`;
        
        this.activeSwipe.style.transform = transform;
        this.activeSwipe.querySelector('.note-list-item-content').style.transform = transform;
    }

    handleTouchEnd(e) {
        if (!this.activeSwipe) return;
        
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const swipeTime = Date.now() - this.touchStartTime;
        
        // Remove swiping class
        this.activeSwipe.classList.remove('swiping');
        
        // Determine if swipe should be completed
        const shouldComplete = Math.abs(deltaX) > this.swipeThreshold / 2 || 
                             (Math.abs(deltaX) > 30 && swipeTime < 300);
        
        if (shouldComplete && deltaX < 0) {
            // Complete the swipe
            this.activeSwipe.classList.add('swiped');
            this.activeSwipe.style.transform = '';
            this.activeSwipe.querySelector('.note-list-item-content').style.transform = '';
            
            // Add haptic feedback
            this.triggerHapticFeedback();
        } else {
            // Reset the swipe
            this.activeSwipe.style.transform = '';
            this.activeSwipe.querySelector('.note-list-item-content').style.transform = '';
        }
        
        this.activeSwipe = null;
    }

    handleKeyDown(e) {
        const noteItem = e.target.closest('.note-list-item');
        if (!noteItem) return;
        
        const noteId = noteItem.getAttribute('data-note-id');
        if (!noteId) return;
        
        // Handle Delete key for keyboard users
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.showDeleteConfirmation(noteId);
        }
        
        // Handle Enter key to select note
        if (e.key === 'Enter') {
            e.preventDefault();
            this.selectNote(noteId);
        }
    }

    triggerHapticFeedback() {
        // Simulate haptic feedback with CSS animation
        const noteItem = this.activeSwipe;
        if (noteItem) {
            noteItem.classList.add('haptic-feedback');
            setTimeout(() => {
                noteItem.classList.remove('haptic-feedback');
            }, 100);
        }
        
        // Try to use native haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }

    resetActiveSwipes() {
        // Reset any active swipes
        const swipedItems = document.querySelectorAll('.note-list-item.swiped');
        swipedItems.forEach(item => {
            item.classList.remove('swiped');
            item.style.transform = '';
            const content = item.querySelector('.note-list-item-content');
            if (content) {
                content.style.transform = '';
            }
        });
        
        // Clear active swipe reference
        this.activeSwipe = null;
    }

    // Delete Confirmation Methods
    showDeleteConfirmation(noteId) {
        const note = this.allNotes.find(n => n.id === noteId);
        if (!note) return;

        const overlay = document.createElement('div');
        overlay.className = 'delete-confirmation-overlay';
        overlay.innerHTML = `
            <div class="delete-confirmation-dialog">
                <div class="delete-confirmation-header">
                    <div class="delete-confirmation-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3 class="delete-confirmation-title">Delete Note</h3>
                </div>
                <p class="delete-confirmation-message">
                    Are you sure you want to delete "<strong>${note.title || 'Untitled Note'}</strong>"? 
                    This action cannot be undone.
                </p>
                <div class="delete-confirmation-actions">
                    <button class="btn-secondary" onclick="notesModule.hideDeleteConfirmation()">
                        Cancel
                    </button>
                    <button class="btn-danger" onclick="notesModule.confirmDeleteNote('${noteId}')">
                        Delete
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        // Add haptic feedback
        this.triggerHapticFeedback();
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideDeleteConfirmation();
            }
        });
    }

    hideDeleteConfirmation() {
        const overlay = document.querySelector('.delete-confirmation-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    async confirmDeleteNote(noteId) {
        try {
            // Hide confirmation dialog
            this.hideDeleteConfirmation();
            
            // Store note for potential undo
            const noteToDelete = this.allNotes.find(n => n.id === noteId);
            if (!noteToDelete) return;
            
            // Delete the note
            await storageManager.deleteItem('notes', noteId);
            
            // Show undo toast
            this.showUndoToast(noteToDelete);
            
            // Refresh notes list
            await this.loadNotes();
            
            // If the deleted note was selected, hide the editor
            if (this.currentNote && this.currentNote.id === noteId) {
                this.hideNoteEditor();
            }
            
        } catch (error) {
            console.error('Error deleting note:', error);
            app.showToast('Error deleting note', 'error');
        }
    }

    showUndoToast(deletedNote) {
        const toast = document.createElement('div');
        toast.className = 'undo-toast';
        toast.innerHTML = `
            <div>
                <div class="undo-toast-message">Note deleted</div>
                <div class="undo-toast-timer">Undo available for 3 seconds</div>
            </div>
            <button class="undo-toast-button" onclick="notesModule.undoDeleteNote('${deletedNote.id}')">
                Undo
            </button>
        `;

        document.body.appendChild(toast);
        
        // Auto-remove toast after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
        
        // Update timer countdown
        let timeLeft = 3;
        const timerElement = toast.querySelector('.undo-toast-timer');
        const countdown = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = `Undo available for ${timeLeft} second${timeLeft !== 1 ? 's' : ''}`;
            }
            if (timeLeft <= 0) {
                clearInterval(countdown);
                if (toast.parentNode) {
                    toast.remove();
                }
            }
        }, 1000);
        
        // Store the deleted note for potential undo
        this.deletedNote = deletedNote;
        this.undoTimeout = setTimeout(() => {
            this.deletedNote = null;
        }, 3000);
    }

    async undoDeleteNote(noteId) {
        if (!this.deletedNote) return;
        
        try {
            // Restore the note
            await storageManager.saveItem('notes', this.deletedNote);
            
            // Remove undo toast
            const toast = document.querySelector('.undo-toast');
            if (toast) {
                toast.remove();
            }
            
            // Clear undo timeout
            if (this.undoTimeout) {
                clearTimeout(this.undoTimeout);
                this.undoTimeout = null;
            }
            
            // Refresh notes list
            await this.loadNotes();
            
            // Show success message
            app.showToast('Note restored', 'success');
            
            // Clear deleted note reference
            this.deletedNote = null;
            
        } catch (error) {
            console.error('Error restoring note:', error);
            app.showToast('Error restoring note', 'error');
        }
    }

    // Enhanced delete method with animation
    async deleteNoteWithAnimation(noteId) {
        const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (!noteElement) return;

        // Add slide-out animation
        noteElement.style.animation = 'slideOut 0.3s ease-out forwards';
        
        // Wait for animation to complete
        setTimeout(async () => {
            try {
                await storageManager.deleteItem('notes', noteId);
                await this.loadNotes();
                
                // If the deleted note was selected, hide the editor
                if (this.currentNote && this.currentNote.id === noteId) {
                    this.hideNoteEditor();
                }
            } catch (error) {
                console.error('Error deleting note:', error);
                app.showToast('Error deleting note', 'error');
            }
        }, 300);
    }
}

// Global functions for HTML onclick handlers
window.createNote = () => window.notesModule.createNote();

// Initialize notes module
window.notesModule = new NotesModule();

// Additional CSS for Notes App Layout
const noteEditorStyles = `
/* Notes App Container */
.notes-app-container {
    display: flex;
    height: calc(100vh - 200px);
    min-height: 600px;
    background: var(--bg-primary);
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
}

/* Left Sidebar */
.notes-sidebar {
    width: 300px;
    min-width: 250px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
}

.notes-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-tertiary);
}

.notes-sidebar-header h2 {
    font-size: 1.2rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-icon {
    width: 32px;
    height: 32px;
    border: none;
    background: var(--primary-color);
    color: white;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.btn-icon:hover {
    background: var(--primary-hover);
}

.notes-sidebar-search {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.notes-sidebar-search input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
}

.notes-sidebar-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.85rem;
}

.notes-sidebar-controls select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.85rem;
}

.notes-count {
    color: var(--text-secondary);
    font-size: 0.8rem;
}

/* Notes List */
.notes-list {
    flex: 1;
    overflow-y: auto;
}

.note-list-item {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.note-list-item:hover {
    background: var(--bg-tertiary);
}

.note-list-item.selected {
    background: var(--primary-color);
    color: white;
}

.note-list-item.selected .note-list-time {
    color: rgba(255, 255, 255, 0.8);
}

.note-list-item.selected .note-list-preview {
    color: rgba(255, 255, 255, 0.7);
}

.note-list-title {
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.note-list-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.note-list-preview {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.notes-list-empty {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
}

.notes-list-empty i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
}

/* Main Content Area */
.notes-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
}

/* Top Toolbar */
.notes-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    min-height: 50px;
}

.toolbar-left,
.toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.toolbar-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9rem;
}

.toolbar-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.toolbar-btn:active {
    background: var(--border-color);
}

.toolbar-separator {
    width: 1px;
    height: 20px;
    background: var(--border-color);
    margin: 0 0.5rem;
}

/* Editor Container */
.notes-editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Empty State */
.notes-empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-muted);
    padding: 3rem;
}

.notes-empty-state i {
    margin-bottom: 1.5rem;
    opacity: 0.5;
}

.notes-empty-state h3 {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-weight: 600;
}

.notes-empty-state p {
    margin-bottom: 2rem;
    font-size: 0.9rem;
}

/* Note Editor */
.notes-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.note-title-container {
    padding: 1.5rem 2rem 0;
}

.note-title-input {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 2rem;
    font-weight: 700;
    padding: 0;
    margin: 0;
    outline: none;
    font-family: inherit;
}

.note-title-input::placeholder {
    color: var(--text-muted);
    font-weight: 400;
}

.note-tags-container {
    padding: 0.5rem 2rem;
}

.note-tags-input {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.9rem;
    padding: 0;
    margin: 0;
    outline: none;
    font-family: inherit;
}

.note-tags-input::placeholder {
    color: var(--text-muted);
}

.note-content-container {
    flex: 1;
    padding: 1rem 2rem 2rem;
    overflow: hidden;
}

.note-content-editor {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.6;
    outline: none;
    overflow-y: auto;
    resize: none;
}

.note-content-editor[contenteditable]:empty::before {
    content: attr(placeholder);
    color: var(--text-muted);
    pointer-events: none;
    position: absolute;
}

/* Content Formatting */
.note-content-editor p {
    margin-bottom: 1rem;
}

.note-content-editor h1,
.note-content-editor h2,
.note-content-editor h3 {
    margin: 1.5rem 0 1rem;
    font-weight: 600;
}

.note-content-editor ul,
.note-content-editor ol {
    margin-left: 1.5rem;
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
    font-style: italic;
}

/* Responsive Design */
@media (max-width: 768px) {
    .notes-app-container {
        height: calc(100vh - 120px);
        flex-direction: column;
    }
    
    .notes-sidebar {
        width: 100%;
        max-height: 40%;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
    }
    
    .notes-main {
        flex: 1;
    }
    
    .toolbar-left,
    .toolbar-right {
        gap: 0.1rem;
    }
    
    .note-title-input {
        font-size: 1.5rem;
    }
    
    .note-content-container {
        padding: 1rem;
    }
}
`;

// Add note editor styles to head
const noteStyleSheet = document.createElement('style');
noteStyleSheet.textContent = noteEditorStyles;
document.head.appendChild(noteStyleSheet);