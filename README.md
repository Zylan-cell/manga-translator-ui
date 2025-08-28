# Manga Translator - Frontend Application

This is the user interface for the Manga Translator application, built with [Tauri](https://tauri.app/), [Preact](https://preactjs.com/), and TypeScript. It provides a desktop and mobile-friendly interface for translating manga pages.

---

## ✨ Features

- **Cross-Platform:** Runs on Windows, macOS, Linux, and Android.  
- **Image Upload:** Load images from your device via drag-and-drop, file browser, or clipboard.  
- **Android Share Target:** Open images directly from your gallery or other apps on Android.  
- **Interactive Canvas:**  
  - Pan and zoom the image using mouse or touch gestures (pinch-to-zoom).  
  - View and select detected speech bubbles.  
- **Editing Mode:**  
  - Manually add, delete, move, and resize speech bubbles.  
  - Edit recognized text (OCR) and translations.  
- **Full Translation Workflow:**  
  - Buttons to trigger detection, OCR, and translation on the backend API.  
  - Real-time translation streaming from the API.  
- **Settings Panel:** Configure API endpoints and translation model settings.  

---

## 🛠️ Setup and Installation

### Prerequisites

- [Node.js](https://nodejs.org/) and `pnpm`  
- [Rust](https://www.rust-lang.org/tools/install) toolchain  
- Follow the Tauri [prerequisites guide](https://tauri.app/v2/guides/getting-started/prerequisites) for your operating system  
- For Android development: Android SDK and NDK  

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/manga-translator-ui.git
   cd manga-translator-ui
   ```

2. **Install JavaScript dependencies**
   ```bash
   pnpm install
   ```

---

## 🚀 How to Run for Development

### For Desktop (Windows/macOS/Linux)

1. **Start the development server**
   ```bash
   pnpm tauri dev
   ```

### For Android

1. **Ensure the Backend API is running** and accessible from your local network. Note its IP address (e.g., `http://192.168.1.5:8000`).  

2. **Configure the API URL**  
   Before the first run, you might need to manually set the API URL in the app's settings after it launches.  

3. **Connect your Android device** (with USB debugging enabled) or start an Android Emulator.  

4. **Run the development command**
   ```bash
   pnpm tauri android dev
   ```
   This will build and install the app on your connected device/emulator.  

---

## 📦 Building for Production

To build the application for all platforms:
```bash
pnpm tauri build
```