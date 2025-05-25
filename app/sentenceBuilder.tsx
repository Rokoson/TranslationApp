import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";

import { BACKEND_BASE_URL } from "@/src/config/apiConfig";
// --- Backend API Configuration ---
//const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // Make sure this is correct!
// --- End Backend API Configuration ---
const SENTENCES_PER_FETCH = 5;

interface ServerSentence {
  // Assuming your API returns objects with at least a 'text' field for the sentence
  // Adjust this interface based on your API's response structure
  id: string | number; 
  sentence: string; // Changed from 'text' to 'sentence' to match API
}

// Function to fetch sentences from the actual API, now returns ServerSentence[]
const fetchSentencesFromAPI = async (limit: number, offset: number): Promise<ServerSentence[]> => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL") { // Basic check
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL in sentenceBuilder.tsx.");
    throw new Error("Backend URL not configured.");
  }

  const apiUrl = `${BACKEND_BASE_URL}/api/sentences?limit=${limit}&offset=${offset}`;
  console.log(`[SentenceBuilderScreen] Fetching sentences from API: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[SentenceBuilderScreen] API Error: ${response.status}`, errorData);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
    }
    // Assuming the API returns an array of ServerSentence objects
    const sentencesData: ServerSentence[] = await response.json();
    console.log(`[SentenceBuilderScreen] Received ${sentencesData.length} sentences from API.`);
    // Return the array of ServerSentence objects
    return sentencesData;
  } catch (error) {
    console.error("[SentenceBuilderScreen] Error fetching sentences from API:", error);
    // Re-throw the error so it can be caught by the calling function
    throw error;
  }
};

export default function SentenceBuilderScreen() {
  const [englishText, setEnglishText] = useState(""); // Will hold the currently selected sentence
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false); // For translation loading
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false); // For when a sentence is selected
  const [apiSentences, setApiSentences] = useState<ServerSentence[]>([]);
  const [isFetchingSentences, setIsFetchingSentences] = useState(false); // For fetching sentences
  const [sentencesOffset, setSentencesOffset] = useState(0);
  const [allApiSentencesLoaded, setAllApiSentencesLoaded] = useState(false);
  const [currentSentenceSource, setCurrentSentenceSource] = useState<'local' | 'server'>('local');

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

    const loadInitialLocalSentences = async () => {
      setIsFetchingSentences(true);
      setEnglishText("");
      setYorubaText("");
      try {
        // Path relative to app/sentenceBuilder.tsx to root/assets/data/sentences.json
        // Ensure your project structure matches this path.
        const localSentencesData: ServerSentence[] = require('../assets/data/sentences.json');
        setApiSentences(localSentencesData.map((s, i) => ({ ...s, id: s.id || `local-${i}` })));
        setCurrentSentenceSource('local');
        // For local data, all are "loaded", and offset isn't for pagination in the same way
        setSentencesOffset(localSentencesData.length); 
        setAllApiSentencesLoaded(true); // True in the context of 'local' source being fully loaded
      } catch (error) {
        console.error("[SentenceBuilderScreen] Error loading local sentences:", error);
        Alert.alert("Error", "Could not load initial sentences from the app. Ensure 'assets/data/sentences.json' exists and is valid.");
        setApiSentences([]);
      } finally {
        setIsFetchingSentences(false);
      }
    };

    loadInitialLocalSentences();


    return () => {
      if (soundRef.current) {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current.unloadAsync().catch(e => console.error("Error unloading sound on unmount:", e));
        soundRef.current = null;
      }
    };
  }, []);

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

  // Renamed and modified to handle server fetching logic
  const handleFetchApiSentences = async () => {
    if (isFetchingSentences) return;
    // If currently showing server sentences and all are loaded, do nothing or inform user.
    if (currentSentenceSource === 'server' && allApiSentencesLoaded) {
      Alert.alert("All Loaded", "All sentences from the server have been loaded.");
      return;
    }

    setIsFetchingSentences(true);

    let offsetForThisFetch = 0;
    let clearPreviousSentences = false;

    if (currentSentenceSource === 'local' || (currentSentenceSource === 'server' && apiSentences.length === 0)) {
      // Switching from local to server OR initial fetch for server (if server list is empty)
      offsetForThisFetch = 0;
      setSentencesOffset(0); // Reset server offset
      setAllApiSentencesLoaded(false); // Reset server loaded flag
      clearPreviousSentences = true;
      setEnglishText(""); 
      setYorubaText("");
    } else if (currentSentenceSource === 'server') {
      // Continuing with server, load more
      offsetForThisFetch = sentencesOffset;
      // User wants to replace the current list of server sentences with the new fetched ones
      clearPreviousSentences = true;
      // It's good practice to also clear any selected sentence when the list is replaced
      setEnglishText("");
      setYorubaText("");
    }

    try {
      const newSentences = await fetchSentencesFromAPI(SENTENCES_PER_FETCH, offsetForThisFetch);
      setCurrentSentenceSource('server'); // Now dealing with server data

      if (newSentences.length > 0) {
        setApiSentences(prevSentences =>
          clearPreviousSentences ? newSentences : [...prevSentences, ...newSentences]
        );
        setSentencesOffset(offsetForThisFetch + newSentences.length);
        if (newSentences.length < SENTENCES_PER_FETCH) {
          setAllApiSentencesLoaded(true);
        } else {
          setAllApiSentencesLoaded(false); // Ensure this is reset if a full page was fetched
        }
      } else {
        // No new sentences found from server
        setAllApiSentencesLoaded(true);
        // If clearPreviousSentences is true, it means we intended to replace the list.
        // Since newSentences is empty, the apiSentences list should become empty.
        if (clearPreviousSentences) {
            setApiSentences([]);
        }

        if (offsetForThisFetch === 0) { // Distinguish message for initial fetch vs. "load more"
            Alert.alert("No Sentences", "No sentences were found on the server.");
        } else { // offsetForThisFetch > 0, meaning it was a "load more" type of action
            Alert.alert("No More Sentences", "No new sentences were found on the server.");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Could not fetch sentences from the server.");
      if (clearPreviousSentences) setApiSentences([]);
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

  console.log("[SentenceBuilderScreen] Rendering. apiSentences state:", apiSentences);
  
  let fetchButtonTitle = "Fetch Sentences from Server";
  if (isFetchingSentences) {
    fetchButtonTitle = "Fetching...";
  } else if (currentSentenceSource === 'server') {
    if (allApiSentencesLoaded) {
      fetchButtonTitle = "All Server Sentences Loaded";
    } else {
      fetchButtonTitle = `Fetch More Server Sentences`;
    }
  } else if (currentSentenceSource === 'local') {
    fetchButtonTitle = "Switch to Server Sentences";
  }

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
              title={fetchButtonTitle}
              onPress={handleFetchApiSentences}
              disabled={isFetchingSentences || (currentSentenceSource === 'server' && allApiSentencesLoaded) || isLoading || isAutoTranslating}
            />
          </View>

          <Text style={styles.label}>Select an English Sentence:</Text>
          {apiSentences.length > 0 && (
            <View style={[styles.apiSentencesContainer, { borderWidth: 1,  paddingVertical: 5 }]}>
              {apiSentences.map((sentenceObj, index) => {
                // Defensive check for the sentence object and its properties
                if (!sentenceObj || typeof sentenceObj.sentence !== 'string' || typeof sentenceObj.id === 'undefined') { // Check sentenceObj.sentence
                  console.error(`[SentenceBuilderScreen] Invalid or incomplete sentence object at index ${index}:`, sentenceObj);
                  // Optionally render a placeholder or skip this item
                  return <Text key={`error-${index}`} style={{color: 'red', paddingVertical: 5, textAlign: 'center'}}>Error: Problem loading one of the sentences.</Text>;
                }
                return (
                  <Pressable
                    key={sentenceObj.id}
                    style={styles.sentenceButton}
                    onPress={() => handleSelectSentence(sentenceObj.sentence)} // Use sentenceObj.sentence
                    disabled={isLoading || isAutoTranslating}
                  >
                    <Text style={styles.sentenceButtonText}>{sentenceObj.sentence}</Text> 
                  </Pressable>
                );
              })}
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
