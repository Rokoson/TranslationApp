import { Picker } from '@react-native-picker/picker';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type ClassroomLevel = 'beginner' | 'intermediate' | null;

export default function HomeScreen() {
  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomLevel>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Your Learning App!</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Direct Tools</Text>
        <Link href="/textTranslation" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Text Translation</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Classrooms</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedClassroom}
            onValueChange={(itemValue) => setSelectedClassroom(itemValue as ClassroomLevel)}
            style={styles.picker}
          >
            <Picker.Item label="Select a Classroom..." value={null} />
            <Picker.Item label="Beginner" value="beginner" />
            <Picker.Item label="Intermediate" value="intermediate" />
          </Picker>
        </View>

        {selectedClassroom === 'beginner' && (
          <View style={styles.classroomOptions}>
            <Text style={styles.classroomTitle}>Beginner Tools</Text>
            <Link href="/imageCaption" asChild>
              <Pressable style={[styles.button, styles.classroomButton]}>
                <Text style={styles.buttonText}>Image Caption Learning</Text>
              </Pressable>
            </Link>
            <Link href="/imageFlashcard" asChild>
              <Pressable style={[styles.button, styles.classroomButton]}>
                <Text style={styles.buttonText}>Image Flashcards</Text>
              </Pressable>
            </Link>
          </View>
        )}

        {selectedClassroom === 'intermediate' && (
          <View style={styles.classroomOptions}>
            <Text style={styles.classroomTitle}>Intermediate Tools</Text>
            <Link href="/sentenceBuilder" asChild>
              <Pressable style={[styles.button, styles.classroomButton]}>
                <Text style={styles.buttonText}>Sentence Builder</Text>
              </Pressable>
            </Link>
            <Link href="/sentenceFlashcard" asChild>
              <Pressable style={[styles.button, styles.classroomButton]}>
                <Text style={styles.buttonText}>Sentence Flashcards</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    width: '100%',
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
    color: '#007AFF',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff', // Ensure picker background is white on Android
  },
  picker: {
    width: '100%',
    height: 50, // Standard height for picker
  },
  classroomOptions: {
    marginTop: 10,
  },
  classroomTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    color: '#555',
  },
  classroomButton: {
    backgroundColor: '#4CAF50', // A different color for classroom specific buttons
  },
});