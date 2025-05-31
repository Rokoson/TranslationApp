
import { translateToYorubaAPI } from "@/src/services/translationApiService";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";

import { useAudioPlayer } from "@/src/hooks/useAudioPlayer";
import { CategoryInfo, fetchAvailableCategories, fetchServerSentences, ServerSentence } from "@/src/services/contentApiService";
import { Ionicons } from '@expo/vector-icons'; // Import an icon set

// --- Backend API Configuration ---
//const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // Make sure this is correct!
// --- End Backend API Configuration ---
const SENTENCES_PER_FETCH = 1; // Fetch one flashcard at a time

export default function SentenceBuilderScreen() {
  // Flashcard state
  const [currentFlashcardItem, setCurrentFlashcardItem] = useState<ServerSentence | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Translation and TTS
  const [translatedYorubaSentence, setTranslatedYorubaSentence] = useState<string>("");
  const [isTranslatingSentence, setIsTranslatingSentence] = useState<boolean>(false);
  const { isSpeaking, playSound, stopSound } = useAudioPlayer();

  // Data fetching states
  const [isFetchingCard, setIsFetchingCard] = useState(false); // For fetching new card data
  const [sentencesOffset, setSentencesOffset] = useState(0);
  const [allApiSentencesLoaded, setAllApiSentencesLoaded] = useState(false);
  const [currentSentenceSource, setCurrentSentenceSource] = useState<'local' | 'server'>('local');

  // Category states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Stores the 'value' of the category
  const [availableCategories, setAvailableCategories] = useState<CategoryInfo[]>([]);
  const [currentFetchedCategory, setCurrentFetchedCategory] = useState<string | null>(null); // Tracks the 'value' of the category for currently displayed server sentences
  const [isFetchingCategories, setIsFetchingCategories] = useState<boolean>(false);

  const handleSetCurrentSentence = useCallback((sentenceObj: ServerSentence | null) => {
    if (isSpeaking) stopSound();
    setCurrentFlashcardItem(sentenceObj);
    setIsCardFlipped(false); // Always show the front of a new card
  }, [isSpeaking, stopSound]);

  useEffect(() => {
    handleRefreshCategories(true); // Initial load of categories
    const loadInitialLocalSentences = async () => {
      setIsFetchingCard(true);
      handleSetCurrentSentence(null); // Clear any existing card
      try {
        const localSentencesData: ServerSentence[] = require('@/assets/data/sentences.json');
        const processedLocalSentences = localSentencesData.map((s, i) => ({ ...s, id: s.id || `local-${i}` }));

        if (processedLocalSentences.length > 0) {
          handleSetCurrentSentence(processedLocalSentences[0]);
          setSentencesOffset(1); // We've "loaded" one sentence from the local source
          setAllApiSentencesLoaded(false); // For local, this means we've loaded the initial one, server can still be fetched.
        } else {
          handleSetCurrentSentence(null);
          setSentencesOffset(0);
          setAllApiSentencesLoaded(true); // No sentences to load
          Alert.alert("No Sentences", "No initial sentences found in the app. Ensure 'assets/data/sentences.json' is not empty.");
        }
        setCurrentSentenceSource('local');
        setCurrentFetchedCategory(null);
      } catch (error) {
        console.error("[SentenceBuilderScreen] Error loading local sentences:", error);
        Alert.alert("Error", "Could not load initial sentences from the app. Ensure 'assets/data/sentences.json' exists and is valid.");
        handleSetCurrentSentence(null);
        setSentencesOffset(0);
        setAllApiSentencesLoaded(true); // In case of error, effectively no local sentences are pending
      } finally {
        setIsFetchingCard(false);
      }
    };

    loadInitialLocalSentences();
  }, [handleSetCurrentSentence]);

  useEffect(() => {
    if (currentFlashcardItem) {
      setTranslatedYorubaSentence(""); // Clear previous translation
      setIsTranslatingSentence(true);
      translateToYorubaAPI(currentFlashcardItem.sentence)
        .then(translation => setTranslatedYorubaSentence(translation))
        .catch(error => {
          console.error("[SentenceFlashcardScreen] Translation error:", error);
          setTranslatedYorubaSentence("Translation failed.");
        })
        .finally(() => setIsTranslatingSentence(false));
    } else {
      setTranslatedYorubaSentence("");
      setIsTranslatingSentence(false);
    }
  }, [currentFlashcardItem]);


  const handleFlipCard = () => {
    if (currentFlashcardItem) {
      setIsCardFlipped(!isCardFlipped);
    }
  };


  const getCategoryDisplayName = useCallback((value: string | null): string | null => {
    if (!value) return null;
    const foundCategory = availableCategories.find(cat => cat.value === value);
    return foundCategory ? foundCategory.displayName : value; // Fallback to value if not found
  }, [availableCategories]);

  const handleRefreshCategories = async (isInitialLoad = false) => {
    if (isFetchingCategories && !isInitialLoad) return; // Prevent multiple simultaneous fetches unless it's the initial load

    setIsFetchingCategories(true);
    try {
      console.log("[SentenceBuilderScreen] handleRefreshCategories: Fetching new categories...");
      const fetchedCategories = await fetchAvailableCategories();
      //console.log("[SentenceBuilderScreen] handleRefreshCategories: Fetched new categories data:", JSON.stringify(fetchedCategories, null, 2));
      setAvailableCategories(fetchedCategories);
      // if (!isInitialLoad) { // Removed the alert
      //   Alert.alert("Categories Refreshed", "The list of categories has been updated.");
      // }
    } catch (error) {
      console.error("[SentenceBuilderScreen] Failed to refresh categories:", error);
      Alert.alert("Error", "Could not refresh sentence categories. Please check your connection or try again later.");
      // Optionally, you might want to clear categories or leave them as they were: setAvailableCategories([]);
    } finally {
      setIsFetchingCategories(false);
    }
  };

  const handleFetchApiCard = async () => {
    if (isFetchingCard) return;

    const categoryToFetch = selectedCategory; // This is the 'value' of the category
    console.log(`[SentenceBuilderScreen] handleFetchApiSentences: Called. categoryToFetch = '${categoryToFetch}', currentFetchedCategory = '${currentFetchedCategory}', currentSentenceSource = '${currentSentenceSource}'`);
    const isNewCategoryContext = categoryToFetch !== currentFetchedCategory || currentSentenceSource === 'local';
    const categoryToFetchDisplayName = getCategoryDisplayName(categoryToFetch);

    if (currentSentenceSource === 'server' && !isNewCategoryContext && allApiSentencesLoaded) {
      const alertMessage = categoryToFetchDisplayName
        ? `All sentences for category '${categoryToFetchDisplayName}' have been loaded.`
        : "All general sentences from the server have been loaded.";
      Alert.alert("All Loaded", alertMessage);
      return;
    }

    setIsFetchingCard(true);
    if (isSpeaking) stopSound();

    let offsetForThisFetch = 0; // For SENTENCES_PER_FETCH = 1, offset is usually 0 or managed by server

    if (isNewCategoryContext) {
      offsetForThisFetch = 0;
      setSentencesOffset(0);
      setAllApiSentencesLoaded(false);
      setCurrentFetchedCategory(categoryToFetch);
    } else if (currentSentenceSource === 'server') {
      offsetForThisFetch = sentencesOffset;
    }

    try {
      console.log(`[SentenceBuilderScreen] Attempting to fetch sentences with category: ${categoryToFetch}, offset: ${offsetForThisFetch}`);
      const newSentences = await fetchServerSentences(SENTENCES_PER_FETCH, offsetForThisFetch, categoryToFetch);
      console.log("[SentenceBuilderScreen] handleFetchApiSentences: Received newSentences from API:", JSON.stringify(newSentences, null, 2));
      setCurrentSentenceSource('server');

      if (newSentences.length > 0) {
        handleSetCurrentSentence(newSentences[0]);
        setSentencesOffset(offsetForThisFetch + newSentences.length);
        setAllApiSentencesLoaded(newSentences.length < SENTENCES_PER_FETCH);
      } else {
        handleSetCurrentSentence(null); // No new sentence found
        setAllApiSentencesLoaded(true);
        const categoryMsgPart = categoryToFetchDisplayName ? ` for category '${categoryToFetchDisplayName}'` : "";
        const alertTitle = offsetForThisFetch === 0 ? "No Sentences Found" : "No More Sentences";
        const alertMessage = offsetForThisFetch === 0
          ? `No sentences were found on the server${categoryMsgPart}.`
          : `No new sentences were found on the server${categoryMsgPart}.`;
        Alert.alert(alertTitle, alertMessage);
      }
    } catch (error) {
      console.error("[SentenceBuilderScreen] Error fetching API sentences:", error);
      Alert.alert("Error", "Could not fetch sentences from the server. Check console for details.");
      handleSetCurrentSentence(null);
      setAllApiSentencesLoaded(false); // Reset on error
    } finally {
      setIsFetchingCard(false);
    }
  };

  const handleSpeakPronunciation = () => {
    if (isSpeaking) {
      stopSound();
      return;
    }
    if (translatedYorubaSentence && !translatedYorubaSentence.startsWith("Error:") && !translatedYorubaSentence.startsWith("Translation failed.")) {
      playSound(translatedYorubaSentence);
    } else {
      Alert.alert("Cannot Play", "Yoruba translation is not ready or available for playback.");
    }
  };

  const targetCategoryForFetch = selectedCategory; // This is the 'value'
  const displayCategoryContext = currentFetchedCategory; // This is the 'value'

  let fetchButtonTitle = "Fetch New Flashcard";
  if (isFetchingCard) {
    const targetDisplayName = getCategoryDisplayName(targetCategoryForFetch);
    fetchButtonTitle = `Fetching ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Card...`;
  } else if (currentSentenceSource === 'server' && targetCategoryForFetch === displayCategoryContext && allApiSentencesLoaded) {
    const targetDisplayName = getCategoryDisplayName(targetCategoryForFetch);
    fetchButtonTitle = `All ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Server Cards Loaded`;
  } else if (currentSentenceSource === 'local') {
    const targetDisplayName = getCategoryDisplayName(targetCategoryForFetch);
    fetchButtonTitle = `Fetch ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Card from Server`;
  }

  const isGenerallyBusy = isTranslatingSentence || isSpeaking || isFetchingCard || isFetchingCategories;

  const fetchButtonDisabled =
    isGenerallyBusy ||
    (currentSentenceSource === 'server' &&
      targetCategoryForFetch === displayCategoryContext &&
      allApiSentencesLoaded);

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
          <Text style={styles.title}>Sentence Flashcard</Text>

          <View style={styles.categorySelectionContainer}>
            <Text style={styles.label}>Filter by Category (Optional):</Text>
            <View style={styles.categoryHeader}>
              <Pressable
                onPress={() => handleRefreshCategories()}
                disabled={isFetchingCategories || (isGenerallyBusy && !isFetchingCategories)}
                style={({ pressed }) => [
                  styles.refreshIconPressable,
                  (isFetchingCategories || (isGenerallyBusy && !isFetchingCategories)) && styles.disabledButton,
                  pressed && styles.refreshIconPressed,
                ]}
                accessibilityLabel="Refresh categories"
              >
                {isFetchingCategories ? <ActivityIndicator size="small" color="#007AFF" /> : <Ionicons name="refresh-circle-outline" size={28} color="#007AFF" />}
              </Pressable>
            </View>

            <View style={styles.categoryButtonsContainer}>
              {isFetchingCategories && availableCategories.length === 0 && <ActivityIndicator size="small" color="#0000ff" style={styles.loadingIndicator} />}
              {!isFetchingCategories && availableCategories.length === 0 && (
                <Text style={styles.placeholderText}>No categories available.</Text>
              )}
              {availableCategories.map(catInfo => ( // Display categories even if isFetchingCategories is true (for subsequent refreshes)
                <Pressable
                  key={catInfo.value}
                  style={[
                    styles.categoryButton,
                    selectedCategory === catInfo.value && styles.categoryButtonSelected,
                    (isGenerallyBusy || isFetchingCategories) && styles.disabledButton // Disable individual buttons if generally busy or specifically fetching categories
                  ]}
                  onPress={() => {
                     console.log("[SentenceBuilderScreen] Category selected/deselected. Value:", catInfo.value);
                     setSelectedCategory(prev => prev === catInfo.value ? null : catInfo.value);
                  }}
                  disabled={isGenerallyBusy || isFetchingCategories} // Overall disable if busy
                >
                  <Text style={
                    selectedCategory === catInfo.value
                      ? [styles.categoryButtonText, styles.categoryButtonTextSelected]
                      : styles.categoryButtonText
                  }>
                    {catInfo.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedCategory && (
              <Pressable
                onPress={() => {
                  console.log("[SentenceBuilderScreen] Clearing selected category.");
                  setSelectedCategory(null);
                }}
                style={[styles.clearCategoryButton, (isGenerallyBusy || isFetchingCategories) && styles.disabledButton]}
                disabled={isGenerallyBusy || isFetchingCategories}
              >
                <Text style={styles.clearCategoryButtonText}>Clear Selected Category</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.fetchButtonContainer}>
            <Button title={fetchButtonTitle} onPress={handleFetchApiCard} disabled={fetchButtonDisabled} />
          </View>

          {isFetchingCard && !currentFlashcardItem && (
            <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicator} />
          )}

          {!isFetchingCard && !currentFlashcardItem && (
             <Text style={styles.placeholderText}>No sentence to display. Fetch a new flashcard.</Text>
          )}

          {currentFlashcardItem && (
            <Pressable onPress={handleFlipCard} style={styles.flashcardContainer}>
              {!isCardFlipped ? (
                <View style={styles.flashcardFront}>
                  <Text style={styles.flashcardEnglishSentence}>
                    {currentFlashcardItem.sentence}
                  </Text>
                </View>
              ) : (
                <View style={styles.flashcardBack}>
                  {isTranslatingSentence ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.flashcardYorubaSentence}>
                      {translatedYorubaSentence || "Translation not available"}
                    </Text>
                  )}
                  <View style={styles.pronunciationButtonContainer}>
                    {translatedYorubaSentence && !isTranslatingSentence && !translatedYorubaSentence.startsWith("Error") && !translatedYorubaSentence.startsWith("Translation failed.") && (
                       <Button
                          title={isSpeaking ? "Playing... (Tap to Stop)" : "🔊 Play Pronunciation"}
                          onPress={handleSpeakPronunciation}
                          disabled={isTranslatingSentence || (isGenerallyBusy && !isSpeaking)}
                        />
                    )}
                  </View>
                </View>
              )}
            </Pressable>
          )}
          {currentFlashcardItem && !isGenerallyBusy ? (
            <Text style={styles.helperText}>Tap the card to flip it.</Text>
          ) : !currentFlashcardItem && !isFetchingCard ? (
            <Text style={styles.placeholderText}>
              Use the button above to fetch a flashcard.
            </Text>
          ) : null}
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
    marginTop: 10, // Adjusted margin
    alignSelf: "flex-start",
  },
  categorySelectionContainer: {
    width: '100%',
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 5,
    backgroundColor: '#f9f9f9',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // Aligns button to the right
    marginBottom: 10, // Space below the refresh button
    alignItems: 'center',
    height: 40, // Ensure consistent height for the header area
  },
  refreshIconPressable: {
    padding: 5, // Add some padding around the icon for easier pressing
  },
  refreshIconPressed: {
    opacity: 0.6, // Visual feedback when pressed
  },
  categoryButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: 5,
  },
  categoryButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#0056b3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  fetchButtonContainer: {
    width: '100%',
    marginBottom: 15,
  },
  placeholderText: {
    textAlign: 'center',
    color: '#888',
    marginVertical: 10,
    fontSize: 15,
  },
  clearCategoryButton: {
    marginTop: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  clearCategoryButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingIndicator: {
    marginVertical: 10,
    alignSelf: 'center', // Center the indicator if it's the only thing
  },
  // Flashcard Styles (adapted from ImageFlashcardScreen, adjust as needed for text)
  flashcardContainer: {
    width: '90%', // Or a fixed width like CARD_WIDTH from ImageFlashcard
    minHeight: 150, // Adjust based on typical sentence length
    marginVertical: 20,
    backgroundColor: '#FFF8E1', // Light warm cream background for the front
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 15, // Add padding for text content
  },
  flashcardFront: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  flashcardEnglishSentence: {
    fontSize: 22, // Slightly larger font size
    textAlign: 'center',
    color: '#5D4037', // Warm dark brown color for good contrast
    lineHeight: 30, // Improved line spacing for readability
    fontWeight: '500', // Medium weight for better presence
  },
  flashcardBack: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E8EAF6', // Softer background for the back
    width: '100%',
    height: '100%',
  },
  flashcardYorubaSentence: {
    fontSize: 22, // Adjust as needed
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1A237E', // Darker, complementary color
  },
  pronunciationButtonContainer: {
    marginTop: 15,
    width: '80%',
  },
  helperText: { marginTop: 15, fontSize: 14, color: '#555', textAlign: 'center' }
});
