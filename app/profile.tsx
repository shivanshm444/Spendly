import { StyleSheet, Text, View, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.config';

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
            router.replace('/login');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </Text>
        </LinearGradient>
        <Text style={styles.userName}>{user?.email?.split('@')[0] || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Info Cards */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Email</Text>
        <Text style={styles.infoValue}>{user?.email || 'Not available'}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Member Since</Text>
        <Text style={styles.infoValue}>
          {user?.metadata?.creationTime
            ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric'
            })
            : 'Not available'}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>App Version</Text>
        <Text style={styles.infoValue}>Spendly v1.0.0</Text>
      </View>

      {/* About */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>About Spendly</Text>
        <Text style={styles.aboutText}>
          Spendly automatically reads your bank SMS messages, categorizes your spending using AI, and helps you manage your budget smartly. Built with ❤️ for hackathon 2026.
        </Text>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FFFFFF', padding: 20, paddingTop: 55, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { marginRight: 15 },
  backText: { color: '#7C3AED', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  avatarSection: { alignItems: 'center', paddingVertical: 30 },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: 'white' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  userEmail: { fontSize: 14, color: '#9CA3AF', marginTop: 5 },
  infoCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  infoLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 5 },
  infoValue: { fontSize: 15, color: '#1A1A1A', fontWeight: 'bold' },
  aboutCard: { backgroundColor: '#F5F3FF', marginHorizontal: 20, marginBottom: 10, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#DDD6FE' },
  aboutTitle: { fontSize: 15, fontWeight: 'bold', color: '#7C3AED', marginBottom: 8 },
  aboutText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  logoutButton: { backgroundColor: '#FFF1F2', marginHorizontal: 20, marginTop: 10, padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECDD3' },
  logoutText: { color: '#E11D48', fontSize: 16, fontWeight: 'bold' },
});