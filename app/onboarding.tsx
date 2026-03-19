import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'chatbubbles' as const,
    title: 'Smart SMS Detection',
    desc: 'Spendly automatically reads your bank SMS messages and extracts transaction details instantly.',
    gradient: ['#7C3AED', '#6D28D9'] as [string, string],
    iconBg: '#A78BFA',
  },
  {
    icon: 'sparkles' as const,
    title: 'AI Categorization',
    desc: 'Our AI automatically categorizes your spending into Food, Shopping, Travel and more — saving you time!',
    gradient: ['#4F46E5', '#4338CA'] as [string, string],
    iconBg: '#818CF8',
  },
  {
    icon: 'bar-chart' as const,
    title: 'Smart Insights',
    desc: 'Get spending insights, budget alerts and discover your spending personality with beautiful charts.',
    gradient: ['#059669', '#047857'] as [string, string],
    iconBg: '#34D399',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      router.replace('/login');
    }
  };

  const handleSkip = () => {
    router.replace('/login');
  };

  const slide = SLIDES[currentSlide];

  return (
    <LinearGradient colors={['#1E1B4B', '#312E81', '#1E1B4B']} style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* Skip Button */}
      <TouchableOpacity style={s.skipButton} onPress={handleSkip}>
        <Text style={s.skipText}>Skip</Text>
        <Ionicons name="chevron-forward" size={14} color="#A5B4FC" />
      </TouchableOpacity>

      {/* Content */}
      <View style={s.content}>
        {/* Frosted Icon Circle */}
        <View style={s.iconOuterRing}>
          <LinearGradient
            colors={slide.gradient}
            style={s.iconCircle}>
            <Ionicons name={slide.icon} size={48} color="#FFFFFF" />
          </LinearGradient>
        </View>

        {/* App name on first slide */}
        {currentSlide === 0 && (
          <View style={s.appBadge}>
            <Ionicons name="wallet" size={14} color="#A78BFA" />
            <Text style={s.appName}>SPENDLY</Text>
          </View>
        )}

        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.desc}>{slide.desc}</Text>

        {/* Feature highlights */}
        <View style={s.featureRow}>
          <View style={s.featureChip}>
            <Ionicons name="shield-checkmark" size={12} color="#A78BFA" />
            <Text style={s.featureText}>Secure</Text>
          </View>
          <View style={s.featureChip}>
            <Ionicons name="flash" size={12} color="#FBBF24" />
            <Text style={s.featureText}>Instant</Text>
          </View>
          <View style={s.featureChip}>
            <Ionicons name="cloud-offline" size={12} color="#34D399" />
            <Text style={s.featureText}>Offline</Text>
          </View>
        </View>
      </View>

      {/* Bottom */}
      <View style={s.bottom}>
        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === currentSlide && { backgroundColor: '#A78BFA', width: 28 }
              ]}
            />
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity style={s.nextButtonContainer} onPress={handleNext}>
          <LinearGradient
            colors={slide.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.nextButton}>
            <Text style={s.nextButtonText}>
              {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={currentSlide === SLIDES.length - 1 ? 'rocket' : 'arrow-forward'}
              size={18}
              color="#FFFFFF"
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Page indicator */}
        <Text style={s.pageIndicator}>{currentSlide + 1} of {SLIDES.length}</Text>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  skipButton: {
    position: 'absolute',
    top: 55,
    right: 25,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  skipText: { color: '#A5B4FC', fontSize: 13, fontWeight: '600' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  iconOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 36,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(167,139,250,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    marginBottom: 16,
  },
  appName: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 38,
  },
  desc: {
    fontSize: 15,
    color: '#A5B4FC',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureText: {
    fontSize: 11,
    color: '#C4B5FD',
    fontWeight: '600',
  },
  bottom: {
    paddingHorizontal: 30,
    paddingBottom: 50,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  nextButtonContainer: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  nextButton: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
  },
  pageIndicator: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
});