import { Link, Stack } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Translator Home" }} />
      <Text style={styles.title}>Welcome to the Translator App!</Text>
      <Text style={styles.subtitle}>Choose an option:</Text>

      <Link href="/index" asChild>
        <Pressable style={styles.navButton}>
          <Text style={styles.navButtonText}>Text Translation</Text>
        </Pressable>
      </Link>

      <Link href="/imageCaption" asChild>
        <Pressable style={[styles.navButton, styles.secondaryButton]}>
          <Text style={styles.navButtonText}>Visual Dictionary (Image Caption)</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    color: '#555',
  },
  navButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 20,
    width: '80%',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50', // A different color for the second button
  },
  navButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});