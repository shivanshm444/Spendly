import { StyleSheet, Text, View, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.config';

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const userName = user?.email?.split('@')[0] || 'User';
  const initial = user?.email?.charAt(0).toUpperCase() || '?';
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    : 'Not available';

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
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Premium Header with Avatar ── */}
      <LinearGradient colors={['#1E1B4B', '#312E81', '#3730A3']} style={s.headerGradient}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="chevron-back" size={20} color="#C4B5FD" />
        </TouchableOpacity>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatarRing}>
            <LinearGradient colors={['#A78BFA', '#7C3AED']} style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </LinearGradient>
          </View>
          <Text style={s.userName}>{userName}</Text>
          <View style={s.emailBadge}>
            <Ionicons name="mail" size={12} color="#A5B4FC" />
            <Text style={s.userEmail}>{user?.email || ''}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Info Section ── */}
      <View style={s.sectionWrap}>
        <View style={s.sectionHeaderRow}>
          <Ionicons name="person" size={16} color="#6D28D9" />
          <Text style={s.sectionTitle}>Account Details</Text>
        </View>

        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="mail-outline" size={18} color="#7C3AED" />
            </View>
            <View style={s.infoTextWrap}>
              <Text style={s.infoLabel}>Email Address</Text>
              <Text style={s.infoValue}>{user?.email || 'Not available'}</Text>
            </View>
          </View>

          <View style={s.infoDivider} />

          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
            </View>
            <View style={s.infoTextWrap}>
              <Text style={s.infoLabel}>Member Since</Text>
              <Text style={s.infoValue}>{memberSince}</Text>
            </View>
          </View>

          <View style={s.infoDivider} />

          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="phone-portrait-outline" size={18} color="#7C3AED" />
            </View>
            <View style={s.infoTextWrap}>
              <Text style={s.infoLabel}>App Version</Text>
              <Text style={s.infoValue}>Spendly v1.0.0</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Quick Links ── */}
      <View style={s.sectionWrap}>
        <View style={s.sectionHeaderRow}>
          <Ionicons name="apps" size={16} color="#6D28D9" />
          <Text style={s.sectionTitle}>Quick Links</Text>
        </View>

        <View style={s.quickLinksRow}>
          <TouchableOpacity style={s.quickLink} onPress={() => router.push('/dashboard')}>
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={s.quickLinkIcon}>
              <Ionicons name="stats-chart" size={20} color="#fff" />
            </LinearGradient>
            <Text style={s.quickLinkText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickLink} onPress={() => router.push('/budget')}>
            <LinearGradient colors={['#E11D48', '#BE123C']} style={s.quickLinkIcon}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </LinearGradient>
            <Text style={s.quickLinkText}>Budget</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickLink} onPress={() => router.push('/calendar')}>
            <LinearGradient colors={['#059669', '#047857']} style={s.quickLinkIcon}>
              <Ionicons name="calendar" size={20} color="#fff" />
            </LinearGradient>
            <Text style={s.quickLinkText}>Calendar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── About ── */}
      <View style={s.sectionWrap}>
        <View style={s.sectionHeaderRow}>
          <Ionicons name="information-circle" size={16} color="#6D28D9" />
          <Text style={s.sectionTitle}>About</Text>
        </View>

        <View style={s.aboutCard}>
          <View style={s.aboutHeaderRow}>
            <Ionicons name="wallet" size={20} color="#7C3AED" />
            <Text style={s.aboutAppName}>Spendly</Text>
          </View>
          <Text style={s.aboutText}>
            Automatically reads bank SMS, categorizes spending with AI, budget tracking with predictions, receipt scanning, and detailed analytics. Built for smart money management.
          </Text>
          <View style={s.techRow}>
            <View style={s.techChip}><Text style={s.techChipText}>React Native</Text></View>
            <View style={s.techChip}><Text style={s.techChipText}>Firebase</Text></View>
            <View style={s.techChip}><Text style={s.techChipText}>Gemini AI</Text></View>
            <View style={s.techChip}><Text style={s.techChipText}>ML Kit</Text></View>
          </View>
        </View>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={s.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color="#E11D48" />
        <Text style={s.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FF' },

  // Header
  headerGradient: { paddingTop: 52, paddingBottom: 32, alignItems: 'center' },
  backButton: { position: 'absolute', top: 52, left: 20, width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', zIndex: 10 },
  avatarSection: { alignItems: 'center', marginTop: 10 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'rgba(167,139,250,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  avatarText: { fontSize: 38, fontWeight: '800', color: 'white' },
  userName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  emailBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  userEmail: { fontSize: 12, color: '#A5B4FC', fontWeight: '500' },

  // Sections
  sectionWrap: { marginTop: 20, paddingHorizontal: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E1B4B' },

  // Info Card
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#EDE9FE', overflow: 'hidden', elevation: 2, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  infoIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#1E1B4B', fontWeight: '700', marginTop: 2 },
  infoDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  // Quick Links
  quickLinksRow: { flexDirection: 'row', gap: 12 },
  quickLink: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#EDE9FE', elevation: 2 },
  quickLinkIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLinkText: { fontSize: 12, fontWeight: '700', color: '#1E1B4B' },

  // About
  aboutCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#EDE9FE', elevation: 2 },
  aboutHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  aboutAppName: { fontSize: 18, fontWeight: '800', color: '#7C3AED' },
  aboutText: { fontSize: 13, color: '#6B7280', lineHeight: 21, fontWeight: '400' },
  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  techChip: { backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#EDE9FE' },
  techChipText: { fontSize: 11, fontWeight: '600', color: '#7C3AED' },

  // Logout
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF1F2', marginHorizontal: 20, marginTop: 24, padding: 18, borderRadius: 18, borderWidth: 1.5, borderColor: '#FECDD3' },
  logoutText: { color: '#E11D48', fontSize: 16, fontWeight: '700' },
});