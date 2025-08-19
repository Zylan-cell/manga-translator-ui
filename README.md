# Tauri + Preact + Typescript

This template should help get you started developing with Tauri, Preact and Typescript in Vite.

## Recommended IDE Setup

* [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)# Manga Translator - Frontend Application
* 
* This is the user interface for the Manga Translator application, built with \[Tauri](https://tauri.app/), \[Preact](https://preactjs.com/), and TypeScript. It provides a desktop and mobile-friendly interface for translating manga pages.
* 
* ---
* 
* \## ✨ Features
* 
* \- \*\*Cross-Platform:\*\* Runs on Windows, macOS, Linux, and Android.  
* \- \*\*Image Upload:\*\* Load images from your device via drag-and-drop, file browser, or clipboard.  
* \- \*\*Android Share Target:\*\* Open images directly from your gallery or other apps on Android.  
* \- \*\*Interactive Canvas:\*\*  
* &nbsp; - Pan and zoom the image using mouse or touch gestures (pinch-to-zoom).  
* &nbsp; - View and select detected speech bubbles.  
* \- \*\*Editing Mode:\*\*  
* &nbsp; - Manually add, delete, move, and resize speech bubbles.  
* &nbsp; - Edit recognized text (OCR) and translations.  
* \- \*\*Full Translation Workflow:\*\*  
* &nbsp; - Buttons to trigger detection, OCR, and translation on the backend API.  
* &nbsp; - Real-time translation streaming from the API.  
* \- \*\*Settings Panel:\*\* Configure API endpoints and translation model settings.  
* 
* ---
* 
* \## 🛠️ Setup and Installation
* 
* \### Prerequisites
* 
* \- \[Node.js](https://nodejs.org/) and `pnpm`  
* \- \[Rust](https://www.rust-lang.org/tools/install) toolchain  
* \- Follow the Tauri \[prerequisites guide](https://tauri.app/v2/guides/getting-started/prerequisites) for your operating system  
* \- For Android development: Android SDK and NDK  
* 
* \### Installation Steps
* 
* 1\. \*\*Clone the repository\*\*
* &nbsp;  ```bash
* &nbsp;  git clone https://github.com/YOUR\_USERNAME/manga-translator-ui.git
* &nbsp;  cd manga-translator-ui
* &nbsp;  ```
* 
* 2\. \*\*Install JavaScript dependencies\*\*
* &nbsp;  ```bash
* &nbsp;  pnpm install
* &nbsp;  ```
* 
* ---
* 
* \## 🚀 How to Run for Development
* 
* \### For Desktop (Windows/macOS/Linux)
* 
* 1\. \*\*Start the development server\*\*
* &nbsp;  ```bash
* &nbsp;  pnpm tauri dev
* &nbsp;  ```
* 
* \### For Android
* 
* 1\. \*\*Ensure the Backend API is running\*\* and accessible from your local network. Note its IP address (e.g., `http://192.168.1.5:8000`).  
* 
* 2\. \*\*Configure the API URL\*\*  
* &nbsp;  Before the first run, you might need to manually set the API URL in the app's settings after it launches.  
* 
* 3\. \*\*Connect your Android device\*\* (with USB debugging enabled) or start an Android Emulator.  
* 
* 4\. \*\*Run the development command\*\*
* &nbsp;  ```bash
* &nbsp;  pnpm tauri android dev
* &nbsp;  ```
* &nbsp;  This will build and install the app on your connected device/emulator.  
* 
* ---
* 
* \## 📦 Building for Production
* 
* To build the application for all platforms:
* ```bash
* pnpm tauri build
* ```
* &nbsp;+ [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
