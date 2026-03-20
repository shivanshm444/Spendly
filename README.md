# Spendly 👋

Spendly is a premium budget tracking app with AI-powered receipt scanning and automatic transaction categorization.

## 🚀 Setup for Developers

If you are a friend of the author or a new developer, follow these steps to get the app running:

### 1. Prerequisite
- [Node.js](https://nodejs.org/) installed.
- [Expo Go](https://expo.dev/go) app on your Android/iOS device.

### 2. Installation
```bash
# Clone the repository
git clone git@github.com:shivanshm444/Spendly.git
cd Spendly

# Install dependencies
npm install
```

### 3. Environment Setup (CRITICAL)
API keys and secrets are protected and not included in this repository. You must create your own `.env` file in the root directory:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your own API keys:
   - **Groq API Key**: Get it at [Groq Console](https://console.groq.com/keys) (Free, 14.4K requests/day).
   - **Gemini API Key**: Get it at [Google AI Studio](https://aistudio.google.com/apikey).
   - **Firebase Config**: Create a project at [Firebase Console](https://console.firebase.google.com/).

### 4. Firebase Android Setup
- Download your `google-services.json` from Firebase and place it in the root directory.

### 5. Run the App
```bash
npx expo start
```
Scan the QR code with your **Expo Go** app to test!

## ✨ Key Features
- **AI Receipt Scanner**: Powered by Groq Vision (meta-llama/llama-4-scout).
- **Auto-Categorization**: Uses Gemini AI to categorize expenses.
- **Premium UI**: Dark mode, glassmorphism, and Ionicons throughout.
- **SMS Integration**: Automatically tracks bank SMS for instant updates.

## 🛠 Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: Firebase (Auth & Firestore)
- **AI**: Groq API (Vision), Gemini API (Text)
- **Icons**: Ionicons (@expo/vector-icons)
