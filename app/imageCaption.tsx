import { useAudioPlayer } from "@/src/hooks/useAudioPlayer"; // Import audio player hook
import { generateCaptionAPI } from "@/src/services/captionApiService";
import { fetchServerImageMetadata, ServerImageMetadata } from "@/src/services/contentApiService";
import { translateToYorubaAPI } from "@/src/services/translationApiService"; // Import translation service
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Button, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
// Note: Ensure you have Ionicons installed in your project
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
  const imageScrollViewRef = useRef<ScrollView>(null);
  const [imageScrollPosition, setImageScrollPosition] = useState(0);
  const [imageContentWidth, setImageContentWidth] = useState(0);
  const [imageScrollViewWidth, setImageScrollViewWidth] = useState(0);

  const { isSpeaking, playSound } = useAudioPlayer(); // Initialize audio player
  // currentImageSource state removed as we default to local and fetch server images

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
          setAllApiImagesLoaded(true); // Consider it "all loaded" if local data fails
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
        setAllApiImagesLoaded(true); // All local images are considered loaded
      } catch (error) {
        console.error("[ImageCaptionScreen] Error during local image metadata processing (in catch block):", error);
        Alert.alert("Error", "Could not load images from the app. Ensure 'assets/data/images.json' exists and is valid.");
        setApiImages([]);
      } finally {
        setIsFetchingImages(false); // Set to false after local images are processed
      }
    };

    loadInitialLocalImages();
  }, []); // Empty dependency array means this runs once on mount

  // Effect to translate English caption when it changes
  useEffect(() => {
    if (englishCaption && englishCaption.trim() !== "" && !englishCaption.startsWith("Error") && !englishCaption.startsWith("Generating caption...")) {
      translateEnglishCaptionToYoruba(englishCaption);
    } else {
      setYorubaCaption(""); // Clear Yoruba caption if English caption is invalid or empty
    }
  }, [englishCaption]);

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

  // This function will now always fetch images from the server
  const handleFetchApiImages = async () => {
    if (isFetchingImages) return;
    setIsFetchingImages(true);
    setSelectedImage(null); // Clear selected image
    setEnglishCaption("");  // Clear English caption
    setYorubaCaption(""); // Clear Yoruba caption

    const offsetForThisFetch = 0;
    setImagesOffset(0); // Reset offset for server fetch
    setAllApiImagesLoaded(false); // Reset loaded flag for server fetch

    try {
      const newImages = await fetchServerImageMetadata(IMAGES_PER_FETCH, offsetForThisFetch);
      if (newImages.length > 0) {
        setApiImages(newImages); // Replace current images with new server images
        // Automatically select the first image from the newly fetched batch
        console.log("[ImageCaptionScreen] Automatically selecting first fetched server image:", newImages[0]);
        handleSelectImage(newImages[0]); 
        setImagesOffset(offsetForThisFetch + newImages.length);
        if (newImages.length < IMAGES_PER_FETCH) {
          setAllApiImagesLoaded(true); // Assume all are loaded if less than fetch limit
        } else {
           setAllApiImagesLoaded(false); // More might be available
        }
      } else {
        setApiImages([]); // No images found on server
        setAllApiImagesLoaded(true); // Consider all loaded if server returns empty
        Alert.alert("No Images", "No images were found on the server.");
      }
    } catch (error) {
      console.error("Error fetching images from server:", error);
      Alert.alert("Error", "Could not fetch images from the server.");
      setApiImages([]); // Clear images on error
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



  const isGenerallyBusy = isGeneratingCaption || isTranslatingCaption || isFetchingImages || isSpeaking;

  let fetchButtonTitle = "Fetch New Images From Server";
  if (isFetchingImages) {
    fetchButtonTitle = "Fetching...";
  }
  // Disable fetch button if any caption-related or image fetching operation is in progress.
  const isFetchButtonDisabled = isFetchingImages || isGeneratingCaption || isTranslatingCaption;
  
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
    marginVertical: 20,
    fontSize: 15,
  },
  loadingIndicator: {
    marginVertical: 20,
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
  scrollArrowText: {
    fontSize: 24, // Adjusted for smaller arrow area
    fontWeight: 'bold',
    // Removed paddingHorizontal from text, rely on Pressable's padding
  },
});
