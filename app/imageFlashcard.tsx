// /Users/davidolagunju/Projects/React-Native/TranslationApp/app/imageFlashcard.tsx
import { CategoryInfo, fetchAvailableImageCategories, fetchServerImageMetadata, ServerImageMetadata } from "@/src/services/contentApiService";
import { translateToYorubaAPI } from "@/src/services/translationApiService";
// import { speakYorubaTextAPI } from "@/src/services/ttsApiService"; // No longer fetching custom audio
// import { Audio } from 'expo-av'; // No longer using expo-av directly
import { useAudioPlayer } from "@/src/hooks/useAudioPlayer"; // Import audio player hook
import { Image } from 'expo-image'; // Using expo-image for better performance
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Dimensions, // For potential card sizing
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View
} from "react-native";

// Map local asset filenames from images.json to their require() paths
const localImageSources: { [key: string]: ReturnType<typeof require> } = {
  "assets/images/animals_bird.png": require('../assets/images/animals_bird.png'),
  "assets/images/animals_cat.png": require('../assets/images/animals_cat.png'),
  "assets/images/animals_dog.png": require('../assets/images/animals_dog.png'),
  "assets/images/body_parts_ears.png": require('../assets/images/body_parts_ears.png'),
  "assets/images/body_parts_hands.png": require('../assets/images/body_parts_hands.png'),
  // Add other local images here, matching the 'asset_filename' in images.json
};

const IMAGES_PER_FETCH = 1; // Fetch one flashcard at a time

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = CARD_WIDTH * 0.75; // Or your desired aspect ratio

export default function ImageFlashcardScreen() {
  const [currentFlashcardItem, setCurrentFlashcardItem] = useState<ServerImageMetadata | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // States for translation and TTS audio playback
  const [translatedYorubaName, setTranslatedYorubaName] = useState<string>("");
  const [isTranslatingName, setIsTranslatingName] = useState<boolean>(false);
  // Removed states for expo-av: isFetchingPronunciation, sound, isPlayingPronunciation

  const { isSpeaking, playSound, stopSound } = useAudioPlayer(); // Use the hook
  
  const [apiImageHolder, setApiImageHolder] = useState<(ServerImageMetadata & { resolvedSource?: ReturnType<typeof require> })[]>([]);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [imagesOffset, setImagesOffset] = useState(0); // Kept for consistency, though less critical with IMAGES_PER_FETCH = 1
  const [allApiImagesLoaded, setAllApiImagesLoaded] = useState(false);

  const [selectedImageCategory, setSelectedImageCategory] = useState<string | null>(null);
  const [availableImageCategories, setAvailableImageCategories] = useState<CategoryInfo[]>([]);
  const [isFetchingImageCategories, setIsFetchingImageCategories] = useState<boolean>(false);
  const [currentFetchedImageCategory, setCurrentFetchedImageCategory] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialLocalImages = async () => {
      setIsFetchingImages(true);
      setCurrentFlashcardItem(null);
      setIsCardFlipped(false);
      try {
        const localImageMetadataModule = require('../assets/data/images.json');
        if (!Array.isArray(localImageMetadataModule)) {
          Alert.alert("Loading Error", "Local image data ('images.json') did not load correctly.");
          setApiImageHolder([]);
          setIsFetchingImages(false);
          return;
        }
        const localImageMetadata: ServerImageMetadata[] = localImageMetadataModule;
        const processedLocalImages = localImageMetadata.map((img, index) => ({
          ...img,
          id: img.id || `local-${index}`,
          resolvedSource: localImageSources[img.asset_filename],
        }));

        setApiImageHolder(processedLocalImages);
        if (processedLocalImages.length > 0) {
          await handleSetCurrentFlashcard(processedLocalImages[0]);
        }
        setImagesOffset(processedLocalImages.length);
        setAllApiImagesLoaded(false);
        setCurrentFetchedImageCategory(null);
      } catch (error) {
        console.error("[ImageFlashcardScreen] Error loading local images:", error);
        Alert.alert("Error", "Could not load initial images.");
        setApiImageHolder([]);
      } finally {
        setIsFetchingImages(false);
      }
    };

    loadInitialLocalImages();
    handleRefreshImageCategories(true);
  }, []);

  useEffect(() => {
    if (currentFlashcardItem) {
      setTranslatedYorubaName("");
      setIsTranslatingName(true);
      const englishTextToTranslate = currentFlashcardItem.english_caption || currentFlashcardItem.english_name;

      if (englishTextToTranslate) {
        translateToYorubaAPI(englishTextToTranslate)
          .then(translation => setTranslatedYorubaName(translation))
          .catch(error => {
            console.error("[ImageFlashcardScreen] Translation error:", error);
            setTranslatedYorubaName(currentFlashcardItem.yoruba_name || "Translation failed.");
          })
          .finally(() => setIsTranslatingName(false));
      } else if (currentFlashcardItem.yoruba_name) {
        setTranslatedYorubaName(currentFlashcardItem.yoruba_name);
        setIsTranslatingName(false);
      } else {
        setTranslatedYorubaName("Name not available.");
        setIsTranslatingName(false);
      }
    } else {
      setTranslatedYorubaName("");
      setIsTranslatingName(false);
    }
  }, [currentFlashcardItem]);

  const getCategoryDisplayName = useCallback((value: string | null): string | null => {
    if (!value) return null;
    const foundCategory = availableImageCategories.find(cat => cat.value === value);
    return foundCategory ? foundCategory.displayName : value;
  }, [availableImageCategories]);

  const handleSetCurrentFlashcard = async (item: ServerImageMetadata) => {
    if (isSpeaking) {
      stopSound(); // Stop any ongoing speech from the hook
    }
    setCurrentFlashcardItem(item);
    setIsCardFlipped(false);
  };

  const handleSpeakPronunciation = async () => {
    if (isSpeaking) {
      stopSound(); // If already speaking, stop it
      return;
    }

    const textToSpeak = translatedYorubaName;
    if (!textToSpeak || textToSpeak === "Translation failed." || textToSpeak === "Name not available." || textToSpeak === "Translating...") {
      Alert.alert("Cannot Play", "Yoruba name is not ready or available for playback.");
      return;
    }
    try {
      // Use the playSound function from the useAudioPlayer hook
      await playSound(textToSpeak);
    } catch (error) {
      console.error("[ImageFlashcardScreen] Error playing pronunciation with useAudioPlayer:", error);
      Alert.alert(
        "Pronunciation Error",
        `Could not play pronunciation. ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const handleRefreshImageCategories = async (isInitialLoad = false) => {
    if (isFetchingImageCategories && !isInitialLoad) return;
    setIsFetchingImageCategories(true);
    try {
      const fetchedCategories = await fetchAvailableImageCategories();
      setAvailableImageCategories(fetchedCategories);
    } catch (error) {
      console.error("[ImageFlashcardScreen] Failed to refresh image categories:", error);
      Alert.alert("Error", "Could not refresh image categories.");
    } finally {
      setIsFetchingImageCategories(false);
    }
  };

  const handleFetchApiImages = async () => {
    if (isFetchingImages) return;

    const categoryToFetch = selectedImageCategory;
    const isNewCategoryContext = categoryToFetch !== currentFetchedImageCategory;
    const categoryToFetchDisplayName = getCategoryDisplayName(categoryToFetch);

    if (!isNewCategoryContext && allApiImagesLoaded && currentFetchedImageCategory !== null) {
      Alert.alert("All Loaded", `All images for category '${categoryToFetchDisplayName || 'general'}' have been loaded.`);
      return;
    }

    setIsFetchingImages(true);
    setCurrentFlashcardItem(null);
    setIsCardFlipped(false);
    if (isSpeaking) {
      stopSound();
    }

    let offsetForThisFetch = 0; // Always fetch the "next" single image
    // If it's a new category, or no category, we effectively start from 0 for that context.
    // The server-side logic for IMAGES_PER_FETCH=1 should handle giving a "random" or "next" image.
    // For simplicity here, we don't track a specific offset for IMAGES_PER_FETCH=1,
    // but rely on the server to provide a new image.
    // If you need strict "next" functionality, imagesOffset state would need more careful management.

    setImagesOffset(0); // Reset for this fetch, or manage based on server behavior
    setAllApiImagesLoaded(false);
    setCurrentFetchedImageCategory(categoryToFetch);

    try {
      const newImages = await fetchServerImageMetadata(IMAGES_PER_FETCH, offsetForThisFetch, categoryToFetch);
      if (newImages.length > 0) {
        setApiImageHolder(newImages);
        await handleSetCurrentFlashcard(newImages[0]);
        // With IMAGES_PER_FETCH = 1, it's harder to know if "all" are loaded without more server info.
        // We might assume there's always more unless the server explicitly says no more.
        // For now, we'll set allApiImagesLoaded based on whether we got an image or not.
        setAllApiImagesLoaded(false); // Assume more could be fetched
      } else {
        setApiImageHolder([]);
        setAllApiImagesLoaded(true);
        Alert.alert("No Images Found", `No images were found on the server${categoryToFetchDisplayName ? ` for category '${categoryToFetchDisplayName}'` : ''}.`);
      }
    } catch (error) {
      console.error("Error fetching images from server:", error);
      Alert.alert("Error", "Could not fetch images from the server.");
      setApiImageHolder([]);
      setAllApiImagesLoaded(false);
      setCurrentFetchedImageCategory(null);
    } finally {
      setIsFetchingImages(false);
    }
  };

  const handleFlipCard = () => {
    if (currentFlashcardItem) setIsCardFlipped(!isCardFlipped);
  };

  const isGenerallyBusy =
    isFetchingImages ||
    isFetchingImageCategories ||
    isTranslatingName ||
    // isFetchingPronunciation; // Removed as TTS is now handled by useAudioPlayer
    isSpeaking; // Add isSpeaking from the hook
  let fetchButtonTitle = "Fetch New Flashcard";
  if (isFetchingImages) {
    const targetDisplayName = getCategoryDisplayName(selectedImageCategory);
    fetchButtonTitle = `Fetching ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Card...`;
  } else if (allApiImagesLoaded && selectedImageCategory === currentFetchedImageCategory && currentFetchedImageCategory !== null) {
    const targetDisplayName = getCategoryDisplayName(selectedImageCategory);
    fetchButtonTitle = `All ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Cards Loaded`;
  }


  const isFetchButtonDisabled =
    isGenerallyBusy ||
    (allApiImagesLoaded && selectedImageCategory === currentFetchedImageCategory && currentFetchedImageCategory !== null && !isFetchingImages);

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
          <Text style={styles.title}>Yoruba Image Flashcards</Text>

          <View style={styles.categorySelectionContainer}>
            <Text style={styles.label}>Filter by Category (Optional):</Text>
            <View style={styles.categoryHeader}>
              <Pressable
                onPress={() => handleRefreshImageCategories()}
                disabled={isFetchingImageCategories || (isGenerallyBusy && !isFetchingImageCategories)}
                style={({ pressed }) => [
                  styles.refreshIconPressable,
                  (isFetchingImageCategories || (isGenerallyBusy && !isFetchingImageCategories)) && styles.disabledButton,
                  pressed && styles.refreshIconPressed,
                ]}
                accessibilityLabel="Refresh image categories"
              >
                {isFetchingImageCategories ? <ActivityIndicator size="small" color="#007AFF" /> : <Text style={styles.refreshIconText}>🔄</Text>}
              </Pressable>
            </View>

            <View style={styles.categoryButtonsContainer}>
              {isFetchingImageCategories && availableImageCategories.length === 0 ? <ActivityIndicator size="small" color="#0000ff" style={styles.loadingIndicator} /> : null}
              {!isFetchingImageCategories && availableImageCategories.length === 0 && (
                <Text style={styles.placeholderText}>No image categories available.</Text>
              )}
              {availableImageCategories.map(catInfo => (
                <Pressable
                  key={catInfo.value}
                  style={[
                    styles.categoryButton,
                    selectedImageCategory === catInfo.value && styles.categoryButtonSelected,
                    (isGenerallyBusy || isFetchingImageCategories) && styles.disabledButton
                  ]}
                  onPress={() => setSelectedImageCategory(prev => prev === catInfo.value ? null : catInfo.value)}
                  disabled={isGenerallyBusy || isFetchingImageCategories}
                >
                  <Text style={selectedImageCategory === catInfo.value ? [styles.categoryButtonText, styles.categoryButtonTextSelected] : styles.categoryButtonText}>
                    {catInfo.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedImageCategory && (
              <Pressable onPress={() => setSelectedImageCategory(null)} style={[styles.clearCategoryButton, (isGenerallyBusy || isFetchingImageCategories) && styles.disabledButton]} disabled={isGenerallyBusy || isFetchingImageCategories}>
                <Text style={styles.clearCategoryButtonText}>Clear Selected Category</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.fetchButtonContainer}>
            <Button
              title={fetchButtonTitle}
              onPress={handleFetchApiImages}
              disabled={isFetchButtonDisabled}
            />
          </View>

          {isFetchingImages && !currentFlashcardItem && (
            <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicator} />
          )}

          {!isFetchingImages && !currentFlashcardItem && apiImageHolder.length === 0 && (
             <Text style={styles.placeholderText}>No image to display. Fetch a new flashcard.</Text>
          )}

          {currentFlashcardItem && (
            <Pressable onPress={handleFlipCard} style={styles.flashcardContainer}>
              {!isCardFlipped ? (
                <View style={styles.flashcardFrontContent}>
                  {(() => {
                    const source = currentFlashcardItem.resolvedSource
                      ? currentFlashcardItem.resolvedSource
                      : (currentFlashcardItem.url ? { uri: currentFlashcardItem.url } : null);
                    if (source) {
                      return (
                        <Image
                          source={source}
                          style={styles.flashcardImage}
                          contentFit="contain"
                          onError={(e) => console.error("Image load error:", e.nativeEvent.error)}
                        />
                      );
                    }
                    return (
                      <View style={[styles.flashcardImage, styles.imagePlaceholder]}>
                        <Text style={styles.imagePlaceholderText}>No Image</Text>
                      </View>
                    );
                  })()}
                  {currentFlashcardItem.english_caption && (
                    <Text style={styles.flashcardEnglishCaption} numberOfLines={2} ellipsizeMode="tail">
                      {currentFlashcardItem.english_caption}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.flashcardBack}>
                  {isTranslatingName ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.flashcardYorubaName}>
                      {translatedYorubaName || "Name not available"}
                    </Text>
                  )}
                  <View style={styles.pronunciationButtonContainer}>
                    {translatedYorubaName && !isTranslatingName && translatedYorubaName !== "Name not available." && translatedYorubaName !== "Translation failed." && (
                       <Button
                          title={
                              isSpeaking ? "Playing... (Tap to Stop)" : "🔊 Play Pronunciation"
                          }
                          onPress={handleSpeakPronunciation}
                          disabled={isTranslatingName || (isGenerallyBusy && !isSpeaking) } // Allow tapping to stop if speaking
                        />
                    )}
                  </View>
                </View>
              )}
            </Pressable>
          )}
          {currentFlashcardItem && !isGenerallyBusy && (
            <Text style={styles.helperText}>Tap the card to flip it.</Text>
          )}
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
    textAlign: 'center',
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
    justifyContent: 'flex-end',
    marginBottom: 10,
    alignItems: 'center',
    height: 40,
  },
  refreshIconPressable: {
    padding: 5,
  },
  refreshIconPressed: {
    opacity: 0.6,
  },
  refreshIconText: {
    fontSize: 24,
    color: "#007AFF",
  },
  categoryButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10, // Reduced margin
    marginBottom: 5,
    alignSelf: "flex-start",
  },
  fetchButtonContainer: {
    width: '100%',
    marginBottom: 20, // Increased margin
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
  flashcardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  flashcardFrontContent: {
    flex: 1,
    justifyContent: 'center', // Distribute space if needed, or use 'flex-start' / 'space-between'
    alignItems: 'center',
    width: '100%',
    padding: 10, // Add some padding around the content
  },
  flashcardImage: {
    width: '95%', // Make image a bit wider
    height: '80%', // Increase height to make image larger, leaving space for caption
    marginBottom: 10, // Space between image and caption
  },
  flashcardEnglishCaption: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    color: '#333', // Dark grey color for the caption
  },
  flashcardBack: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25, // Increased padding
    backgroundColor: '#E8EAF6', // A softer, more appealing background (light lavender)
    width: '100%',
    height: '100%',
  },
  flashcardYorubaName: {
    fontSize: 26, // Slightly larger font for the name
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15, // Adjusted space, button container will add more
    color: '#1A237E', // Darker, complementary color (dark indigo)
  },
  imagePlaceholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  placeholderText: {
    textAlign: 'center',
    color: '#888',
    marginVertical: 15,
    fontSize: 15,
  },
  loadingIndicator: {
    marginVertical: 20,
    alignSelf: 'center',
  },
  disabledButton: {
    opacity: 0.5,
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
  helperText: {
    marginTop: 15,
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  pronunciationButtonContainer: {
    marginTop: 15, // Add space above the button
    width: '80%', // Optional: constrain button width
  }
});
