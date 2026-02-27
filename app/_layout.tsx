import { Stack } from 'expo-router';
import { TransactionProvider } from '../context/TransactionContext';

export default function RootLayout() {
  return (
    <TransactionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="annotation" options={{ headerShown: false }} />
      </Stack>
    </TransactionProvider>
  );
}