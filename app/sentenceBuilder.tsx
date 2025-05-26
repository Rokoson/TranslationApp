
import { translateToYorubaAPI } from "@/src/services/translationApiService";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";

import { useAudioPlayer } from "@/src/hooks/useAudioPlayer";
import { CategoryInfo, fetchAvailableCategories, fetchServerSentences, ServerSentence } from "@/src/services/contentApiService";

// --- Backend API Configuration ---
//const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // Make sure this is correct!
// --- End Backend API Configuration ---
const SENTENCES_PER_FETCH = 5;

export default function SentenceBuilderScreen() {
  const [englishText, setEnglishText] = useState(""); // Will hold the currently selected sentence
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false); // For translation loading
  const [isAutoTranslating, setIsAutoTranslating] = useState(false); // For when a sentence is selected
  const [apiSentences, setApiSentences] = useState<ServerSentence[]>([]);
  const [isFetchingSentences, setIsFetchingSentences] = useState(false); // For fetching sentences
  const [sentencesOffset, setSentencesOffset] = useState(0);
  const [allApiSentencesLoaded, setAllApiSentencesLoaded] = useState(false);
  const [currentSentenceSource, setCurrentSentenceSource] = useState<'local' | 'server'>('local');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Stores the 'value' of the category
  const [availableCategories, setAvailableCategories] = useState<CategoryInfo[]>([]);
  const [currentFetchedCategory, setCurrentFetchedCategory] = useState<string | null>(null); // Tracks the 'value' of the category for currently displayed server sentences
  const [isFetchingCategories, setIsFetchingCategories] = useState<boolean>(false);
  const { isSpeaking, playSound } = useAudioPlayer();

  useEffect(() => {
    // Initial load of categories
    handleRefreshCategories(true);

    const loadInitialLocalSentences = async () => {
      setIsFetchingSentences(true);
      setEnglishText("");
      setYorubaText("");
      try {
        const localSentencesData: ServerSentence[] = require('../assets/data/sentences.json');
        setApiSentences(localSentencesData.map((s, i) => ({ ...s, id: s.id || `local-${i}` })));
        setCurrentSentenceSource('local');
        setCurrentFetchedCategory(null);
        setSentencesOffset(localSentencesData.length);
        setAllApiSentencesLoaded(true);
      } catch (error) {
        console.error("[SentenceBuilderScreen] Error loading local sentences:", error);
        Alert.alert("Error", "Could not load initial sentences from the app. Ensure 'assets/data/sentences.json' exists and is valid.");
        setApiSentences([]);
      } finally {
        setIsFetchingSentences(false);
      }
    };

    loadInitialLocalSentences();
  }, []);

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
    await translateText(sentence, false);
    setIsAutoTranslating(false);
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
      if (!isInitialLoad) {
        Alert.alert("Categories Refreshed", "The list of categories has been updated.");
      }
    } catch (error) {
      console.error("[SentenceBuilderScreen] Failed to refresh categories:", error);
      Alert.alert("Error", "Could not refresh sentence categories. Please check your connection or try again later.");
      // Optionally, you might want to clear categories or leave them as they were: setAvailableCategories([]);
    } finally {
      setIsFetchingCategories(false);
    }
  };

  const handleFetchApiSentences = async () => {
    if (isFetchingSentences) return;

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

    setIsFetchingSentences(true);
    let offsetForThisFetch = 0;
    let shouldClearPreviousSentences = false;

    if (isNewCategoryContext) {
      offsetForThisFetch = 0;
      setSentencesOffset(0);
      setAllApiSentencesLoaded(false);
      shouldClearPreviousSentences = true;
      setEnglishText("");
      setYorubaText("");
      setCurrentFetchedCategory(categoryToFetch);
    } else if (currentSentenceSource === 'server') {
      offsetForThisFetch = sentencesOffset;
      shouldClearPreviousSentences = true; // Replace existing sentences
      setEnglishText("");
      setYorubaText("");
    }

    try {
      console.log(`[SentenceBuilderScreen] Attempting to fetch sentences with category: ${categoryToFetch}, offset: ${offsetForThisFetch}`);
      const newSentences = await fetchServerSentences(SENTENCES_PER_FETCH, offsetForThisFetch, categoryToFetch);
      console.log("[SentenceBuilderScreen] handleFetchApiSentences: Received newSentences from API:", JSON.stringify(newSentences, null, 2));
      setCurrentSentenceSource('server');

      if (newSentences.length > 0) {
        setApiSentences(prevSentences =>
          shouldClearPreviousSentences ? newSentences : [...prevSentences, ...newSentences]
        );
        setSentencesOffset(offsetForThisFetch + newSentences.length);
        setAllApiSentencesLoaded(newSentences.length < SENTENCES_PER_FETCH);
      } else {
        setAllApiSentencesLoaded(true);
        if (shouldClearPreviousSentences) {
          setApiSentences([]);
        }
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
      if (shouldClearPreviousSentences) setApiSentences([]);
    } finally {
      setIsFetchingSentences(false);
    }
  };

  const handleClearText = () => {
    setEnglishText("");
    setYorubaText("");
  };

  const handleSpeakYoruba = () => {
    if (yorubaText && !yorubaText.startsWith("Error:") && !isSpeaking) {
      playSound(yorubaText);
    }
  };

  const targetCategoryForFetch = selectedCategory; // This is the 'value'
  const displayCategoryContext = currentFetchedCategory; // This is the 'value'

  let fetchButtonTitle = "Fetch Sentences from Server";
  if (isFetchingSentences) {
    const targetDisplayName = getCategoryDisplayName(targetCategoryForFetch);
    fetchButtonTitle = `Fetching ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Sentences...`;
  } else if (currentSentenceSource === 'server') {
    const targetDisplayName = getCategoryDisplayName(targetCategoryForFetch);
    const currentDisplayContextName = getCategoryDisplayName(displayCategoryContext);

    if (targetCategoryForFetch === displayCategoryContext) {
      const categoryNameText = currentDisplayContextName ? `'${currentDisplayContextName}' ` : '';
      fetchButtonTitle = allApiSentencesLoaded
        ? `All ${categoryNameText}Server Sentences Loaded`
        : `Fetch More ${categoryNameText}Server Sentences`;
    } else {
      fetchButtonTitle = `Fetch ${targetDisplayName ? `'${targetDisplayName}' ` : 'All'} Sentences`;
    }
  } else if (currentSentenceSource === 'local') {
    const targetDisplayName = getCategoryDisplayName(targetCategoryForFetch);
    fetchButtonTitle = `Fetch ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Server Sentences`;
  }

  const isGenerallyBusy = isLoading || isAutoTranslating || isSpeaking || isFetchingSentences || isFetchingCategories;

  const fetchButtonDisabled =
    isGenerallyBusy ||
    (currentSentenceSource === 'server' &&
      targetCategoryForFetch === displayCategoryContext &&
      allApiSentencesLoaded);

  //console.log("[SentenceBuilderScreen] Rendering. Current availableCategories state:", JSON.stringify(availableCategories, null, 2));
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

          <View style={styles.categorySelectionContainer}>
            <Text style={styles.label}>Filter by Category (Optional):</Text>
            <View style={styles.categoryHeader}>
              <Button
                title={isFetchingCategories ? "Refreshing..." : "Refresh Categories"}
                onPress={() => handleRefreshCategories()}
                disabled={isFetchingCategories || (isGenerallyBusy && !isFetchingCategories)}
              />
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
            <Button title={fetchButtonTitle} onPress={handleFetchApiSentences} disabled={fetchButtonDisabled} />
          </View>

          <Text style={styles.label}>Select an English Sentence:</Text>
          {apiSentences.length > 0 ? (
            <View style={[styles.apiSentencesContainer, { borderWidth: 1, paddingVertical: 5 }]}>
              {apiSentences.map((sentenceObj, index) => {
                if (!sentenceObj || typeof sentenceObj.sentence !== 'string' || typeof sentenceObj.id === 'undefined') {
                  console.error(`[SentenceBuilderScreen] Invalid or incomplete sentence object at index ${index}:`, sentenceObj);
                  return <Text key={`error-${index}`} style={{ color: 'red', paddingVertical: 5, textAlign: 'center' }}>Error: Problem loading one of the sentences.</Text>;
                }
                return (
                  <Pressable
                    key={sentenceObj.id}
                    style={styles.sentenceButton}
                    onPress={() => handleSelectSentence(sentenceObj.sentence)}
                    disabled={isGenerallyBusy}
                  >
                    <Text style={styles.sentenceButtonText}>{sentenceObj.sentence}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.placeholderText}>
              {currentSentenceSource === 'local' ? "No local sentences loaded. Check 'assets/data/sentences.json'." : "No sentences to display. Try fetching from server or selecting a different category."}
            </Text>
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
              <Button title="Clear" onPress={handleClearText} color="#FF6347" disabled={isGenerallyBusy} />
            )}
          </View>

          <View style={styles.outputContainer}>
            <Text style={styles.translationBoxLabel}>Yoruba Translation:</Text>
            <Text style={styles.outputText}>
              {yorubaText || (englishText ? "Translation will appear here..." : "")}
            </Text>
            {yorubaText && !yorubaText.startsWith("Error:") && (
              <Button
                title={isSpeaking ? "Playing..." : "🔊 Play"}
                onPress={handleSpeakYoruba}
                disabled={isGenerallyBusy || isSpeaking}
              />
            )}
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
    borderColor: '#ccc',
    borderRadius: 5,
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
    marginTop: 10,
  },
  placeholderText: {
    textAlign: 'center',
    color: '#888',
    marginVertical: 10,
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
    marginBottom: 10,
  },
  translationBoxLabel: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
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
  }
});
