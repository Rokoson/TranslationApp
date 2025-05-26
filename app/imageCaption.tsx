import { useAudioPlayer } from "@/src/hooks/useAudioPlayer"; // Import audio player hook
import { generateCaptionAPI } from "@/src/services/captionApiService";
import { CategoryInfo, fetchAvailableImageCategories, fetchServerImageMetadata, ServerImageMetadata } from "@/src/services/contentApiService";
import { translateToYorubaAPI } from "@/src/services/translationApiService"; // Import translation service
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Button, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
// Note: Ensure you have Ionicons installed in your project if you decide to use it for icons
// Assuming you have a config file for backend URL
// import { BACKEND_BASE_URL } from "../src/config/apiConfig";

// --- Backend API Configuration ---
//const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // Make sure this is correct!
// --- End Backend API Configuration ---

const SCROLL_AMOUNT_IMAGES = 140; // Adjusted scroll amount
const IMAGES_PER_FETCH = 10; // Define how many images to fetch at once

// Map local asset filenames from images.json to their require() paths
// This ensures React Native's bundler correctly handles these static assets.
// IMPORTANT: Update this map if you add or change local images in images.json
const localImageSources: { [key: string]: ReturnType<typeof require> } = {
  "assets/images/animals_bird.png": require('../assets/images/animals_bird.png'),
  "assets/images/animals_cat.png": require('../assets/images/animals_cat.png'),
  "assets/images/animals_dog.png": require('../assets/images/animals_dog.png'),
  "assets/images/body_parts_ears.png": require('../assets/images/body_parts_ears.png'),
  "assets/images/body_parts_hands.png": require('../assets/images/body_parts_hands.png'),
  // Add other local images here, matching the 'asset_filename' in images.json
};

export default function ImageCaptionScreen() {
  const [selectedImage, setSelectedImage] = useState<ServerImageMetadata | null>(null);
  const [englishCaption, setEnglishCaption] = useState(""); // Renamed for clarity
  const [yorubaCaption, setYorubaCaption] = useState("");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false); // For API-based caption generation
  const [isTranslatingCaption, setIsTranslatingCaption] = useState(false); // For translating the caption
  const [apiImages, setApiImages] = useState<(ServerImageMetadata & { resolvedSource?: ReturnType<typeof require> })[]>([]);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [imagesOffset, setImagesOffset] = useState(0);
  const [allApiImagesLoaded, setAllApiImagesLoaded] = useState(false);

  // State for image category filtering
  const [selectedImageCategory, setSelectedImageCategory] = useState<string | null>(null);
  const [availableImageCategories, setAvailableImageCategories] = useState<CategoryInfo[]>([]);
  const [isFetchingImageCategories, setIsFetchingImageCategories] = useState<boolean>(false);
  const [currentFetchedImageCategory, setCurrentFetchedImageCategory] = useState<string | null>(null); // Tracks category of currently displayed server images

  const imageScrollViewRef = useRef<ScrollView>(null);
  const [imageScrollPosition, setImageScrollPosition] = useState(0);
  const [imageContentWidth, setImageContentWidth] = useState(0);
  const [imageScrollViewWidth, setImageScrollViewWidth] = useState(0);

  const { isSpeaking, playSound } = useAudioPlayer(); // Initialize audio player

  useEffect(() => {
    const loadInitialLocalImages = async () => {
      setIsFetchingImages(true);
      setSelectedImage(null);
      setEnglishCaption("");
      setYorubaCaption("");
      try {
        console.log("[ImageCaptionScreen] Attempting to load local images from '../assets/data/images.json'");
        const localImageMetadataModule = require('../assets/data/images.json');
        console.log("[ImageCaptionScreen] Result of require('../assets/data/images.json'):", JSON.stringify(localImageMetadataModule, null, 2));

        // Explicitly check if the loaded module is an array
        if (!Array.isArray(localImageMetadataModule)) {
          const errorMessage = "Local image data ('images.json') did not load as an array or is undefined.";
          console.error(`[ImageCaptionScreen] ${errorMessage} Received:`, localImageMetadataModule);
          Alert.alert("Loading Error", errorMessage + " Please check the file content and path.");
          setApiImages([]);
          setAllApiImagesLoaded(false); // Ensure button is enabled if local load fails
          setIsFetchingImages(false);
          return; // Stop further processing
        }

        // If it's an array, cast it and proceed
        const localImageMetadata: ServerImageMetadata[] = localImageMetadataModule;

        const processedLocalImages = localImageMetadata.map((img, index) => ({
          ...img,
          id: img.id || `local-${index}`, // Assign a local ID if missing
          resolvedSource: localImageSources[img.asset_filename], // Get the required source for local images
          // 'url' will be populated for server images by fetchServerImageMetadata
        }));

        setApiImages(processedLocalImages); // Now use the correctly assigned variable
        if (processedLocalImages.length > 0) {
          console.log("[ImageCaptionScreen] Automatically selecting first local image:", processedLocalImages[0]);
          handleSelectImage(processedLocalImages[0]);
        }
        setImagesOffset(processedLocalImages.length); // Use the correctly assigned variable
        setAllApiImagesLoaded(false); // Reset for server fetch context - initially assume more server images are available
        setCurrentFetchedImageCategory(null); // Ensure the context is null for local images

      } catch (error) {
        console.error("[ImageCaptionScreen] Error during local image metadata processing (in catch block):", error);
        Alert.alert("Error", "Could not load images from the app. Ensure 'assets/data/images.json' exists and is valid.");
        setApiImages([]);
        setAllApiImagesLoaded(false); // Ensure button is enabled if local load fails
        setCurrentFetchedImageCategory(null); // Ensure the context is null
      } finally {
        setIsFetchingImages(false); // Set to false after local images are processed
      }
    };

    loadInitialLocalImages();
    // Initial load of image categories
    handleRefreshImageCategories(true);
  }, []); // Empty dependency array means this runs once on mount

  // Effect to translate English caption when it changes
  useEffect(() => {
    if (englishCaption && englishCaption.trim() !== "" && !englishCaption.startsWith("Error") && !englishCaption.startsWith("Generating caption...")) {
      translateEnglishCaptionToYoruba(englishCaption);
    } else {
      setYorubaCaption(""); // Clear Yoruba caption if English caption is invalid or empty
    }
  }, [englishCaption]);

  const getCategoryDisplayName = useCallback((value: string | null): string | null => {
    if (!value) return null;
    const foundCategory = availableImageCategories.find(cat => cat.value === value);
    return foundCategory ? foundCategory.displayName : value; // Fallback to value if not found
  }, [availableImageCategories]);

  const handleSelectImage = (image: ServerImageMetadata) => {
    setSelectedImage(image);
    setYorubaCaption(""); // Clear previous Yoruba caption
    // Check if the image object already has an English caption (likely from local images.json)
    if (image.english_caption && image.english_caption.trim() !== "") {
      console.log(`[ImageCaptionScreen] Using pre-existing caption for ${image.asset_filename}: "${image.english_caption}"`);
      setEnglishCaption(image.english_caption);
    } else {
      setEnglishCaption("Generating caption...");
      generateCaption(image.asset_filename); // Call API only if no pre-existing caption
    }
  };

  const generateCaption = async (imageIdentifier: string) => {
    if (!imageIdentifier) {
      setEnglishCaption("No image selected to generate caption.");
      return;
    }
    setIsGeneratingCaption(true);
    try {
      const generatedCaption = await generateCaptionAPI(imageIdentifier);
      setEnglishCaption(generatedCaption);
    } catch (error) {
      console.error("Caption generation error:", error);
      setEnglishCaption("Error generating caption.");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const translateEnglishCaptionToYoruba = async (textToTranslate: string) => {
    if (!textToTranslate || textToTranslate.startsWith("Error")) {
      setYorubaCaption("");
      return;
    }
    setIsTranslatingCaption(true);
    setYorubaCaption("Translating caption...");
    try {
      const translation = await translateToYorubaAPI(textToTranslate);
      setYorubaCaption(translation);
    } catch (error) {
      console.error("Caption translation error:", error);
      setYorubaCaption("Error translating caption.");
    } finally {
      setIsTranslatingCaption(false);
    }
  };

  const handleSpeakYorubaCaption = () => {
    if (yorubaCaption && !yorubaCaption.startsWith("Error:") && !yorubaCaption.startsWith("Translating caption...") && !isSpeaking) {
      playSound(yorubaCaption);
    }
  };

  const handleRefreshImageCategories = async (isInitialLoad = false) => {
    if (isFetchingImageCategories && !isInitialLoad) return;

    setIsFetchingImageCategories(true);
    try {
      const fetchedCategories = await fetchAvailableImageCategories();
      console.log("[ImageCaptionScreen] Fetched image categories from server:", JSON.stringify(fetchedCategories, null, 2));
      setAvailableImageCategories(fetchedCategories);
      if (!isInitialLoad) {
        // Alert.alert("Categories Refreshed", "The list of image categories has been updated."); // Optional: re-enable if desired
      }
    } catch (error) {
      console.error("[ImageCaptionScreen] Failed to refresh image categories:", error);
      Alert.alert("Error", "Could not refresh image categories. Please check your connection or try again later.");
    } finally {
      setIsFetchingImageCategories(false);
    }
  };

  // This function will now always fetch images from the server
  const handleFetchApiImages = async () => {
    if (isFetchingImages) return;

    const categoryToFetch = selectedImageCategory;
    const isNewCategoryContext = categoryToFetch !== currentFetchedImageCategory;
    const categoryToFetchDisplayName = getCategoryDisplayName(categoryToFetch);

    // Check if all images for the current server category context are loaded
    if (!isNewCategoryContext && allApiImagesLoaded && currentFetchedImageCategory !== null) { // Only check "All Loaded" if we are in a server context
      const alertMessage = categoryToFetchDisplayName
        ? `All images for category '${categoryToFetchDisplayName}' have been loaded.`
        : "All general images from the server have been loaded.";
      Alert.alert("All Loaded", alertMessage);
      return;
    }

    setIsFetchingImages(true);
    setSelectedImage(null); // Clear selected image
    setEnglishCaption("");  // Clear English caption
    setYorubaCaption(""); // Clear Yoruba caption

    // For "Fetch New Images", always start from offset 0 and reset relevant states.
    let offsetForThisFetch = 0;
    setImagesOffset(0); // Reset pagination offset
    setAllApiImagesLoaded(false); // Assume more images might be available
    setCurrentFetchedImageCategory(categoryToFetch); // Set the context for this fetch operation

    try {
      const newImages = await fetchServerImageMetadata(IMAGES_PER_FETCH, offsetForThisFetch, categoryToFetch);
      if (newImages.length > 0) {
        // Always replace images when "Fetch New Images" is clicked
        setApiImages(newImages);
        
        // Automatically select the first image from the newly fetched batch
        if (newImages.length > 0) { 
            console.log("[ImageCaptionScreen] Automatically selecting first fetched server image:", newImages[0]);
            handleSelectImage(newImages[0]);
        }
        
        setImagesOffset(offsetForThisFetch + newImages.length);
        if (newImages.length < IMAGES_PER_FETCH) {
          setAllApiImagesLoaded(true); // Assume all are loaded if less than fetch limit
        } else {
           setAllApiImagesLoaded(false); // More might be available
        }
        // Categories will now only be refreshed on initial load or by manual refresh icon press.
      } else {
        // No images found for this fetch, so clear the list.
        if (offsetForThisFetch === 0) {
            setApiImages([]);
        }
        setAllApiImagesLoaded(true); // Consider all loaded if server returns empty
        const alertTitle = offsetForThisFetch === 0 ? "No Images Found" : "No More Images";
        const alertMessage = offsetForThisFetch === 0
          ? `No images were found on the server${categoryToFetchDisplayName ? ` for category '${categoryToFetchDisplayName}'` : ''}.`
          : `No new images were found on the server${categoryToFetchDisplayName ? ` for category '${categoryToFetchDisplayName}'` : ''}.`;
        Alert.alert(alertTitle, alertMessage);
      }
    } catch (error) {
      console.error("Error fetching images from server:", error);
      Alert.alert("Error", "Could not fetch images from the server.");
      setApiImages([]); // Clear images on error
      setAllApiImagesLoaded(false); // Ensure button is enabled after fetch error
      setCurrentFetchedImageCategory(null); // Reset context on error
    } finally {
      setIsFetchingImages(false);
    }
  };

  const handleImageScroll = (event: any) => {
    setImageScrollPosition(event.nativeEvent.contentOffset.x);
  };

  const scrollImagesLeft = () => {
    const newPosition = Math.max(0, imageScrollPosition - SCROLL_AMOUNT_IMAGES);
    imageScrollViewRef.current?.scrollTo({ x: newPosition, animated: true });
  };

  const scrollImagesRight = () => {
    if (imageContentWidth > imageScrollViewWidth) {
      const maxScroll = imageContentWidth - imageScrollViewWidth;
      const newPosition = Math.min(maxScroll, imageScrollPosition + SCROLL_AMOUNT_IMAGES);
      imageScrollViewRef.current?.scrollTo({ x: newPosition, animated: true });
    }
  };

  const canScrollLeftImages = imageScrollPosition > 0;
  const canScrollRightImages = imageContentWidth > imageScrollViewWidth && imageScrollPosition < (imageContentWidth - imageScrollViewWidth - 1); // -1 for precision
  const showImageScrollArrows = imageContentWidth > imageScrollViewWidth;



  const isGenerallyBusy = isGeneratingCaption || isTranslatingCaption || isFetchingImages || isSpeaking || isFetchingImageCategories;

  const targetImageCategoryForFetch = selectedImageCategory;
  const displayImageCategoryContext = currentFetchedImageCategory;

  let fetchButtonTitle = "Fetch Images From Server"; // Initial title
  if (isFetchingImages) {
    const targetDisplayName = getCategoryDisplayName(targetImageCategoryForFetch);
    fetchButtonTitle = `Fetching ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Images...`;
  } else {
    const targetDisplayName = getCategoryDisplayName(targetImageCategoryForFetch);
    // Only show "All Loaded" if we are in a server category context and all are loaded
    if (allApiImagesLoaded && targetImageCategoryForFetch === displayImageCategoryContext && displayImageCategoryContext !== null) {
       fetchButtonTitle = `All ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Images Loaded`;
    } else {
       // Default title or title for fetching a new category / more images
       fetchButtonTitle = `Fetch ${targetDisplayName ? `'${targetDisplayName}' ` : ''}Images From Server`;
    }
  }

  const isFetchButtonDisabled =
    isGenerallyBusy ||
    (allApiImagesLoaded && targetImageCategoryForFetch === displayImageCategoryContext && displayImageCategoryContext !== null && !isFetchingImages); // Disable if all loaded for current server category context and not fetching


  //console.log("[ImageCaptionScreen] Rendering. Current availableImageCategories state:", JSON.stringify(availableImageCategories, null, 2));
  //console.log("[ImageCaptionScreen] Rendering. selectedImageCategory:", selectedImageCategory, "currentFetchedImageCategory:", currentFetchedImageCategory);
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
          <Text style={styles.title}>Image Caption Generator</Text>

          {/* Category Filter Section */}
          <View style={styles.categorySelectionContainer}>
            <Text style={styles.label}>Filter Images by Category (Optional):</Text>
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

          <Text style={styles.label}>Select an Image:</Text>
          <View style={styles.imageGalleryContainer}>
            {showImageScrollArrows && (
              <Pressable onPress={scrollImagesLeft} disabled={!canScrollLeftImages || isGenerallyBusy} style={[styles.scrollArrow, !canScrollLeftImages && styles.disabledButton]}>
                <Text style={[styles.scrollArrowText, { color: canScrollLeftImages ? "#007AFF" : "#cccccc" }]}>
                  {'<'}
                </Text>
              </Pressable>
            )}
            <View style={styles.imageScrollViewWrapper}>
              {isFetchingImages && apiImages.length === 0 ? (
                 <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicatorInScroll} />
              ) : apiImages.length > 0 ? (
                <ScrollView
                  ref={imageScrollViewRef}
                  horizontal={true}
                  showsHorizontalScrollIndicator={true}
                  onScroll={handleImageScroll}
                  onContentSizeChange={(width, height) => setImageContentWidth(width)}
                  onLayout={(event) => setImageScrollViewWidth(event.nativeEvent.layout.width)}
                  scrollEventThrottle={16} // For onScroll to fire often enough
                  style={styles.imageScrollView}
                  contentContainerStyle={styles.imageScrollContainer}
                >
                  <View style={styles.imageGrid}>
                    {apiImages.map((image, index) => (
                      <Pressable
                        key={image.id || index}
                        style={[
                          styles.imageButton,
                          selectedImage?.id === image.id && styles.selectedImageButton,
                          isGenerallyBusy && styles.disabledButton
                        ]}
                        onPress={() => handleSelectImage(image)}
                        disabled={isGenerallyBusy || (!image.resolvedSource && !image.url)}
                      >
                        {(() => {
                          const source = image.resolvedSource ? image.resolvedSource : (image.url ? { uri: image.url } : null);
                          if (source) {
                            return (
                              <Image
                                source={source}
                                style={styles.imageThumbnail}
                                resizeMode="cover"
                                onLoad={() => console.log(`[ImageCaptionScreen] Image loaded successfully: ${image.resolvedSource ? image.asset_filename : image.url}`)}
                                onError={(error) => console.error(`[ImageCaptionScreen] Error loading image ${image.resolvedSource ? image.asset_filename : image.url}:`, error.nativeEvent.error)}
                              />
                            );
                          }
                          return (
                            <View style={styles.imagePlaceholder}>
                               <Text style={styles.imagePlaceholderText}>No Image</Text>
                            </View>
                          );
                        })()}
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.placeholderText}>No images available. Try fetching from the server.</Text>
              )}
            </View>
            {showImageScrollArrows && (
              <Pressable onPress={scrollImagesRight} disabled={!canScrollRightImages || isGenerallyBusy} style={[styles.scrollArrow, !canScrollRightImages && styles.disabledButton]}>
                <Text style={[styles.scrollArrowText, { color: canScrollRightImages ? "#007AFF" : "#cccccc" }]}>
                  {'>'}
                </Text>
              </Pressable>
            )}
          </View>


          {selectedImage && (
            <View style={styles.selectedImageContainer}>
              <Text style={styles.label}>Selected Image:</Text>
              {(() => {
                const source = selectedImage.resolvedSource ? selectedImage.resolvedSource : (selectedImage.url ? { uri: selectedImage.url } : null);
                if (source) {
                  return (
                    <Image
                      source={source}
                      style={styles.largeImage}
                      resizeMode="contain"
                    />
                  );
                }
                return (
                  <View style={styles.largeImagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>No Image</Text>
                  </View>
                );
              })()}
            </View>
          )}

          <View style={styles.captionContainer}>
            <Text style={styles.label}>Caption:</Text>
            {isGeneratingCaption ? (
              <ActivityIndicator size="small" color="#0000ff" />
            ) : (
              <Text style={styles.captionText}>
                {englishCaption || (selectedImage ? "Caption will appear here..." : "Select an image to generate a caption.")}
              </Text>
            )}
            {englishCaption && !englishCaption.startsWith("Error") && !englishCaption.startsWith("Generating caption...") && (
              <>
                <Text style={styles.label}>Yoruba Caption:</Text>
                {isTranslatingCaption ? (
                  <ActivityIndicator size="small" color="#0000ff" />
                ) : (
                  <Text style={styles.captionText}>{yorubaCaption || "Translation will appear here..."}</Text>
                )}
                {yorubaCaption && !yorubaCaption.startsWith("Error:") && !yorubaCaption.startsWith("Translating caption...") && (
                  <Button
                    title={isSpeaking ? "Playing..." : "🔊 Play Yoruba Caption"}
                    onPress={handleSpeakYorubaCaption}
                    disabled={isSpeaking || isTranslatingCaption || isGeneratingCaption}
                  />
                )}
              </>
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
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  // Styles from SentenceBuilderScreen, adapted for ImageCaptionScreen
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
  refreshIconText: { // For using a text character as refresh icon
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
    marginTop: 20,
    marginBottom: 5,
    alignSelf: "flex-start",
  },
  fetchButtonContainer: {
    width: '100%',
    marginBottom: 15,
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
  imageGalleryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  imageScrollViewWrapper: {
    flex: 1, // Allows the ScrollView to take available space between arrows
    marginHorizontal: 5, // Optional: space between arrows and scrollview
  },
  imageScrollContainer: {
    // This container will allow the imageGrid to grow horizontally. Add padding here if needed.
    // No specific styles needed here unless you want padding within the scroll area
  },
  imageGrid: {
    flexDirection: 'row',
    // flexWrap: 'wrap', // Remove flexWrap to prevent wrapping
    // justifyContent: 'center', // Keep or remove based on desired alignment if content is less than screen width
    // width: '100%', // Remove fixed width or set to a very large number if needed, but usually not necessary for horizontal scroll
    alignItems: 'flex-start', // Add this to prevent vertical stretching of items
    paddingVertical: 5, // Add some vertical padding if buttons touch top/bottom of scrollview
  },
  imageScrollView: { // Style for the ScrollView component itself if needed
    marginTop: 5,
  },
  imageButton: {
    marginHorizontal: 5, // Use horizontal margin for spacing between images
    borderWidth: 2,
    borderColor: 'transparent', // Default border is transparent
    borderRadius: 5,
  },
  selectedImageButton: {
    borderColor: '#007AFF', // Highlight color for selected image
  },
  imageThumbnail: {
    width: 65, // Reduced thumbnail width
    height: 65, // Reduced thumbnail height
    borderRadius: 3, // Slightly less rounded than button border
  },
  imagePlaceholder: {
    width: 65, // Match reduced thumbnail size
    height: 65, // Match reduced thumbnail size
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  selectedImageContainer: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center', // Center the large image
  },
  largeImage: {
    width: '100%', // Take full width
    height: 200, // Fixed height, adjust as needed
    marginTop: 10,
    borderRadius: 5,
    backgroundColor: '#f0f0f0', // Background while loading or if transparent
  },
   largeImagePlaceholder: {
    width: '100%',
    height: 200,
    marginTop: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionContainer: {
    width: '100%',
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 5,
    backgroundColor: '#f9f9f9',
  },
  captionText: {
    fontSize: 16,
    marginTop: 5,
  },
  placeholderText: {
    textAlign: 'center',
    color: '#888',
    marginVertical: 10, // Adjusted from 20 to be less dominant when categories are empty
    fontSize: 15,
  },
  loadingIndicator: {
    marginVertical: 10, // Adjusted from 20
    alignSelf: 'center',
  },
  loadingIndicatorInScroll: { // For when loader is inside the scroll area
    flex: 1, // Take up space if it's the only item
    alignSelf: 'center',
  },
  disabledButton: {
    opacity: 0.5, // Visual indication that the button is disabled
  },
  scrollArrow: {
    paddingHorizontal: 8, // Reduced horizontal padding for the Pressable
    height: 65, // Match new thumbnail height for vertical alignment
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.05)', // Uncomment to debug touch area
  },
  clearCategoryButton: { // Copied from SentenceBuilderScreen
    marginTop: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  clearCategoryButtonText: { // Copied from SentenceBuilderScreen
    color: '#007AFF',
    fontSize: 14,
  },
  scrollArrowText: {
    fontSize: 24, // Adjusted for smaller arrow area
    fontWeight: 'bold',
    // Removed paddingHorizontal from text, rely on Pressable's padding
  },
});
