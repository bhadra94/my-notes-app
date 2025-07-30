# My Notes App

A comprehensive, secure, multi-purpose notes application that supports different types of content and categories. Built with vanilla HTML, CSS, and JavaScript with client-side encryption for security.

## Features

### 🔐 Security
- Master password protection with encryption
- All sensitive data is encrypted using AES-GCM encryption
- Auto-lock after 15 minutes of inactivity
- Secure password generation and strength analysis
- Masked display of sensitive information

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

1. **First Time Setup**
   - Open `index.html` in your web browser
   - Create a master password (minimum 8 characters)
   - The password will encrypt all your data

2. **Using the App**
   - Navigate between modules using the sidebar
   - Use the global search to find items across all modules
   - Click the lock button or wait 15 minutes for auto-lock
   - Toggle between light and dark themes

## Keyboard Shortcuts

- `Ctrl/Cmd + 1-6`: Switch between modules
- `Ctrl/Cmd + F`: Focus global search
- `Ctrl/Cmd + L`: Lock application
- `Escape`: Close modals

## Data Storage

- All data is stored locally in your browser using localStorage
- Data is encrypted with your master password
- No data is sent to external servers
- Use the export function to backup your data

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
├── index.html          # Main application file
├── styles.css          # Application styles with theme support
├── js/
│   ├── app.js          # Main application logic
│   ├── crypto.js       # Encryption and security functions
│   ├── storage.js      # Data storage and management
│   ├── notes.js        # Notes module
│   ├── banking.js      # Banking module
│   ├── passwords.js    # Passwords module
│   ├── documents.js    # Documents module
│   ├── creative.js     # Creative module
│   └── todos.js        # To-Do module
└── README.md           # This file
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

### Forgot Master Password
- No password recovery option for security
- If forgotten, you'll need to clear all data and start fresh
- Regular backups help prevent data loss

### Performance Issues
- Large files may slow down the Documents module
- Consider breaking large creative projects into smaller ones
- Regular cleanup of unused items helps performance

## Contributing

This is a client-side application with no external dependencies. To modify:

1. Edit the appropriate module file in the `js/` directory
2. Update styles in `styles.css`
3. Test in multiple browsers
4. Ensure security features remain intact

## License

This project is open source and available under the MIT License.

## Security Notes

- Never share your master password
- Export backups regularly
- Use strong, unique master passwords
- Be cautious when using on shared computers
- The app uses client-side encryption, but browser security also matters

---

**Important**: This application stores all data locally in your browser. Clearing browser data, uninstalling the browser, or computer issues may result in data loss. Regular exports are strongly recommended for data backup.