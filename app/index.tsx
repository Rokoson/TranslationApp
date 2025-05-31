import { Link } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  // const [selectedClassroom, setSelectedClassroom] = useState<ClassroomLevel>(''); // No longer needed

  return (
    <ScrollView
      style={styles.scrollViewStyle} // Styles for the ScrollView component itself
      contentContainerStyle={styles.contentContainer} // Styles for the content *inside* the ScrollView
      keyboardShouldPersistTaps="handled">
      {/* <Stack.Screen options={{ title: "Learn Yoruba Home" }} /> Removed this line */}
      <Text style={styles.title}>Welcome to Your Learning App!</Text>

      <View style={[styles.section, { backgroundColor: 'lightpink' }]}>
        <Text style={styles.sectionTitle}>Direct Tools</Text>
        <Link href="/textTranslator" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Text Translation</Text>
          </Pressable>
        </Link>
      </View>
      {/* Added debug background and borders below */}
      <View style={[styles.section, { backgroundColor: 'lightblue', borderWidth: 1, borderColor: 'black' }]}>
        <Text style={styles.sectionTitle}>Choose a Classroom</Text>
        <Link href="/beginnerClassroom" asChild>
          <Pressable style={[styles.button, styles.classroomButton, { borderWidth: 2, borderColor: 'red' }]}>
            <Text style={styles.buttonText}>Beginner</Text>
          </Pressable>
        </Link>
        <Link href="/intermediateClassroom" asChild>
          <Pressable style={[styles.button, styles.intermediateClassroomNavButton, { borderWidth: 2, borderColor: 'lime' }]}>
            <Text style={styles.buttonText}>Intermediate</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollViewStyle: { // Styles for the ScrollView component
    flex: 1,
    backgroundColor: '#f0f0f0', // Background for the entire scrollable area
  },
  contentContainer: { // Styles for the content *inside* the ScrollView
    flexGrow: 1, // Ensures the content container can grow to fill the ScrollView
    padding: 20, // Overall padding for the content area
    backgroundColor: 'lightgrey', // Debug: background for the content container
    alignItems: "center", // Center children (sections) horizontally
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
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
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  classroomButton: {
    backgroundColor: '#4CAF50', // A different color for classroom specific buttons
  },
  intermediateClassroomNavButton: {
    backgroundColor: '#FF9800', // Orange color for intermediate classroom navigation
  }
});