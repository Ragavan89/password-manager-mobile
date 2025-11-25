# 🔐 Password Manager

A secure, offline-first password manager built with React Native and Google Sheets as the backend. Features end-to-end encryption, automatic cloud sync, and works seamlessly across iOS, Android, and Web platforms.

## ✨ Features

- 🔒 **End-to-End Encryption** - All passwords encrypted with AES-256 before storage
- 📱 **Cross-Platform** - Works on iOS, Android, and Web
- 🌐 **Offline-First** - Full functionality without internet connection
- ☁️ **Cloud Sync** - Automatic synchronization with Google Sheets
- 🔄 **Smart Sync** - Syncs only when needed (app start, network change, after edits)
- 💾 **Local Storage** - SQLite on mobile, localStorage on web
- 📝 **Comments & Metadata** - Add notes and track last modified timestamps
- 🎨 **Modern UI** - Clean, intuitive interface with password visibility toggle

## 📚 Documentation

- **[Deployment Guide](docs/DEPLOYMENT.md)**: Complete guide for setup, development, building, and publishing.
- **[Project Summary](docs/PROJECT_SUMMARY.md)**: Overview of features, architecture, limitations, and user guides.

## 🚀 Quick Start

1.  **Clone the repository**:
    ```bash
    git clone <your-repo-url>
    cd password-manager
    ```

2.  **Install dependencies**:
    ```bash
    cd mobile
    npm install
    ```

3.  **Run the app**:
    ```bash
    npm start
    ```

For full setup instructions, including the Google Sheets backend, please refer to the **[Deployment Guide](docs/DEPLOYMENT.md)**.

## 📄 License

This project is open source and available under the MIT License.
