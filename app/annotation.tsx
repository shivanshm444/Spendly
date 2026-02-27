import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTransactions } from '../context/TransactionContext';

const CATEGORIES = [
  { name: 'Food', emoji: '🍕', color: '#FF6B6B' },
  { name: 'Shopping', emoji: '🛒', color: '#4ECDC4' },
  { name: 'Travel', emoji: '✈️', color: '#45B7D1' },
  { name: 'Fuel', emoji: '⛽', color: '#F39C12' },
  { name: 'Entertainment', emoji: '🎬', color: '#9B59B6' },
  { name: 'Groceries', emoji: '🏪', color: '#2ECC71' },
  { name: 'Health', emoji: '💊', color: '#E74C3C' },
  { name: 'Rent', emoji: '🏠', color: '#3498DB' },
  { name: 'Education', emoji: '📚', color: '#1ABC9C' },
  { name: 'Other', emoji: '💳', color: '#95A5A6' },
];

export default function AnnotationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { updateTransaction } = useTransactions();

  const merchant = params.merchant as string || 'Unknown';
  const amount = params.amount as string || '0';
  const date = params.date as string || '';
  const index = parseInt(params.index as string || '0');

  const [selectedCategory, setSelectedCategory] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!selectedCategory) {
      Alert.alert('Please select a category!');
      return;
    }
    updateTransaction(index, selectedCategory, notes);
    Alert.alert('✅ Saved!', `${merchant} tagged as ${selectedCategory}`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  return (
    <ScrollView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Details</Text>
      </View>

      {/* Transaction Info Card */}
      <View style={styles.transactionCard}>
        <Text style={styles.merchantName}>{merchant}</Text>
        <Text style={styles.amount}>₹{parseFloat(amount).toFixed(2)}</Text>
        <Text style={styles.date}>
          {date ? new Date(parseInt(date)).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric'
          }) : ''}
        </Text>
      </View>

      {/* Category Picker */}
      <Text style={styles.sectionTitle}>Where did you spend?</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.name}
            style={[
              styles.categoryItem,
              selectedCategory === cat.name && { borderColor: cat.color, borderWidth: 2, backgroundColor: cat.color + '15' }
            ]}
            onPress={() => setSelectedCategory(cat.name)}>
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[
              styles.categoryName,
              selectedCategory === cat.name && { color: cat.color, fontWeight: 'bold' }
            ]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notes Input */}
      <Text style={styles.sectionTitle}>Add a note (optional)</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="e.g. Lunch with friends, Birthday gift..."
        placeholderTextColor="#aaa"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>💾 Save Transaction</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    backgroundColor: '#2E86AB',
    padding: 20,
    paddingTop: 55,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 15 },
  backText: { color: 'white', fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  transactionCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
  },
  merchantName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  amount: { fontSize: 36, fontWeight: 'bold', color: '#e74c3c', marginTop: 8 },
  date: { fontSize: 13, color: '#aaa', marginTop: 5 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    color: '#333',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 15,
  },
  categoryItem: {
    backgroundColor: 'white',
    width: '28%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
    margin: 4,
  },
  categoryEmoji: { fontSize: 24 },
  categoryName: { fontSize: 11, color: '#555', marginTop: 5, textAlign: 'center' },
  notesInput: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 12,
    fontSize: 15,
    color: '#333',
    elevation: 2,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  saveButton: {
    backgroundColor: '#2E86AB',
    marginHorizontal: 20,
    marginTop: 25,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
  },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});