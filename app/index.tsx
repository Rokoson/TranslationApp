import { translateToYorubaAPI } from "@/src/services/translationApiService"; // Adjusted path
import { speakYorubaTextAPI } from "@/src/services/ttsApiService"; // Adjusted path
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from "react";
import { Button, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";

export default function Index() {
  const [englishText, setEnglishText] = useState("");
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // For TTS loading state
  const englishInputRef = useRef<TextInput>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1, // Corresponds to DoNotMix for iOS
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // Corresponds to DoNotMix for Android
          playThroughEarpieceAndroid: false,
        });
        console.log("Audio mode configured.");
      } catch (e) {
        console.error("Failed to set audio mode", e);
      }
    };

    configureAudio();

    return () => {
      // Cleanup sound when component unmounts
      if (soundRef.current) {
        console.log("Unloading sound on component unmount.");
        soundRef.current.unloadAsync();
      }
    };
  }, []);

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

  const handleSpeakYoruba = async () => {
    if (!yorubaText.trim() || yorubaText.startsWith("Error:")) {
      console.log("No valid Yoruba text to speak or text is an error message.");
      return;
    }

    if (isSpeaking && soundRef.current) {
      console.log("Already speaking or preparing to speak. Stopping previous sound.");
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (error) {
        console.error("Error stopping previous sound:", error);
      }
      // Fall through to start new playback after attempting to stop.
    }

    setIsSpeaking(true);

    try {
      // Ensure any lingering sound object (e.g. from a previous failed attempt that didn't clear ref) is handled
      if (soundRef.current) {
        console.log("Unloading existing sound object before new playback.");
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      console.log(`Requesting audio for: "${yorubaText}"`);
      const audioDataUri = await speakYorubaTextAPI(yorubaText);

      if (audioDataUri && !audioDataUri.startsWith("Error:")) {
        console.log("Received audio data URI. Attempting to create sound object...");
        // For debugging, you can log a snippet of the URI:
        // console.log("Audio Data URI (first 100 chars):", audioDataUri.substring(0, 100));

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioDataUri },
          { shouldPlay: false } // Load but don't play immediately
        );
        soundRef.current = sound;

        soundRef.current.setOnPlaybackStatusUpdate(async (playbackStatus) => {
          if (!playbackStatus.isLoaded) {
            if (playbackStatus.error) {
              console.error(`Playback Error: ${playbackStatus.error}`);
              setIsSpeaking(false);
              if (soundRef.current) { // Check again as it might be cleared
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          } else {
            if (playbackStatus.isPlaying) {
              // console.log("Playback is active.");
            }
            if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
              console.log("Playback finished.");
              setIsSpeaking(false);
              if (soundRef.current) { // Check again
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          }
        });
        
        console.log("Playing sound...");
        await soundRef.current.playAsync();
        // isSpeaking remains true until didJustFinish or an error occurs
      } else {
        console.error("Failed to get valid audio data URI. Received:", audioDataUri);
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Error in handleSpeakYoruba:", error);
      setIsSpeaking(false);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingContainer}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView 
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled" // Important for taps on buttons inside ScrollView to work while allowing dismiss
        >
          <Text style={styles.title}>English to Yoruba Translator</Text>

          <Text style={styles.label}>Enter English Text:</Text>
          <TextInput
            ref={englishInputRef}
            style={styles.input}
            placeholder="Type English here..."
            value={englishText}
            onChangeText={setEnglishText}
            multiline
            // You can customize the keyboard type, e.g.:
            // keyboardType="default" // "email-address", "numeric", "phone-pad", etc.
            // returnKeyType="done" // "go", "next", "search", "send"
          />
          <Button title={isLoading ? "Translating..." : "Translate to Yoruba"} onPress={handleTranslate} disabled={isLoading} />
          
          <View style={styles.translationSection}>
            <Text style={styles.label}>Yoruba Translation:</Text>
            {yorubaText && !yorubaText.startsWith("Error:") && (
              <Button 
                title={isSpeaking ? "Playing..." : "🔊 Play"} 
                onPress={handleSpeakYoruba} 
                disabled={isSpeaking}
              />
            )}
          </View>
          <View style={styles.outputContainer}>
            <Text style={styles.outputText}>
              {yorubaText || "Translation will appear here..."}</Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
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
    textAlignVertical: 'top', // For multiline input
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
  },
  translationSection: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
});