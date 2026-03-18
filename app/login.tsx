import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase.config';

export default function LoginScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields!'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters!'); return; }
    setLoading(true);
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); }
      else { await createUserWithEmailAndPassword(auth, email, password); }
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
    <LinearGradient colors={['#1E1B4B', '#312E81', '#1E1B4B']} style={s.bg}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.logoWrap}>
            <Ionicons name="wallet" size={36} color="#FFFFFF" />
          </View>
          <Text style={s.appName}>Spendly</Text>
          <Text style={s.tagline}>Your Smart Expense Manager</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          {/* Toggle */}
          <View style={s.toggle}>
            <TouchableOpacity style={[s.toggleBtn, isLogin && s.toggleActive]} onPress={() => setIsLogin(true)}>
              <Ionicons name="log-in" size={16} color={isLogin ? '#fff' : '#9CA3AF'} />
              <Text style={[s.toggleText, isLogin && s.toggleTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.toggleBtn, !isLogin && s.toggleActive]} onPress={() => setIsLogin(false)}>
              <Ionicons name="person-add" size={16} color={!isLogin ? '#fff' : '#9CA3AF'} />
              <Text style={[s.toggleText, !isLogin && s.toggleTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.welcome}>{isLogin ? 'Welcome back!' : 'Create your account'}</Text>
          <Text style={s.welcomeSub}>{isLogin ? 'Sign in to manage your spending' : 'Start tracking your expenses today'}</Text>

          {/* Email */}
          <Text style={s.label}>Email</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#A78BFA" style={s.inputIcon} />
            <TextInput style={s.input} placeholder="Enter your email" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          {/* Password */}
          <Text style={s.label}>Password</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#A78BFA" style={s.inputIcon} />
            <TextInput style={s.input} placeholder="Enter your password" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity style={s.submitWrap} onPress={handleAuth} disabled={loading}>
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={s.submitBtn}>
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <View style={s.submitInner}>
                  <Ionicons name={isLogin ? 'log-in' : 'rocket'} size={18} color="#fff" />
                  <Text style={s.submitText}>{isLogin ? 'Login' : 'Create Account'}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.switchText}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Text style={s.switchLink} onPress={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Sign Up' : 'Login'}
            </Text>
          </Text>
        </View>

        {/* Footer branding */}
        <View style={s.footer}>
          <Ionicons name="shield-checkmark" size={14} color="#6D28D9" />
          <Text style={s.footerText}>Secured with Firebase Authentication</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },

  hero: { alignItems: 'center', marginBottom: 32 },
  logoWrap: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' },
  appName: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  tagline: { fontSize: 14, color: '#A5B4FC', marginTop: 6, fontWeight: '500' },

  card: { backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 28, padding: 28, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },

  toggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 16, padding: 4, marginBottom: 24, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12 },
  toggleActive: { backgroundColor: '#7C3AED', elevation: 3, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
  toggleText: { color: '#9CA3AF', fontWeight: '700', fontSize: 14 },
  toggleTextActive: { color: '#FFFFFF' },

  welcome: { fontSize: 24, fontWeight: '800', color: '#1E1B4B', marginBottom: 4 },
  welcomeSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 24, fontWeight: '500' },

  label: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7FF', borderRadius: 16, borderWidth: 1.5, borderColor: '#EDE9FE', overflow: 'hidden' },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, color: '#1E1B4B', padding: 15, fontSize: 15, fontWeight: '500' },
  eyeBtn: { paddingRight: 14, paddingVertical: 15 },

  submitWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 24, elevation: 6, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  submitBtn: { padding: 17, alignItems: 'center' },
  submitInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  switchText: { color: '#9CA3AF', textAlign: 'center', marginTop: 20, fontSize: 14 },
  switchLink: { color: '#7C3AED', fontWeight: '700' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28, opacity: 0.6 },
  footerText: { fontSize: 11, color: '#A5B4FC', fontWeight: '500' },
});