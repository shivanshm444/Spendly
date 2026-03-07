import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase.config';

export default function LoginScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields!');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters!');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.replace('/(tabs)');
    } catch (error: any) {
      const message = error.code === 'auth/invalid-credential' ? 'Invalid email or password!' :
        error.code === 'auth/email-already-in-use' ? 'Email already registered!' :
          error.code === 'auth/invalid-email' ? 'Invalid email address!' :
            'Something went wrong. Try again!';
      Alert.alert('Error', message);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Hero Section */}
      <View style={styles.hero}>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>💰</Text>
        </LinearGradient>
        <Text style={styles.appName}>Spendly</Text>
        <Text style={styles.tagline}>Your Smart Expense Manager</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Login / Sign Up Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, isLogin && styles.toggleActive]}
            onPress={() => setIsLogin(true)}>
            <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !isLogin && styles.toggleActive]}
            onPress={() => setIsLogin(false)}>
            <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.welcomeText}>
          {isLogin ? 'Welcome back! 👋' : 'Create your account 🚀'}
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.authButtonContainer} onPress={handleAuth} disabled={loading}>
          <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.authButton}>
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.authButtonText}>
                {isLogin ? '🔐 Login' : '🚀 Create Account'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.switchText}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Text style={styles.switchLink} onPress={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Sign Up' : 'Login'}
          </Text>
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  hero: {
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 35,
    backgroundColor: '#FFFFFF',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    elevation: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoEmoji: { fontSize: 40 },
  appName: { fontSize: 32, fontWeight: 'bold', color: '#7C3AED' },
  tagline: { fontSize: 14, color: '#9CA3AF', marginTop: 6 },
  form: { paddingHorizontal: 25, paddingTop: 10 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 25,
  },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#7C3AED', elevation: 2, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  toggleText: { color: '#9CA3AF', fontWeight: 'bold', fontSize: 15 },
  toggleTextActive: { color: 'white' },
  welcomeText: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 25 },
  inputContainer: { marginBottom: 18 },
  inputLabel: { color: '#6B7280', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: '#F9FAFB',
    color: '#1A1A1A',
    padding: 15,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  authButtonContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
    elevation: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  authButton: { padding: 17, alignItems: 'center' },
  authButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  switchText: { color: '#9CA3AF', textAlign: 'center', marginTop: 20, fontSize: 14 },
  switchLink: { color: '#7C3AED', fontWeight: 'bold' },
});