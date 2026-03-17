# Requirements — BankTracker (Spendly)

## System Requirements

- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+
- **Java JDK**: 17 (for Android builds)
- **Android SDK**: API Level 34+
- **EAS CLI**: `npm install -g eas-cli` (for production builds)

## Framework & Runtime

| Package | Version |
|---|---|
| Expo SDK | ~54.0.33 |
| React | 19.1.0 |
| React Native | 0.81.5 |
| TypeScript | ~5.9.2 |

## Core Dependencies

| Package | Version | Purpose |
|---|---|---|
| expo-router | ~6.0.23 | File-based navigation |
| @react-navigation/native | ^7.1.8 | Navigation core |
| @react-navigation/bottom-tabs | ^7.4.0 | Tab navigation |
| firebase | ^12.10.0 | Auth + Firestore database |
| @react-native-async-storage/async-storage | 2.2.0 | Local key-value storage |

## UI & Styling

| Package | Version | Purpose |
|---|---|---|
| expo-linear-gradient | ~15.0.8 | Gradient backgrounds |
| react-native-chart-kit | ^6.12.0 | Pie charts on dashboard |
| react-native-svg | ^15.15.3 | SVG rendering (chart dep) |
| react-native-reanimated | ~4.1.1 | Animations |
| react-native-gesture-handler | ~2.28.0 | Touch gestures |
| @expo/vector-icons | ^15.0.3 | Icon sets |
| expo-image | ~3.0.11 | Optimized image loading |
| expo-haptics | ~15.0.8 | Haptic feedback |

## SMS & Notifications

| Package | Version | Purpose |
|---|---|---|
| react-native-get-sms-android | ^2.1.0 | Read SMS messages |
| expo-notifications | ~0.32.16 | Push & local notifications |
| expo-task-manager | ~14.0.9 | Background tasks |
| expo-background-fetch | ~14.0.9 | Periodic background fetch |
| expo-sms | ~14.0.8 | SMS utilities |

## Reports & Sharing

| Package | Version | Purpose |
|---|---|---|
| expo-print | ~15.0.8 | PDF generation |
| expo-sharing | ~14.0.8 | Share files |
| expo-file-system | ~19.0.21 | File operations |

## Other Expo Modules

| Package | Version | Purpose |
|---|---|---|
| expo-splash-screen | ~31.0.13 | Splash screen |
| expo-status-bar | ~3.0.9 | Status bar control |
| expo-constants | ~18.0.13 | App constants |
| expo-linking | ~8.0.11 | Deep linking |
| expo-web-browser | ~15.0.10 | In-app browser |
| expo-system-ui | ~6.0.9 | System UI config |

## External APIs

| API | Purpose |
|---|---|
| Google Gemini 1.5 Flash | AI transaction categorization |
| Firebase Auth | User authentication |
| Firebase Firestore | Cloud database for transactions, budgets, categories |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI categorization |

## Android Permissions

- `READ_SMS` — Read bank SMS messages
- `RECEIVE_SMS` — Detect incoming SMS in real-time
- `POST_NOTIFICATIONS` — Show transaction notifications
- `FOREGROUND_SERVICE` — Background SMS monitoring
- `RECEIVE_BOOT_COMPLETED` — Restart service on device boot

## Installation

```bash
# Clone and install
git clone <repo-url>
cd BankTracker
npm install

# Start dev server
npx expo start

# Build APK
eas build --platform android --profile preview
```
