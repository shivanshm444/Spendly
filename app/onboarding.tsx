import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '📱',
    title: 'Smart SMS Detection',
    desc: 'Spendly automatically reads your bank SMS messages and extracts transaction details instantly.',
    accent: '#7C3AED',
  },
  {
    emoji: '🤖',
    title: 'AI Categorization',
    desc: 'Our AI automatically categorizes your spending into Food, Shopping, Travel and more — saving you time!',
    accent: '#4F46E5',
  },
  {
    emoji: '📊',
    title: 'Smart Insights',
    desc: 'Get spending insights, budget alerts and discover your spending personality with beautiful charts.',
    accent: '#059669',
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        {/* Emoji Circle */}
        <LinearGradient
          colors={[slide.accent + '20', slide.accent + '08']}
          style={[styles.emojiCircle, { borderColor: slide.accent + '30' }]}>
          <LinearGradient
            colors={[slide.accent + '30', slide.accent + '15']}
            style={styles.emojiInner}>
            <Text style={styles.emoji}>{slide.emoji}</Text>
          </LinearGradient>
        </LinearGradient>

        {/* App name on first slide */}
        {currentSlide === 0 && (
          <Text style={styles.appName}>Spendly</Text>
        )}

        <Text style={[styles.title, { color: '#1A1A1A' }]}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      {/* Bottom */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentSlide && { backgroundColor: slide.accent, width: 24 }
              ]}
            />
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity style={styles.nextButtonContainer} onPress={handleNext}>
          <LinearGradient
            colors={[slide.accent, slide.accent + 'CC']}
            style={styles.nextButton}>
            <Text style={styles.nextButtonText}>
              {currentSlide === SLIDES.length - 1 ? 'Get Started 🚀' : 'Next →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  skipButton: {
    position: 'absolute',
    top: 55,
    right: 25,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  skipText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emojiCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  emojiInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 56 },
  appName: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: 'bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 38,
  },
  desc: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 25,
  },
  bottom: {
    paddingHorizontal: 30,
    paddingBottom: 50,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  nextButtonContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  nextButton: {
    padding: 18,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
});