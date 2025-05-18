import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from "react";
import { Button, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";

export default function TextTranslatorScreen() {
  const [englishText, setEnglishText] = useState("");
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const englishInputRef = useRef<TextInput>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    console.log("[TextTranslatorScreen] useEffect - MOUNTED");
    const configureAudio = async () => {
      console.log("[TextTranslatorScreen] Configuring audio mode...");
      // --- Add these logs for inspection ---
      console.log("[TextTranslatorScreen] Inspecting Audio object:", JSON.stringify(Audio, null, 2));
      console.log("[TextTranslatorScreen] Audio.InterruptionModeIOS:", Audio.InterruptionModeIOS);
      console.log("[TextTranslatorScreen] Audio.InterruptionModeAndroid:", Audio.InterruptionModeAndroid);

      // Determine interruption modes with fallbacks
      const interruptionModeIOSValue = Audio.InterruptionModeIOS?.DoNotMix ?? 1;
      const interruptionModeAndroidValue = Audio.InterruptionModeAndroid?.DoNotMix ?? 1;

      if (Audio.InterruptionModeIOS?.DoNotMix === undefined) {
        console.warn("[TextTranslatorScreen] Audio.InterruptionModeIOS.DoNotMix is undefined. Using fallback value 1.");
      }
      if (Audio.InterruptionModeAndroid?.DoNotMix === undefined) {
        console.warn("[TextTranslatorScreen] Audio.InterruptionModeAndroid.DoNotMix is undefined. Using fallback value 1.");
      }

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: interruptionModeIOSValue,
          shouldDuckAndroid: true,
          interruptionModeAndroid: interruptionModeAndroidValue,
          playThroughEarpieceAndroid: false,
        });
        console.log("Audio mode configured for TextTranslatorScreen.");
      } catch (e) {
        console.error("Failed to set audio mode on TextTranslatorScreen. Error details:", e);
      }
    };

    configureAudio();

    return () => {
      console.log("[TextTranslatorScreen] Unmounting component. Minimal sound cleanup will run.");
      // Minimal, correct sound cleanup
      if (soundRef.current) {
        console.log("[TextTranslatorScreen] Sound object exists, attempting to unload (minimal cleanup).");
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current.unloadAsync()
          .then(() => {
            console.log("[TextTranslatorScreen] Minimal sound unloaded successfully during unmount.");
            soundRef.current = null;
          })
          .catch(error => {
            console.error("[TextTranslatorScreen] Minimal error unloading sound during unmount:", error);
            soundRef.current = null;
          })
          .finally(() => console.log("[TextTranslatorScreen] Minimal unmount sound cleanup finished."));
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
      soundRef.current.setOnPlaybackStatusUpdate(null); // Clear listener
      console.log("[TextTranslatorScreen] Stopped existing sound.");
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      console.log("[TextTranslatorScreen] Unloaded existing sound and nulled ref before playing new.");
    }
    setIsSpeaking(true);
    try {
      if (soundRef.current) { // Ensure any previous sound object is fully gone
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
                soundRef.current.setOnPlaybackStatusUpdate(null);
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                console.log("[TextTranslatorScreen] Sound unloaded due to playback error.");
              }
            }
          } else {
            if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
              setIsSpeaking(false);
              if (soundRef.current) {
                soundRef.current.setOnPlaybackStatusUpdate(null);
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                console.log("[TextTranslatorScreen] Sound unloaded after finishing playback.");
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
        soundRef.current.setOnPlaybackStatusUpdate(null);
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        console.log("[TextTranslatorScreen] Sound unloaded in catch block of handleSpeakYoruba.");
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
                disabled={isSpeaking || isLoading} // Also disable if translating
              />
            )}
          </View>
          <View style={styles.outputContainer}>
            <Text style={styles.outputText}>
              {yorubaText || "Translation will appear here..."}</Text>
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
    backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8,
  },
  navButtonText: {
    color: 'white', fontSize: 16, fontWeight: 'bold',
  }
});