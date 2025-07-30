class TodosModule {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('todosSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchTodos(e.target.value);
                }, 300);
            });
        }

        // Filter functionality
        const filterSelect = document.getElementById('todosFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                this.filterTodos();
            });
        }

        // Priority filter
        const prioritySelect = document.getElementById('todosPriority');
        if (prioritySelect) {
            prioritySelect.addEventListener('change', () => {
                this.filterTodos();
            });
        }
    }

    async loadTodos() {
        try {
            const todos = await storageManager.loadData('todos');
            const sortedTodos = todos.sort((a, b) => {
                // Sort by completion status first, then by priority, then by due date
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const aPriority = priorityOrder[a.priority] || 0;
                const bPriority = priorityOrder[b.priority] || 0;
                
                if (aPriority !== bPriority) {
                    return bPriority - aPriority;
                }
                
                if (a.dueDate && b.dueDate) {
                    return new Date(a.dueDate) - new Date(b.dueDate);
                }
                
                return new Date(b.created) - new Date(a.created);
            });
            
            this.renderTodos(sortedTodos);
        } catch (error) {
            console.error('Error loading todos:', error);
            app.showToast('Error loading todos', 'error');
        }
    }

    async searchTodos(query) {
        try {
            const todos = await storageManager.searchItems('todos', query, ['title', 'description', 'category']);
            this.renderTodos(todos);
        } catch (error) {
            console.error('Error searching todos:', error);
        }
    }

    async filterTodos() {
        try {
            const filter = document.getElementById('todosFilter').value;
            const priority = document.getElementById('todosPriority').value;
            let todos = await storageManager.loadData('todos');
            
            // Apply status filter
            if (filter === 'completed') {
                todos = todos.filter(todo => todo.completed);
            } else if (filter === 'pending') {
                todos = todos.filter(todo => !todo.completed);
            } else if (filter === 'overdue') {
                const now = new Date();
                todos = todos.filter(todo => 
                    !todo.completed && 
                    todo.dueDate && 
                    new Date(todo.dueDate) < now
                );
            }
            
            // Apply priority filter
            if (priority) {
                todos = todos.filter(todo => todo.priority === priority);
            }
            
            this.renderTodos(todos);
        } catch (error) {
            console.error('Error filtering todos:', error);
        }
    }

    renderTodos(todos) {
        const container = document.getElementById('todosList');
        
        if (todos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks fa-3x text-muted"></i>
                    <h3>No Tasks Yet</h3>
                    <p>Create your first task to get started</p>
                    <button class="btn-primary" onclick="createTodo()">
                        <i class="fas fa-plus"></i> New Task
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = todos.map(todo => this.renderTodoCard(todo)).join('');
    }

    renderTodoCard(todo) {
        const createdDate = new Date(todo.created).toLocaleDateString();
        const timeAgo = this.getTimeAgo(new Date(todo.modified || todo.created));
        
        const priorityColors = {
            high: '#ef4444',
            medium: '#f59e0b',
            low: '#10b981'
        };
        
        const priorityColor = priorityColors[todo.priority] || '#64748b';
        
        // Check if overdue
        const isOverdue = todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date();
        const dueDateFormatted = todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : null;
        
        const subtasks = todo.subtasks || [];
        const completedSubtasks = subtasks.filter(st => st.completed).length;
        const subtaskProgress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

        return `
            <div class="item-card todo-card ${todo.completed ? 'status-completed' : ''} ${isOverdue ? 'status-overdue' : ''} priority-${todo.priority}" data-id="${todo.id}">
                <div class="item-header">
                    <div class="item-info">
                        <div class="todo-title-row">
                            <label class="todo-checkbox">
                                <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                                       onchange="todosModule.toggleTodoComplete('${todo.id}', this.checked)" />
                                <span class="checkmark"></span>
                            </label>
                            <div class="item-title ${todo.completed ? 'completed-task' : ''}">
                                ${todo.title}
                            </div>
                        </div>
                        <div class="item-meta">
                            ${todo.category ? `${todo.category} • ` : ''}
                            ${dueDateFormatted ? `Due: ${dueDateFormatted} • ` : ''}
                            ${timeAgo}
                        </div>
                    </div>
                    <div class="item-actions">
                        ${!todo.completed ? `
                            <button class="item-action" onclick="todosModule.markUrgent('${todo.id}')" title="Mark Urgent">
                                <i class="fas fa-exclamation"></i>
                            </button>
                        ` : ''}
                        <button class="item-action" onclick="todosModule.editTodo('${todo.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="item-action" onclick="todosModule.duplicateTodo('${todo.id}')" title="Duplicate">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="item-action text-error" onclick="todosModule.deleteTodo('${todo.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                ${todo.description ? `
                    <div class="item-content">
                        ${todo.description}
                    </div>
                ` : ''}
                
                <div class="todo-meta">
                    <div class="todo-priority">
                        <span class="priority-indicator" style="background-color: ${priorityColor};">
                            ${todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)} Priority
                        </span>
                    </div>
                    
                    ${isOverdue ? `
                        <div class="overdue-indicator">
                            <i class="fas fa-clock text-error"></i>
                            Overdue
                        </div>
                    ` : ''}
                    
                    ${todo.recurring ? `
                        <div class="recurring-indicator">
                            <i class="fas fa-redo"></i>
                            ${todo.recurring}
                        </div>
                    ` : ''}
                </div>
                
                ${subtasks.length > 0 ? `
                    <div class="subtasks-section">
                        <div class="subtasks-header">
                            <span class="subtasks-title">
                                <i class="fas fa-list"></i>
                                Subtasks (${completedSubtasks}/${subtasks.length})
                            </span>
                            <div class="subtask-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${subtaskProgress}%;"></div>
                                </div>
                                <span class="progress-text">${Math.round(subtaskProgress)}%</span>
                            </div>
                        </div>
                        <div class="subtasks-list">
                            ${subtasks.map((subtask, index) => `
                                <div class="subtask-item ${subtask.completed ? 'completed' : ''}">
                                    <label class="subtask-checkbox">
                                        <input type="checkbox" ${subtask.completed ? 'checked' : ''} 
                                               onchange="todosModule.toggleSubtaskComplete('${todo.id}', ${index}, this.checked)" />
                                        <span class="checkmark"></span>
                                    </label>
                                    <span class="subtask-text">${subtask.text}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async createTodo() {
        this.showTodoEditor();
    }

    async editTodo(id) {
        try {
            const todo = await storageManager.getItem('todos', id);
            if (todo) {
                this.showTodoEditor(todo);
            }
        } catch (error) {
            console.error('Error loading todo:', error);
            app.showToast('Error loading todo', 'error');
        }
    }

    showTodoEditor(todo = null) {
        const isEditing = todo !== null;
        const title = todo?.title || '';
        const description = todo?.description || '';
        const dueDate = todo?.dueDate || '';
        const priority = todo?.priority || 'medium';
        const category = todo?.category || '';
        const recurring = todo?.recurring || '';
        const subtasks = todo?.subtasks || [];
        
        const editorHtml = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-tasks"></i>
                    ${isEditing ? 'Edit Task' : 'New Task'}
                </h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="todo-editor">
                <div class="form-group">
                    <label class="form-label">Task Title *</label>
                    <input type="text" id="todoTitle" class="form-input" value="${title}" placeholder="Enter task title..." required />
                </div>
                
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea id="todoDescription" class="form-textarea" placeholder="Task description...">${description}</textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Due Date</label>
                        <input type="datetime-local" id="todoDueDate" class="form-input" value="${dueDate}" />
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select id="todoPriority" class="form-select">
                            <option value="low" ${priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <input type="text" id="todoCategory" class="form-input" value="${category}" placeholder="Work, Personal, etc." />
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Recurring</label>
                        <select id="todoRecurring" class="form-select">
                            <option value="" ${recurring === '' ? 'selected' : ''}>None</option>
                            <option value="daily" ${recurring === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${recurring === 'weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="monthly" ${recurring === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="yearly" ${recurring === 'yearly' ? 'selected' : ''}>Yearly</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Subtasks</label>
                    <div class="subtasks-editor">
                        <div id="subtasksList">
                            ${subtasks.map((subtask, index) => `
                                <div class="subtask-input-row">
                                    <input type="text" class="form-input subtask-input" value="${subtask.text}" placeholder="Subtask..." />
                                    <button type="button" class="btn-secondary" onclick="todosModule.removeSubtask(${index})">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn-secondary" onclick="todosModule.addSubtask()">
                            <i class="fas fa-plus"></i> Add Subtask
                        </button>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="todosModule.saveTodo('${todo?.id || ''}')">
                        <i class="fas fa-save"></i> Save Task
                    </button>
                </div>
            </div>
        `;
        
        app.showModal(editorHtml);
        document.getElementById('todoTitle').focus();
    }

    addSubtask() {
        const container = document.getElementById('subtasksList');
        const index = container.children.length;
        
        const subtaskRow = document.createElement('div');
        subtaskRow.className = 'subtask-input-row';
        subtaskRow.innerHTML = `
            <input type="text" class="form-input subtask-input" placeholder="Subtask..." />
            <button type="button" class="btn-secondary" onclick="todosModule.removeSubtask(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(subtaskRow);
        subtaskRow.querySelector('input').focus();
    }

    removeSubtask(index) {
        const container = document.getElementById('subtasksList');
        const subtaskRows = container.children;
        if (subtaskRows[index]) {
            container.removeChild(subtaskRows[index]);
        }
    }

    async saveTodo(id = '') {
        try {
            const title = document.getElementById('todoTitle').value.trim();
            const description = document.getElementById('todoDescription').value.trim();
            const dueDate = document.getElementById('todoDueDate').value;
            const priority = document.getElementById('todoPriority').value;
            const category = document.getElementById('todoCategory').value.trim();
            const recurring = document.getElementById('todoRecurring').value;
            
            if (!title) {
                app.showToast('Please enter a task title', 'warning');
                return;
            }
            
            // Collect subtasks
            const subtaskInputs = document.querySelectorAll('.subtask-input');
            const subtasks = Array.from(subtaskInputs)
                .map(input => input.value.trim())
                .filter(text => text)
                .map(text => ({ text, completed: false }));
            
            const todoData = {
                title,
                description,
                dueDate,
                priority,
                category,
                recurring,
                subtasks,
                completed: false
            };
            
            if (id) {
                // Preserve existing completion status and subtask completion
                const existingTodo = await storageManager.getItem('todos', id);
                if (existingTodo) {
                    todoData.completed = existingTodo.completed;
                    // Preserve subtask completion status where possible
                    if (existingTodo.subtasks) {
                        todoData.subtasks.forEach((subtask, index) => {
                            const existingSubtask = existingTodo.subtasks.find(st => st.text === subtask.text);
                            if (existingSubtask) {
                                subtask.completed = existingSubtask.completed;
                            }
                        });
                    }
                }
                todoData.id = id;
            }
            
            await storageManager.saveItem('todos', todoData);
            
            app.closeModal();
            app.showToast('Task saved successfully', 'success');
            await this.loadTodos();
            
        } catch (error) {
            console.error('Error saving todo:', error);
            app.showToast('Error saving task', 'error');
        }
    }

    async toggleTodoComplete(id, completed) {
        try {
            const todo = await storageManager.getItem('todos', id);
            if (todo) {
                todo.completed = completed;
                
                // If completing a recurring task, create next instance
                if (completed && todo.recurring && todo.recurring !== '') {
                    await this.createRecurringInstance(todo);
                }
                
                await storageManager.saveItem('todos', todo);
                await this.loadTodos();
                
                app.showToast(completed ? 'Task completed!' : 'Task reopened', 'success');
            }
        } catch (error) {
            console.error('Error toggling todo completion:', error);
            app.showToast('Error updating task', 'error');
        }
    }

    async toggleSubtaskComplete(todoId, subtaskIndex, completed) {
        try {
            const todo = await storageManager.getItem('todos', todoId);
            if (todo && todo.subtasks && todo.subtasks[subtaskIndex]) {
                todo.subtasks[subtaskIndex].completed = completed;
                await storageManager.saveItem('todos', todo);
                await this.loadTodos();
            }
        } catch (error) {
            console.error('Error toggling subtask completion:', error);
            app.showToast('Error updating subtask', 'error');
        }
    }

    async createRecurringInstance(originalTodo) {
        const nextDueDate = this.calculateNextDueDate(originalTodo.dueDate, originalTodo.recurring);
        
        const newTodo = {
            ...originalTodo,
            id: undefined, // Will get new ID
            completed: false,
            dueDate: nextDueDate,
            subtasks: originalTodo.subtasks.map(st => ({ ...st, completed: false }))
        };
        
        await storageManager.saveItem('todos', newTodo);
    }

    calculateNextDueDate(currentDueDate, recurring) {
        if (!currentDueDate) return '';
        
        const date = new Date(currentDueDate);
        
        switch (recurring) {
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                return currentDueDate;
        }
        
        return date.toISOString().slice(0, 16); // Format for datetime-local input
    }

    async markUrgent(id) {
        try {
            const todo = await storageManager.getItem('todos', id);
            if (todo) {
                todo.priority = 'high';
                await storageManager.saveItem('todos', todo);
                await this.loadTodos();
                app.showToast('Task marked as high priority', 'success');
            }
        } catch (error) {
            console.error('Error marking todo urgent:', error);
            app.showToast('Error updating task priority', 'error');
        }
    }

    async duplicateTodo(id) {
        try {
            const todo = await storageManager.getItem('todos', id);
            if (todo) {
                const duplicatedTodo = {
                    ...todo,
                    id: undefined,
                    title: todo.title + ' (Copy)',
                    completed: false,
                    subtasks: todo.subtasks ? todo.subtasks.map(st => ({ ...st, completed: false })) : []
                };
                
                await storageManager.saveItem('todos', duplicatedTodo);
                app.showToast('Task duplicated successfully', 'success');
                await this.loadTodos();
            }
        } catch (error) {
            console.error('Error duplicating todo:', error);
            app.showToast('Error duplicating task', 'error');
        }
    }

    async deleteTodo(id) {
        if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            try {
                await storageManager.deleteItem('todos', id);
                app.showToast('Task deleted successfully', 'success');
                await this.loadTodos();
            } catch (error) {
                console.error('Error deleting todo:', error);
                app.showToast('Error deleting task', 'error');
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
window.createTodo = () => window.todosModule.createTodo();

// Initialize todos module
window.todosModule = new TodosModule();

// Additional CSS for todos module
const todosStyles = `
.todo-editor {
    width: 700px;
    max-width: 90vw;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.todo-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.todo-checkbox {
    position: relative;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
}

.todo-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
}

.todo-checkbox .checkmark {
    position: relative;
    display: inline-block;
    height: 20px;
    width: 20px;
    background-color: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    transition: all 0.3s ease;
}

.todo-checkbox:hover .checkmark {
    background-color: var(--bg-tertiary);
}

.todo-checkbox input:checked ~ .checkmark {
    background-color: var(--success-color);
    border-color: var(--success-color);
}

.todo-checkbox .checkmark:after {
    content: "";
    position: absolute;
    display: none;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

.todo-checkbox input:checked ~ .checkmark:after {
    display: block;
}

.completed-task {
    text-decoration: line-through;
    opacity: 0.7;
}

.todo-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

.priority-indicator {
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.overdue-indicator {
    color: var(--error-color);
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.recurring-indicator {
    color: var(--text-secondary);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.subtasks-section {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius);
}

.subtasks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
}

.subtasks-title {
    font-weight: 500;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.subtask-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.progress-bar {
    width: 80px;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--success-color);
    transition: width 0.3s ease;
}

.progress-text {
    font-size: 0.8rem;
    color: var(--text-secondary);
    min-width: 30px;
}

.subtasks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.subtask-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
}

.subtask-item.completed .subtask-text {
    text-decoration: line-through;
    opacity: 0.7;
}

.subtask-checkbox {
    position: relative;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
}

.subtask-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
}

.subtask-checkbox .checkmark {
    position: relative;
    display: inline-block;
    height: 16px;
    width: 16px;
    background-color: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 3px;
    transition: all 0.3s ease;
}

.subtask-checkbox:hover .checkmark {
    background-color: var(--bg-primary);
}

.subtask-checkbox input:checked ~ .checkmark {
    background-color: var(--success-color);
    border-color: var(--success-color);
}

.subtask-checkbox .checkmark:after {
    content: "";
    position: absolute;
    display: none;
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

.subtask-checkbox input:checked ~ .checkmark:after {
    display: block;
}

.subtask-text {
    flex: 1;
    font-size: 0.9rem;
    color: var(--text-primary);
}

.subtasks-editor {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    background: var(--bg-tertiary);
}

.subtask-input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.subtask-input-row:last-child {
    margin-bottom: 0;
}

.subtask-input {
    flex: 1;
}

.todo-card.priority-high {
    border-left-color: #ef4444;
}

.todo-card.priority-medium {
    border-left-color: #f59e0b;
}

.todo-card.priority-low {
    border-left-color: #10b981;
}

.todo-card.status-overdue {
    background: rgba(239, 68, 68, 0.05);
    border-left-color: #ef4444;
}

.todo-card.status-completed {
    opacity: 0.8;
    background: rgba(16, 185, 129, 0.05);
}

@media (max-width: 768px) {
    .form-row {
        grid-template-columns: 1fr;
    }
    
    .subtasks-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .todo-meta {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .subtask-input-row {
        flex-direction: column;
    }
}
`;

// Add todos styles to head
const todosStyleSheet = document.createElement('style');
todosStyleSheet.textContent = todosStyles;
document.head.appendChild(todosStyleSheet);