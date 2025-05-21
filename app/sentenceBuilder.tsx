import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";

// Assuming BACKEND_BASE_URL is defined similarly to ImageCaptionScreen or in a shared config
// const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // Not needed for mock
const SENTENCES_PER_FETCH = 5;

interface ServerSentence {
  // Assuming your API returns objects with at least a 'text' field for the sentence
  // Adjust this interface based on your API's response structure
  id: string | number; // Or some unique identifier
  text: string;
}

// Mock function to fetch sentences from a local asset
const fetchSentencesFromAPI = async (limit: number, offset: number): Promise<string[]> => {
  console.log(`[SentenceBuilderScreen] MOCK Fetching sentences: limit=${limit}, offset=${offset}`);
  return new Promise((resolve, reject) => {
    setTimeout(() => { // Simulate network delay
      try {
        // Use require for local JSON files. Adjust path if your assets folder is elsewhere.
        // Assuming assets folder is at the root, and sentenceBuilder.tsx is in app/
        const allSentences: ServerSentence[] = require('../assets/data/sentences.json');
        
        const paginatedSentences = allSentences.slice(offset, offset + limit);
        console.log(`[SentenceBuilderScreen] MOCK Returning ${paginatedSentences.length} sentences.`);
        resolve(paginatedSentences.map(s => s.text));
      } catch (error) {
        console.error("[SentenceBuilderScreen] MOCK Error reading sentences.json:", error);
        // Ensure sentences.json exists at assets/data/sentences.json and is valid JSON
        reject(error);
      }
    }, 500); // 500ms delay
  });
};

export default function SentenceBuilderScreen() {
  const [englishText, setEnglishText] = useState(""); // Will hold the currently selected sentence
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false); // For translation loading
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false); // For when a sentence is selected
  const [apiSentences, setApiSentences] = useState<string[]>([]);
  const [isFetchingSentences, setIsFetchingSentences] = useState(false); // For fetching sentences
  const [sentencesOffset, setSentencesOffset] = useState(0);
  const [allApiSentencesLoaded, setAllApiSentencesLoaded] = useState(false);

  // const englishInputRef = useRef<TextInput>(null); // No longer needed
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const configureAudio = async () => {
      const interruptionModeIOSValue = Audio.InterruptionModeIOS?.DoNotMix ?? 1;
      const interruptionModeAndroidValue = Audio.InterruptionModeAndroid?.DoNotMix ?? 1;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: interruptionModeIOSValue,
          shouldDuckAndroid: true,
          interruptionModeAndroid: interruptionModeAndroidValue,
          playThroughEarpieceAndroid: false,
        });
        console.log("Audio mode configured for SentenceBuilderScreen.");
      } catch (e) {
        console.error("Failed to set audio mode on SentenceBuilderScreen. Error details:", e);
      }
    };
    configureAudio();

    // Preload initial sentences when the screen mounts
    handleFetchApiSentences(); 

    return () => {
      if (soundRef.current) {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current.unloadAsync().catch(e => console.error("Error unloading sound on unmount:", e));
        soundRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const playSound = useCallback(async (textToSpeak: string) => {
    if (!textToSpeak.trim() || textToSpeak.startsWith("Error:")) return;

    if (isSpeaking && soundRef.current) {
      await soundRef.current.stopAsync();
      soundRef.current.setOnPlaybackStatusUpdate(null);
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsSpeaking(true);
    try {
      const audioDataUri = await speakYorubaTextAPI(textToSpeak);
      if (audioDataUri && !audioDataUri.startsWith("Error:")) {
        const { sound } = await Audio.Sound.createAsync({ uri: audioDataUri }, { shouldPlay: false });
        soundRef.current = sound;
        soundRef.current.setOnPlaybackStatusUpdate(async (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              setIsSpeaking(false);
              if (soundRef.current) {
                soundRef.current.setOnPlaybackStatusUpdate(null);
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          } else if (status.didJustFinish && !status.isLooping) {
            setIsSpeaking(false);
            if (soundRef.current) {
              soundRef.current.setOnPlaybackStatusUpdate(null);
              await soundRef.current.unloadAsync();
              soundRef.current = null;
            }
          }
        });
        await soundRef.current.playAsync();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Error in playSound:", error);
      setIsSpeaking(false);
      if (soundRef.current) {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }
  }, [isSpeaking]);

  const translateText = useCallback(async (textToTranslate: string, autoPlaySound = false) => {
    if (!textToTranslate.trim()) {
      setYorubaText("");
      return "";
    }
    setIsLoading(true);
    let translation = "";
    try {
      translation = await translateToYorubaAPI(textToTranslate);
      setYorubaText(translation);
      if (autoPlaySound && translation && !translation.startsWith("Error:")) {
        await playSound(translation);
      }
    } catch (error) {
      console.error("Translation error:", error);
      setYorubaText("Error translating text.");
      translation = "Error translating text.";
    } finally {
      setIsLoading(false);
    }
    return translation;
  }, [playSound]);

  const handleSelectSentence = async (sentence: string) => {
    setEnglishText(sentence);
    setYorubaText("Translating...");
    setIsAutoTranslating(true);
    await translateText(sentence, false); // Translate, but DO NOT autoplay sound
    setIsAutoTranslating(false);
  };

  const handleFetchApiSentences = async () => {
    if (isFetchingSentences || (allApiSentencesLoaded && apiSentences.length > 0)) {
      return;
    }
    setIsFetchingSentences(true);
    try {
      const newSentences = await fetchSentencesFromAPI(SENTENCES_PER_FETCH, sentencesOffset);
      if (newSentences.length > 0) {
        // Replace current sentences with the new batch
        setApiSentences(newSentences);
        setSentencesOffset(prevOffset => prevOffset + newSentences.length);
        if (newSentences.length < SENTENCES_PER_FETCH) {
          setAllApiSentencesLoaded(true);
        }
      } else {
        setAllApiSentencesLoaded(true);
        // Only show "No More Sentences" if it's not the initial load or if some were already loaded
        if (sentencesOffset > 0 || apiSentences.length > 0) {
            Alert.alert("No More Sentences", "No new sentences were found on the server.");
        } else if (sentencesOffset === 0 && apiSentences.length === 0) {
            Alert.alert("No Sentences", "No sentences were found to load.");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Could not fetch sentences from the server.");
    } finally {
      setIsFetchingSentences(false);
    }
  };

  const handleClearText = () => {
    setEnglishText("");
    setYorubaText("");
  };

  const handleSpeakYoruba = () => {
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
          <Text style={styles.title}>Sentence Builder</Text>

          <View style={styles.fetchButtonContainer}>
            <Button
              title={isFetchingSentences ? "Fetching..." : (allApiSentencesLoaded ? "All Sentences Loaded" : `Fetch ${apiSentences.length > 0 ? 'More ' : 'Initial '}Sentences`)}
              onPress={handleFetchApiSentences}
              disabled={isFetchingSentences || allApiSentencesLoaded || isLoading || isAutoTranslating}
            />
          </View>

          <Text style={styles.label}>Select an English Sentence:</Text>
          {apiSentences.length > 0 && (
            <View style={styles.apiSentencesContainer}>
            {apiSentences.map((sentence, index) => (
              <Pressable
                key={index} // Using index as key is okay if sentences don't reorder/get deleted often
                style={styles.sentenceButton}
                onPress={() => handleSelectSentence(sentence)}
                disabled={isLoading || isAutoTranslating}
              >
                <Text style={styles.sentenceButtonText}>{sentence}</Text>
              </Pressable>
            ))}
          </View>
          )}
          
          {englishText ? (
            <View style={styles.selectedSentenceContainer}>
              <Text style={styles.label}>Selected:</Text>
              <Text style={styles.selectedSentenceText}>{englishText}</Text>
            </View>
          ) : (
            apiSentences.length > 0 && <Text style={styles.placeholderText}>Select a sentence above to see its translation.</Text>
          )}

          <View style={styles.buttonRow}>            
            {(englishText.length > 0 || yorubaText.length > 0) && (
              <Button title="Clear" onPress={handleClearText} color="#FF6347" />
            )}
          </View>

          <View style={styles.translationSection}>
            <Text style={styles.label}>Yoruba Translation:</Text>
            {yorubaText && !yorubaText.startsWith("Error:") && (
              <Button
                title={isSpeaking ? "Playing..." : "🔊 Play"}
                onPress={handleSpeakYoruba}
                disabled={isSpeaking || isLoading || isAutoTranslating}
              />
            )}
          </View>
          <View style={styles.outputContainer}>
            <Text style={styles.outputText}>
              {yorubaText || (englishText ? "Translation will appear here..." : "")}
            </Text>
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
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24, fontWeight: "bold", marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    alignSelf: "flex-start",
  },
  fetchButtonContainer: {
    width: '100%',
    marginBottom: 15,
  },
  selectedSentenceContainer: {
    width: '100%',
    padding: 10,
    marginVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedSentenceText: {
    fontSize: 16,
    color: '#333',
    marginTop: 4,
  },
  apiSentencesContainer: {
    width: '100%',
    marginBottom: 15,
    marginTop: 5,
  },
  sentenceButton: {
    backgroundColor: '#e7e7e7',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginBottom: 8,
    alignItems: 'center',
  },
  sentenceButtonText: {
    fontSize: 15,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 15,
    marginTop: 10, // Added some top margin
  },
  placeholderText: {
    textAlign: 'center',
    color: '#888',
    marginVertical: 20,
    fontSize: 15,
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
    marginBottom: 5,
  },
});
