import { Link, Stack } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function BeginnerClassroomScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Beginner Classroom" }} />
      <Text style={styles.title}>Beginner Tools</Text>

      <Link href="/imageCaption" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Picture Dictionary</Text>
        </Pressable>
      </Link>
      <Link href="/imageFlashcard" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Image Flashcards</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  button: {
    backgroundColor: '#4CAF50', // Green for beginner tools
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    width: '80%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
});