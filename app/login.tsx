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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <LinearGradient colors={['#1a0533', '#0A0A0F']} style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>💰</Text>
        </View>
        <Text style={styles.appName}>Spendly</Text>
        <Text style={styles.tagline}>Your Smart Expense Manager</Text>
      </LinearGradient>

      <View style={styles.form}>
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
            placeholderTextColor="#444"
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
            placeholderTextColor="#444"
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
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    paddingTop: 70,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#7C3AED20',
    borderWidth: 1,
    borderColor: '#7C3AED50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  logoEmoji: { fontSize: 40 },
  appName: { fontSize: 30, fontWeight: 'bold', color: 'white' },
  tagline: { fontSize: 14, color: '#555', marginTop: 5 },
  form: { paddingHorizontal: 25, paddingTop: 10 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
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
  toggleActive: { backgroundColor: '#7C3AED' },
  toggleText: { color: '#555', fontWeight: 'bold', fontSize: 15 },
  toggleTextActive: { color: 'white' },
  welcomeText: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 25 },
  inputContainer: { marginBottom: 18 },
  inputLabel: { color: '#888', fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: '#1a1a2e',
    color: 'white',
    padding: 15,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ffffff08',
  },
  authButtonContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  authButton: { padding: 17, alignItems: 'center' },
  authButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  switchText: { color: '#555', textAlign: 'center', marginTop: 20, fontSize: 14 },
  switchLink: { color: '#7C3AED', fontWeight: 'bold' },
});