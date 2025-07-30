class CreativeModule {
    constructor() {
        this.setupEventListeners();
        this.currentProject = null;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentTool = 'brush';
        this.currentColor = '#000000';
        this.currentBrushSize = 5;
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('creativeSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchProjects(e.target.value);
                }, 300);
            });
        }
    }

    async loadProjects() {
        try {
            const projects = await storageManager.loadData('creative');
            const sortedProjects = projects.sort((a, b) => 
                new Date(b.modified || b.created) - new Date(a.modified || a.created)
            );
            this.renderProjects(sortedProjects);
        } catch (error) {
            console.error('Error loading creative projects:', error);
            app.showToast('Error loading projects', 'error');
        }
    }

    async searchProjects(query) {
        try {
            const projects = await storageManager.searchItems('creative', query, ['title', 'description', 'tags']);
            this.renderProjects(projects);
        } catch (error) {
            console.error('Error searching projects:', error);
        }
    }

    renderProjects(projects) {
        const container = document.getElementById('creativeList');
        
        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-palette fa-3x text-muted"></i>
                    <h3>No Creative Projects Yet</h3>
                    <p>Create your first creative project to get started</p>
                    <button class="btn-primary" onclick="createCreativeProject()">
                        <i class="fas fa-plus"></i> New Project
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => this.renderProjectCard(project)).join('');
    }

    renderProjectCard(project) {
        const createdDate = new Date(project.created).toLocaleDateString();
        const timeAgo = this.getTimeAgo(new Date(project.modified || project.created));
        
        const typeColors = {
            sketch: '#8b5cf6',
            moodboard: '#10b981',
            design: '#3b82f6',
            inspiration: '#f59e0b'
        };
        
        const typeColor = typeColors[project.type] || '#64748b';
        const tags = project.tags || [];

        return `
            <div class="item-card creative-card" data-id="${project.id}">
                <div class="item-header">
                    <div class="item-info">
                        <div class="item-title">
                            <i class="fas fa-palette"></i>
                            ${project.title}
                        </div>
                        <div class="item-meta">
                            ${project.type} • ${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="item-action" onclick="creativeModule.editProject('${project.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action" onclick="creativeModule.duplicateProject('${project.id}')" title="Duplicate">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="item-action" onclick="creativeModule.exportProject('${project.id}')" title="Export">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="item-action text-error" onclick="creativeModule.deleteProject('${project.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                ${project.thumbnail ? `
                    <div class="project-thumbnail" onclick="creativeModule.editProject('${project.id}')">
                        <img src="${project.thumbnail}" alt="${project.title}" />
                    </div>
                ` : ''}
                
                <div class="project-meta">
                    <span class="project-type" style="background-color: ${typeColor};">
                        ${project.type.charAt(0).toUpperCase() + project.type.slice(1)}
                    </span>
                    
                    ${project.colorPalette && project.colorPalette.length > 0 ? `
                        <div class="color-palette-preview">
                            ${project.colorPalette.slice(0, 5).map(color => 
                                `<div class="color-swatch" style="background-color: ${color};" title="${color}"></div>`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
                
                ${project.description ? `
                    <div class="item-content">
                        ${project.description}
                    </div>
                ` : ''}
                
                ${tags.length > 0 ? `
                    <div class="item-tags">
                        ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async createCreativeProject() {
        this.showProjectTypeSelector();
    }

    showProjectTypeSelector() {
        const selectorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-palette"></i>
                    Create New Project
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="project-type-selector">
                <div class="type-options">
                    <div class="type-option" onclick="creativeModule.showProjectEditor('sketch')">
                        <i class="fas fa-paint-brush"></i>
                        <h4>Sketch/Drawing</h4>
                        <p>Create digital sketches and drawings with canvas tools</p>
                    </div>
                    
                    <div class="type-option" onclick="creativeModule.showProjectEditor('moodboard')">
                        <i class="fas fa-images"></i>
                        <h4>Mood Board</h4>
                        <p>Collect images, colors, and inspiration in one place</p>
                    </div>
                    
                    <div class="type-option" onclick="creativeModule.showProjectEditor('design')">
                        <i class="fas fa-drafting-compass"></i>
                        <h4>Design Project</h4>
                        <p>Plan and document design projects with notes and references</p>
                    </div>
                    
                    <div class="type-option" onclick="creativeModule.showProjectEditor('inspiration')">
                        <i class="fas fa-lightbulb"></i>
                        <h4>Inspiration Collection</h4>
                        <p>Gather links, notes, and ideas for future projects</p>
                    </div>
                </div>
            </div>
        `;
        
        app.showModal(selectorHtml);
    }

    async editProject(id) {
        try {
            const project = await storageManager.getItem('creative', id);
            if (project) {
                this.currentProject = project;
                this.showProjectEditor(project.type, project);
            }
        } catch (error) {
            console.error('Error loading project:', error);
            app.showToast('Error loading project', 'error');
        }
    }

    showProjectEditor(type, project = null) {
        const isEditing = project !== null;
        const title = project?.title || '';
        const description = project?.description || '';
        const tags = project?.tags || [];
        const colorPalette = project?.colorPalette || [];
        
        let typeSpecificContent = '';
        
        switch (type) {
            case 'sketch':
                typeSpecificContent = this.getSketchEditorContent(project);
                break;
            case 'moodboard':
                typeSpecificContent = this.getMoodboardEditorContent(project);
                break;
            case 'design':
                typeSpecificContent = this.getDesignEditorContent(project);
                break;
            case 'inspiration':
                typeSpecificContent = this.getInspirationEditorContent(project);
                break;
        }
        
        const editorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-palette"></i>
                    ${isEditing ? 'Edit' : 'Create'} ${type.charAt(0).toUpperCase() + type.slice(1)} Project
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="creative-editor" data-type="${type}">
                <div class="form-group">
                    <label class="form-label">Project Title *</label>
                    <input type="text" id="projectTitle" class="form-input" value="${title}" placeholder="Enter project title..." required />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea id="projectDescription" class="form-textarea" placeholder="Project description...">${description}</textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Tags (comma-separated)</label>
                    <input type="text" id="projectTags" class="form-input" value="${tags.join(', ')}" placeholder="abstract, digital, concept..." />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Color Palette</label>
                    <div class="color-palette-editor">
                        <div class="color-inputs" id="colorInputs">
                            ${colorPalette.map((color, index) => `
                                <div class="color-input-group">
                                    <input type="color" class="color-picker" value="${color}" />
                                    <input type="text" class="color-text" value="${color}" />
                                    <button type="button" class="btn-secondary" onclick="creativeModule.removeColor(${index})">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn-secondary" onclick="creativeModule.addColor()">
                            <i class="fas fa-plus"></i> Add Color
                        </button>
                    </div>
                </div>
                
                ${typeSpecificContent}
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="creativeModule.saveProject('${project?.id || ''}', '${type}')">
                        <i class="fas fa-save"></i> Save Project
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(editorHtml);
        document.getElementById('projectTitle').focus();
        
        // Initialize type-specific functionality
        this.initializeTypeSpecificEditor(type, project);
    }

    getSketchEditorContent(project) {
        return `
            <div class="form-group">
                <label class="form-label">Canvas</label>
                <div class="canvas-container">
                    <div class="canvas-toolbar">
                        <div class="tool-group">
                            <button class="tool-btn active" data-tool="brush" onclick="creativeModule.setTool('brush')">
                                <i class="fas fa-paint-brush"></i> Brush
                            </button>
                            <button class="tool-btn" data-tool="eraser" onclick="creativeModule.setTool('eraser')">
                                <i class="fas fa-eraser"></i> Eraser
                            </button>
                            <button class="tool-btn" data-tool="line" onclick="creativeModule.setTool('line')">
                                <i class="fas fa-minus"></i> Line
                            </button>
                        </div>
                        
                        <div class="tool-group">
                            <label>Color:</label>
                            <input type="color" id="canvasColor" class="color-picker" value="${this.currentColor}" />
                        </div>
                        
                        <div class="tool-group">
                            <label>Size:</label>
                            <input type="range" id="brushSize" min="1" max="50" value="${this.currentBrushSize}" class="brush-size" />
                            <span id="brushSizeValue">${this.currentBrushSize}</span>
                        </div>
                        
                        <div class="tool-group">
                            <button class="btn-secondary" onclick="creativeModule.clearCanvas()">
                                <i class="fas fa-trash"></i> Clear
                            </button>
                        </div>
                    </div>
                    <canvas id="sketchCanvas" width="600" height="400"></canvas>
                </div>
            </div>
        `;
    }

    getMoodboardEditorContent(project) {
        const images = project?.images || [];
        
        return `
            <div class="form-group">
                <label class="form-label">Images</label>
                <div class="moodboard-images">
                    <div class="image-upload-area" onclick="document.getElementById('moodboardImageUpload').click()">
                        <i class="fas fa-plus"></i>
                        <span>Add Image</span>
                        <input type="file" id="moodboardImageUpload" accept="image/*" multiple style="display: none;" />
                    </div>
                    <div class="images-grid" id="moodboardImagesGrid">
                        ${images.map((img, index) => `
                            <div class="moodboard-image">
                                <img src="${img}" alt="Moodboard image" />
                                <button class="remove-image" onclick="creativeModule.removeMoodboardImage(${index})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    getDesignEditorContent(project) {
        const references = project?.references || [];
        
        return `
            <div class="form-group">
                <label class="form-label">Design Notes</label>
                <div id="designNotes" class="design-notes-editor" contenteditable="true">${project?.designNotes || ''}</div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Reference Links</label>
                <div class="references-editor">
                    <div id="referencesList">
                        ${references.map((ref, index) => `
                            <div class="reference-input-row">
                                <input type="url" class="form-input" value="${ref.url}" placeholder="https://..." />
                                <input type="text" class="form-input" value="${ref.title}" placeholder="Reference title..." />
                                <button type="button" class="btn-secondary" onclick="creativeModule.removeReference(${index})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn-secondary" onclick="creativeModule.addReference()">
                        <i class="fas fa-plus"></i> Add Reference
                    </button>
                </div>
            </div>
        `;
    }

    getInspirationEditorContent(project) {
        const inspirations = project?.inspirations || [];
        
        return `
            <div class="form-group">
                <label class="form-label">Inspiration Items</label>
                <div class="inspirations-editor">
                    <div id="inspirationsList">
                        ${inspirations.map((item, index) => `
                            <div class="inspiration-item">
                                <div class="inspiration-header">
                                    <input type="text" class="form-input" value="${item.title}" placeholder="Inspiration title..." />
                                    <button type="button" class="btn-secondary" onclick="creativeModule.removeInspiration(${index})">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                                <textarea class="form-textarea" placeholder="Description or notes...">${item.description || ''}</textarea>
                                <input type="url" class="form-input" value="${item.url || ''}" placeholder="https://... (optional)" />
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn-secondary" onclick="creativeModule.addInspiration()">
                        <i class="fas fa-plus"></i> Add Inspiration
                    </button>
                </div>
            </div>
        `;
    }

    initializeTypeSpecificEditor(type, project) {
        switch (type) {
            case 'sketch':
                this.initializeCanvas(project);
                break;
            case 'moodboard':
                this.initializeMoodboard(project);
                break;
        }
    }

    initializeCanvas(project) {
        this.canvas = document.getElementById('sketchCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Load existing sketch if editing
        if (project && project.canvasData) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = project.canvasData;
        }
        
        // Setup canvas event listeners
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Setup tool controls
        document.getElementById('canvasColor').addEventListener('change', (e) => {
            this.currentColor = e.target.value;
        });
        
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.currentBrushSize = e.target.value;
            document.getElementById('brushSizeValue').textContent = e.target.value;
        });
    }

    initializeMoodboard(project) {
        const imageUpload = document.getElementById('moodboardImageUpload');
        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => {
                this.handleMoodboardImageUpload(e.target.files);
            });
        }
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.ctx.lineWidth = this.currentBrushSize;
        this.ctx.lineCap = 'round';
        
        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
        }
        
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.beginPath();
    }

    clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas?')) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    addColor() {
        const container = document.getElementById('colorInputs');
        const index = container.children.length;
        const colorDiv = document.createElement('div');
        colorDiv.className = 'color-input-group';
        colorDiv.innerHTML = `
            <input type="color" class="color-picker" value="#000000" />
            <input type="text" class="color-text" value="#000000" />
            <button type="button" class="btn-secondary" onclick="creativeModule.removeColor(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(colorDiv);
    }

    removeColor(index) {
        const container = document.getElementById('colorInputs');
        const colorGroups = container.children;
        if (colorGroups[index]) {
            container.removeChild(colorGroups[index]);
        }
    }

    addReference() {
        const container = document.getElementById('referencesList');
        const index = container.children.length;
        const refDiv = document.createElement('div');
        refDiv.className = 'reference-input-row';
        refDiv.innerHTML = `
            <input type="url" class="form-input" placeholder="https://..." />
            <input type="text" class="form-input" placeholder="Reference title..." />
            <button type="button" class="btn-secondary" onclick="creativeModule.removeReference(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(refDiv);
    }

    removeReference(index) {
        const container = document.getElementById('referencesList');
        const refs = container.children;
        if (refs[index]) {
            container.removeChild(refs[index]);
        }
    }

    addInspiration() {
        const container = document.getElementById('inspirationsList');
        const index = container.children.length;
        const inspDiv = document.createElement('div');
        inspDiv.className = 'inspiration-item';
        inspDiv.innerHTML = `
            <div class="inspiration-header">
                <input type="text" class="form-input" placeholder="Inspiration title..." />
                <button type="button" class="btn-secondary" onclick="creativeModule.removeInspiration(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <textarea class="form-textarea" placeholder="Description or notes..."></textarea>
            <input type="url" class="form-input" placeholder="https://... (optional)" />
        `;
        container.appendChild(inspDiv);
    }

    removeInspiration(index) {
        const container = document.getElementById('inspirationsList');
        const items = container.children;
        if (items[index]) {
            container.removeChild(items[index]);
        }
    }

    async handleMoodboardImageUpload(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.addMoodboardImage(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        }
    }

    addMoodboardImage(imageSrc) {
        const grid = document.getElementById('moodboardImagesGrid');
        const index = grid.children.length;
        const imageDiv = document.createElement('div');
        imageDiv.className = 'moodboard-image';
        imageDiv.innerHTML = `
            <img src="${imageSrc}" alt="Moodboard image" />
            <button class="remove-image" onclick="creativeModule.removeMoodboardImage(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        grid.appendChild(imageDiv);
    }

    removeMoodboardImage(index) {
        const grid = document.getElementById('moodboardImagesGrid');
        const images = grid.children;
        if (images[index]) {
            grid.removeChild(images[index]);
        }
    }

    async saveProject(id = '', type) {
        try {
            const title = document.getElementById('projectTitle').value.trim();
            const description = document.getElementById('projectDescription').value.trim();
            const tagsValue = document.getElementById('projectTags').value.trim();
            const tags = tagsValue ? tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            
            if (!title) {
                app.showToast('Please enter a project title', 'warning');
                return;
            }
            
            // Collect color palette
            const colorInputs = document.querySelectorAll('.color-picker');
            const colorPalette = Array.from(colorInputs).map(input => input.value);
            
            const projectData = {
                title,
                description,
                tags,
                type,
                colorPalette
            };
            
            // Collect type-specific data
            switch (type) {
                case 'sketch':
                    if (this.canvas) {
                        projectData.canvasData = this.canvas.toDataURL();
                        projectData.thumbnail = this.canvas.toDataURL();
                    }
                    break;
                    
                case 'moodboard':
                    const moodboardImages = Array.from(document.querySelectorAll('.moodboard-image img'))
                        .map(img => img.src);
                    projectData.images = moodboardImages;
                    if (moodboardImages.length > 0) {
                        projectData.thumbnail = moodboardImages[0];
                    }
                    break;
                    
                case 'design':
                    projectData.designNotes = document.getElementById('designNotes').innerHTML;
                    const referenceInputs = document.querySelectorAll('#referencesList .reference-input-row');
                    projectData.references = Array.from(referenceInputs).map(row => {
                        const inputs = row.querySelectorAll('input');
                        return {
                            url: inputs[0].value,
                            title: inputs[1].value
                        };
                    }).filter(ref => ref.url && ref.title);
                    break;
                    
                case 'inspiration':
                    const inspirationItems = document.querySelectorAll('.inspiration-item');
                    projectData.inspirations = Array.from(inspirationItems).map(item => {
                        const title = item.querySelector('input[type="text"]').value;
                        const description = item.querySelector('textarea').value;
                        const url = item.querySelector('input[type="url"]').value;
                        return { title, description, url };
                    }).filter(item => item.title);
                    break;
            }
            
            if (id) {
                projectData.id = id;
            }
            
            await storageManager.saveItem('creative', projectData);
            
            app.closeModal();
            app.showToast('Project saved successfully', 'success');
            await this.loadProjects();
            
            this.currentProject = null;
            
        } catch (error) {
            console.error('Error saving project:', error);
            app.showToast('Error saving project', 'error');
        }
    }

    async duplicateProject(id) {
        try {
            const project = await storageManager.getItem('creative', id);
            if (project) {
                const duplicatedProject = {
                    ...project,
                    id: undefined,
                    title: project.title + ' (Copy)'
                };
                
                await storageManager.saveItem('creative', duplicatedProject);
                app.showToast('Project duplicated successfully', 'success');
                await this.loadProjects();
            }
        } catch (error) {
            console.error('Error duplicating project:', error);
            app.showToast('Error duplicating project', 'error');
        }
    }

    async exportProject(id) {
        try {
            const project = await storageManager.getItem('creative', id);
            if (project) {
                const exportData = {
                    title: project.title,
                    type: project.type,
                    description: project.description,
                    tags: project.tags,
                    colorPalette: project.colorPalette,
                    created: project.created,
                    modified: project.modified
                };
                
                // Add type-specific data
                switch (project.type) {
                    case 'sketch':
                        exportData.canvasData = project.canvasData;
                        break;
                    case 'moodboard':
                        exportData.images = project.images;
                        break;
                    case 'design':
                        exportData.designNotes = project.designNotes;
                        exportData.references = project.references;
                        break;
                    case 'inspiration':
                        exportData.inspirations = project.inspirations;
                        break;
                }
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project.title.replace(/\s+/g, '_')}_creative_project.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                app.showToast('Project exported successfully', 'success');
            }
        } catch (error) {
            console.error('Error exporting project:', error);
            app.showToast('Error exporting project', 'error');
        }
    }

    async deleteProject(id) {
        if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('creative', id);
                app.showToast('Project deleted successfully', 'success');
                await this.loadProjects();
            } catch (error) {
                console.error('Error deleting project:', error);
                app.showToast('Error deleting project', 'error');
            }
        }
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
window.createCreativeProject = () => window.creativeModule.createCreativeProject();

// Initialize creative module
window.creativeModule = new CreativeModule();

// Additional CSS for creative module
const creativeStyles = `
.creative-editor {
    width: 800px;
    max-width: 95vw;
}

.project-type-selector {
    width: 600px;
    max-width: 90vw;
}

.type-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
}

.type-option {
    padding: 2rem;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
}

.type-option:hover {
    border-color: var(--primary-color);
    background: var(--bg-secondary);
}

.type-option i {
    font-size: 2rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
}

.type-option h4 {
    margin-bottom: 0.5rem;
    color: var(--text-primary);
}

.type-option p {
    color: var(--text-secondary);
    font-size: 0.9rem;
}

.creative-card {
    border-left: 4px solid var(--primary-color);
}

.creative-card .item-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.creative-card .item-title i {
    color: var(--primary-color);
}

.project-thumbnail {
    margin: 1rem 0;
    text-align: center;
    cursor: pointer;
}

.project-thumbnail img {
    max-width: 100%;
    max-height: 200px;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-sm);
    transition: transform 0.3s ease;
}

.project-thumbnail img:hover {
    transform: scale(1.02);
}

.project-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
    flex-wrap: wrap;
}

.project-type {
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.color-palette-preview {
    display: flex;
    gap: 0.25rem;
}

.color-swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    cursor: pointer;
}

.color-palette-editor {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    background: var(--bg-tertiary);
}

.color-inputs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.color-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.color-text {
    width: 100px;
    font-family: 'Courier New', monospace;
}

.canvas-container {
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    background: white;
    overflow: hidden;
}

.canvas-toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
}

.tool-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.tool-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.3s ease;
}

.tool-btn:hover {
    background: var(--bg-tertiary);
}

.tool-btn.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}

.brush-size {
    width: 100px;
}

#sketchCanvas {
    display: block;
    cursor: crosshair;
}

.moodboard-images {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    background: var(--bg-tertiary);
}

.image-upload-area {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 150px;
    height: 150px;
    border: 2px dashed var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 1rem;
}

.image-upload-area:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
}

.image-upload-area i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
}

.moodboard-image {
    position: relative;
    width: 150px;
    height: 150px;
    border-radius: var(--border-radius);
    overflow: hidden;
}

.moodboard-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.remove-image {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.moodboard-image:hover .remove-image {
    opacity: 1;
}

.design-notes-editor {
    min-height: 200px;
    max-height: 400px;
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

.design-notes-editor:focus {
    border-color: var(--primary-color);
}

.references-editor,
.inspirations-editor {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    background: var(--bg-tertiary);
}

.reference-input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.reference-input-row:last-child {
    margin-bottom: 0;
}

.reference-input-row .form-input:first-child {
    flex: 2;
}

.reference-input-row .form-input:nth-child(2) {
    flex: 1;
}

.inspiration-item {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    margin-bottom: 1rem;
    background: var(--bg-secondary);
}

.inspiration-item:last-child {
    margin-bottom: 0;
}

.inspiration-header {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.inspiration-header .form-input {
    flex: 1;
}

.inspiration-item .form-textarea {
    margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
    .type-options {
        grid-template-columns: 1fr;
    }
    
    .canvas-toolbar {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .tool-group {
        flex-wrap: wrap;
    }
    
    .reference-input-row {
        flex-direction: column;
    }
    
    .inspiration-header {
        flex-direction: column;
    }
    
    .color-input-group {
        flex-wrap: wrap;
    }
    
    .images-grid {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }
    
    .moodboard-image {
        width: 120px;
        height: 120px;
    }
}
`;

// Add creative styles to head
const creativeStyleSheet = document.createElement('style');
creativeStyleSheet.textContent = creativeStyles;
document.head.appendChild(creativeStyleSheet);