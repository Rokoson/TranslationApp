import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import { Link } from "expo-router"; // Keep Stack if you want to set screen options here
import React, { useEffect, useRef, useState } from "react";
import { Button, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";

export default function TextTranslatorScreen() {
  const [englishText, setEnglishText] = useState("");
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const englishInputRef = useRef<TextInput>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1, 
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, 
          playThroughEarpieceAndroid: false,
        });
        console.log("Audio mode configured for TextTranslatorScreen.");
      } catch (e) {
        console.error("Failed to set audio mode on TextTranslatorScreen", e);
      }
    };

    configureAudio();

    return () => {
      if (soundRef.current) {
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
      return;
    }
    if (isSpeaking && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsSpeaking(true);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const audioDataUri = await speakYorubaTextAPI(yorubaText);
      if (audioDataUri && !audioDataUri.startsWith("Error:")) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioDataUri },
          { shouldPlay: false } 
        );
        soundRef.current = sound;
        soundRef.current.setOnPlaybackStatusUpdate(async (playbackStatus) => {
          if (!playbackStatus.isLoaded) {
            if (playbackStatus.error) {
              console.error(`Playback Error: ${playbackStatus.error}`);
              setIsSpeaking(false);
              if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          } else {
            if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
              setIsSpeaking(false);
              if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          }
        });
        await soundRef.current.playAsync();
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

          <View style={styles.navLinkContainer}>
            <Link href="/" asChild>
              <Pressable style={styles.navButton}><Text style={styles.navButtonText}>Go Back to Home</Text></Pressable>
            </Link>
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
    textAlignVertical: 'top',
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
  },
  navLinkContainer: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  navButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  navButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});