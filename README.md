# SecureNotes

A comprehensive, secure, multi-user notes application that supports different types of content and organization. Built with modern web technologies and designed for public use with individual user accounts.

## 🌟 What's New - Multi-User Support!

SecureNotes has been completely redesigned to support multiple users with individual accounts. Each user gets their own private, secure workspace with all their data isolated and protected.

## Features

### 🔐 Advanced Security & Authentication
- **Multi-user account system** with secure registration and login
- **Individual user data isolation** - each user's data is completely separate
- **Session management** with automatic timeout and "remember me" functionality
- **Password strength validation** and security recommendations
- **Future-ready for social login** (Google, GitHub) and backend integration
- **Bank-grade encryption** for all sensitive data (when enabled)
- **Zero-knowledge architecture** - your data stays private

### 📝 Notes Module
- Rich text editing with formatting tools
- Auto-save functionality
- Tag system for organization
- Search by title or content
- Export notes as Markdown
- Sort by date created/modified

### 🏦 Banking Module
- Secure storage for banking information
- Masked display of account numbers (show only last 4 digits)
- Copy to clipboard functionality
- Multiple account types (Checking, Savings, Credit, etc.)
- Search and filter by bank name

### 🔑 Passwords Module
- Secure password storage with encryption
- Password generator with customizable options
- Password strength indicator
- Hide/show password toggle
- Copy username/password to clipboard
- Categories (Work, Personal, Financial, Shopping)
- Search by website or username

### 📄 Documents Module
- File upload with drag & drop support
- Support for multiple file types (PDF, DOC, images, etc.)
- File preview for images and PDFs
- Document descriptions and metadata
- Search by filename or description
- File size management (10MB limit)

### 🎨 Creative Module
- Canvas for digital sketches and drawings
- Mood board creation with image uploads
- Design project documentation
- Inspiration collections with links and notes
- Color palette storage
- Project organization and export

### ✅ To-Do Module
- Task creation with descriptions and due dates
- Priority levels (High, Medium, Low)
- Subtasks support with progress tracking
- Recurring tasks
- Category organization
- Overdue task highlighting
- Calendar integration

## Getting Started

### 🚀 New User Registration

1. **Open SecureNotes**
   - Open `index.html` in your web browser
   - You'll see a beautiful welcome screen with feature highlights

2. **Create Your Account**
   - Click "Get Started Free" to create a new account
   - Fill in your first name, last name, and email address
   - Create a strong password (8+ characters with good strength)
   - Agree to the terms and conditions
   - Optionally sign up for product updates

3. **Sign In**
   - Use "Sign In" if you already have an account
   - Enter your email and password
   - Check "Remember me" to stay logged in longer
   - Use "Forgot password?" if you need to reset your password

### 🎯 Using the App

- **Navigation**: Use the sidebar to switch between different modules
- **Global Search**: Find items across all your modules instantly
- **User Menu**: Click your profile in the top-right for account options
- **Theme Toggle**: Switch between light and dark modes
- **Auto-logout**: The app automatically logs you out after 8 hours for security

## Keyboard Shortcuts

- `Ctrl/Cmd + 1-6`: Switch between modules
- `Ctrl/Cmd + F`: Focus global search
- `Ctrl/Cmd + L`: Sign out of application
- `Escape`: Close modals

## Data Storage & Privacy

### 🔒 User Data Isolation
- **Individual user storage**: Each user's data is stored separately and securely
- **Local browser storage**: All data stays on your device using localStorage
- **No cross-user access**: Users can only see and access their own data
- **Privacy by design**: No data is sent to external servers (ready for future backend)

### 📊 Multi-User Architecture
- User accounts are stored locally with secure password hashing
- Each user gets their own encrypted data namespace
- Session management with configurable timeout periods
- Ready for cloud synchronization when backend is integrated

## Supported File Types

### Documents Module
- **PDFs**: application/pdf
- **Word Documents**: .doc, .docx
- **Text Files**: .txt
- **Images**: .jpg, .png, .gif, .webp
- **Spreadsheets**: .xls, .xlsx

## Security Features

### Encryption
- Uses Web Crypto API with AES-GCM encryption
- 256-bit key length for maximum security
- Each encrypted item has a unique initialization vector

### Password Security
- Master password is hashed using SHA-256
- Sensitive data fields are masked by default
- Password strength analysis and recommendations
- Secure random password generation

### Auto-Lock
- Automatically locks after 15 minutes of inactivity
- Locks when browser tab loses focus
- Manual lock option available

## Browser Compatibility

- Modern browsers with Web Crypto API support
- Chrome 37+, Firefox 34+, Safari 7+, Edge 12+
- Local storage and File API support required

## File Structure

```
my-notes-app/
├── index.html          # Main application with authentication UI
├── styles.css          # Modern styles with authentication screens
├── js/
│   ├── auth.js         # 🆕 Multi-user authentication system
│   ├── app.js          # Main application logic (updated for multi-user)
│   ├── crypto.js       # Encryption and security functions
│   ├── storage.js      # User-isolated data storage (updated)
│   ├── notes.js        # Notes module
│   ├── banking.js      # Banking module
│   ├── passwords.js    # Passwords module
│   ├── documents.js    # Documents module
│   ├── creative.js     # Creative module
│   └── todos.js        # To-Do module
└── README.md           # This updated documentation
```

## Usage Tips

### Notes
- Use the rich text editor for formatting
- Add tags for better organization
- Auto-save prevents data loss

### Banking
- Click the eye icon to reveal masked numbers
- Use the copy button for quick access
- Add notes for additional account details

### Passwords
- Use the password generator for strong passwords
- Organize with categories
- Check password strength regularly

### Documents
- Drag and drop files for quick upload
- Add descriptions for better searchability
- Preview images and PDFs directly

### Creative
- Choose project type based on your needs
- Use the canvas tools for digital sketching
- Create mood boards with multiple images
- Save color palettes for design consistency

### To-Do
- Set due dates and priorities
- Break down large tasks with subtasks
- Use recurring tasks for regular activities
- Mark tasks urgent for high priority items

## Data Export/Import

### Export
- Each module supports individual item export
- Full app data export available from the header
- Data exported as JSON with metadata

### Backup
- Regular exports recommended for data safety
- Export files contain encrypted data
- Store backups securely

## Troubleshooting

### Can't Access App
- Ensure you're using a supported browser
- Check that JavaScript is enabled
- Clear browser cache if experiencing issues

### Forgot Password
- Use the "Forgot password?" link on the login screen
- Password reset functionality is placeholder (will work with backend)
- For now, you'll need to create a new account if password is forgotten
- Regular data exports help prevent data loss

### Performance Issues
- Large files may slow down the Documents module
- Consider breaking large creative projects into smaller ones
- Regular cleanup of unused items helps performance

## 🚀 Backend Integration Ready

SecureNotes is designed to be easily integrated with a backend service:

### Current State (Client-Only)
- User accounts stored in browser localStorage
- All data processing happens client-side
- No network requests (except for future social login)
- Full functionality without any server

### Backend Integration Points
- **User Authentication API**: Replace localStorage with proper user management
- **Data Synchronization**: Cloud storage with conflict resolution
- **Password Reset**: Email-based password recovery
- **Social Login**: Google, GitHub, and other OAuth providers
- **File Storage**: Cloud storage for documents and images
- **Real-time Sync**: Multi-device synchronization

### API Endpoints Needed
```javascript
// Authentication
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password

// User Data (per module)
GET /api/user/data/:module
POST /api/user/data/:module
PUT /api/user/data/:module/:itemId
DELETE /api/user/data/:module/:itemId

// File Uploads
POST /api/files/upload
GET /api/files/:fileId
DELETE /api/files/:fileId
```

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from your project directory**:
   ```bash
   cd my-notes-app
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project or create new
   - Set project name (e.g., "ballpenbox")
   - Confirm deployment settings

5. **Your app will be live** at `https://your-project-name.vercel.app`

### Alternative Deployment Options

**GitHub Pages**:
- Push to GitHub
- Enable GitHub Pages in repository settings
- Set source to main branch

**Netlify**:
- Drag and drop your project folder to Netlify
- Or connect your GitHub repository
- Automatic deployments on push

**Manual Upload**:
- Upload files to any web server
- Ensure `index.html` is in the root directory
- Configure server for SPA routing if needed

## Contributing

This is a modern client-side application ready for backend integration:

1. **Frontend Changes**: Edit files in the `js/` directory or update `styles.css`
2. **Authentication**: Modify `js/auth.js` for backend integration
3. **Storage**: Update `js/storage.js` to use API calls instead of localStorage
4. **Testing**: Test in multiple browsers and ensure security features work
5. **Backend**: Implement the API endpoints listed above

## License

This project is open source and available under the MIT License.

## Security Notes

### 🔐 Multi-User Security Best Practices
- **Use unique, strong passwords** for your account (8+ characters)
- **Never share your login credentials** with others
- **Sign out when using shared computers** to protect your data
- **Export backups regularly** to prevent data loss
- **Each user's data is isolated** - other users cannot access your information
- **Sessions auto-expire** for security (8 hours, or 30 days if "Remember me" is checked)

### 🌐 Public Deployment Ready
- Designed for hosting on any web server
- No server-side dependencies required
- Works great on static hosting (GitHub Pages, Netlify, Vercel)
- HTTPS recommended for production deployment
- Ready for CDN distribution for global performance

---

## 🎉 Migration from Single-User Version

If you were using the previous single-user version:

1. **Export your data** from the old version using the export function
2. **Create a new account** in the new multi-user version
3. **Import your data** (this feature will be added in a future update)
4. **Enjoy the new multi-user features!**

---

**Important**: This application stores user data locally in the browser. Each user's data is isolated and secure. Clearing browser data will remove all user accounts and data. Regular exports are strongly recommended for data backup.