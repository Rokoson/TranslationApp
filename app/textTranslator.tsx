import { translateToYorubaAPI } from "@/src/services/translationApiService";
import React, { useRef, useState } from "react"; // Added useRef
import { Button, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";

import { useAudioPlayer } from "@/src/hooks/useAudioPlayer";

export default function TextTranslatorScreen() {
  const [englishText, setEnglishText] = useState("");
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const englishInputRef = useRef<TextInput>(null); 

  const { isSpeaking, playSound } = useAudioPlayer();

  // useEffect for audio configuration and cleanup is now handled by useAudioPlayer hook.
  // If englishInputRef was used for focusing, that logic can remain or be added here.

  const handleTranslate = async () => {
    if (!englishText.trim()) {
      setYorubaText("");
      return;
    }
    setIsLoading(true);
    try {
      const translation = await translateToYorubaAPI(englishText);
      setYorubaText(translation);
    } catch (error) {
      console.error("Translation error:", error);
      setYorubaText("Error translating text.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearText = () => {
    setEnglishText("");
    setYorubaText("");
    englishInputRef.current?.focus(); // Focus the input after clearing
  };
  const handleSpeakYoruba = async () => {
    if (!yorubaText.trim() || yorubaText.startsWith("Error:")) {
      return;
    }
    playSound(yorubaText);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingContainer}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView 
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* <Stack.Screen options={{ title: "Text Translator" }} /> */} 
          {/* Title is set in _layout.tsx, so this line is optional here */}
          <Text style={styles.title}>English to Yoruba Translator</Text>

          <Text style={styles.label}>Enter English Text:</Text>
          <TextInput
            ref={englishInputRef} 
            style={styles.input}
            placeholder="Type English here..."
            value={englishText}
            onChangeText={setEnglishText}
            multiline
          />
          <View style={styles.buttonRow}>
            <Button title={isLoading ? "Translating..." : "Translate to Yoruba"} onPress={handleTranslate} disabled={isLoading} />
            {englishText.length > 0 && ( // Only show Clear button if there's text
              <Button title="Clear" onPress={handleClearText} color="#FF6347" /> // Tomato color for clear
            )}
          </View>

          {/* The Text Label and Button are now inside outputContainer */}
          <View style={styles.outputContainer}>
            <Text style={styles.translationBoxLabel}>Yoruba Translation:</Text>
            <Text style={styles.outputText}>
              {yorubaText || "Translation will appear here..."}
            </Text>
            {yorubaText && !yorubaText.startsWith("Error:") && (
              <Button 
                title={isSpeaking ? "Playing..." : "🔊 Play"} 
                onPress={handleSpeakYoruba} 
                disabled={isSpeaking || isLoading} // Also disable if translating
              />
            )}
          </View>

          <View style={styles.navLinkContainer}>
            {/* Custom "Go Back to Home" button removed, relying on header back button */}
            {/* <Link href="/" asChild><Pressable style={styles.navButton}><Text style={styles.navButtonText}>Go Back to Home</Text></Pressable></Link> */}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { // Keep title style
    fontSize: 24, fontWeight: "bold", marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    alignSelf: "flex-start",
  },
  input: {
    width: "100%",
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginTop: 5,
    marginBottom: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Or 'space-between' or add margins to buttons
    width: '100%',
    marginBottom: 15,
  },
  outputContainer: {
    width: "100%",
    borderColor: "lightgray",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginTop: 5,
    backgroundColor: "#f0f0f0",
    minHeight: 80,
  },
  outputText: {
    fontSize: 16,
    marginBottom: 10, // Added to give space for the button
  },
  // translationSection style is removed as the element is no longer structured this way.
  // The label and button are now inside outputContainer.
  translationBoxLabel: { // New style for the label inside the box
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  navLinkContainer: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  navButton: {
    backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8,
  },
  navButtonText: {
    color: 'white', fontSize: 16, fontWeight: 'bold',
  }
});