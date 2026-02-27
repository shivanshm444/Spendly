import { Stack } from 'expo-router';
import { TransactionProvider } from '../context/TransactionContext';

export default function RootLayout() {
  return (
    <TransactionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="annotation" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="budget" options={{ headerShown: false }} />
      </Stack>
    </TransactionProvider>
  );
}