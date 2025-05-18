import { DictionaryImage, getDictionaryImages, getTotalDictionaryImagesCount, initDatabase } from "@/src/services/databaseService"; // Import DB service
import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import { Stack } from "expo-router"; // Removed Link as it's not used in this version
import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Ensure these images exist in /Users/davidolagunju/Projects/React-Native/TranslationApp/assets/images/
const catImage = require('@/assets/images/animals_cat.png');
const birdImage = require('@/assets/images/animals_bird.png');
const dogImage = require('@/assets/images/animals_dog.png');
const earsImage = require('@/assets/images/body_parts_ears.png');
const handsImage = require('@/assets/images/body_parts_hands.png');


// Map image keys (from DB) to their required sources
const allImageSources: Record<string, number> = {
  'cat': catImage,
  'bird': birdImage,
  'dog': dogImage,
  'ears': earsImage,
  'hands': handsImage,
  // Ensure this map aligns with image_key in your databaseService.ts initialDictionaryData
  // and that the corresponding image files exist and are required above.
};


// --- Mock Image Captioning Service ---
// This mock API is now ONLY for images picked from the device gallery (URIs).
// Captions for local gallery images will come directly from the database.
const mockGetEnglishCaptionAPI = async (imageUri: string): Promise<string> => {
  console.log("ImageCaptionAPI: Getting English caption for device image URI:", imageUri);
  return new Promise(resolve => {
    setTimeout(() => {
      // For images picked from the device gallery (URI)
      const captions = [
        "A photo from your gallery.",
        "User-selected image.",
        "An interesting picture from your device."
      ];
      const englishCaption = captions[Math.floor(Math.random() * captions.length)];
      resolve(englishCaption);
    }, 250); // Shorter delay for quicker feedback
  });
};
// --- End Mock Service ---

const IMAGES_PER_PAGE = 5;

export default function ImageCaptionScreen() {
  const [galleryDbItems, setGalleryDbItems] = useState<DictionaryImage[]>([]);
  // selectedImageSource can be a number (from require()) or an ImagePickerAsset (from device gallery)
  const [selectedImageSource, setSelectedImageSource] = useState<number | null>( // Simplified type
    null
  );
  const [currentApiIdentifier, setCurrentApiIdentifier] = useState<string | null>(
    null
  );

  const [englishCaption, setEnglishCaption] = useState<string>("");
  const [yorubaCaption, setYorubaCaption] = useState<string>("");
  
  // Loading states
  const [isLoadingCaption, setIsLoadingCaption] = useState<boolean>(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalImageCount, setTotalImageCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);


  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    console.log("[ImageCaptionScreen] useEffect - MOUNTED");

    const initializeScreen = async () => {
      // 1. Media library permissions request removed as "Pick Image" is removed.
      // console.log("[ImageCaptionScreen] Requesting media library permissions...");
      // if (Platform.OS !== 'web') {
      //   const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      //   if (status !== 'granted') {
      //     Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      //     // You might want to handle the case where permission is denied,
      //     // e.g., by disabling image picking functionality or returning early.
      //   }
      // }
      // console.log("[ImageCaptionScreen] Media library permissions checked.");
      console.log("[ImageCaptionScreen] Media library permissions request skipped as 'Pick Image' is removed.");

      // 2. Audio configuration
      console.log("[ImageCaptionScreen] Configuring audio mode...");
      // --- Add these logs for inspection ---
      console.log("[ImageCaptionScreen] Inspecting Audio object:", JSON.stringify(Audio, null, 2));
      console.log("[ImageCaptionScreen] Audio.InterruptionModeIOS:", Audio.InterruptionModeIOS);
      console.log("[ImageCaptionScreen] Audio.InterruptionModeAndroid:", Audio.InterruptionModeAndroid);

      // Determine interruption modes with fallbacks
      const interruptionModeIOSValue = Audio.InterruptionModeIOS?.DoNotMix ?? 1;
      const interruptionModeAndroidValue = Audio.InterruptionModeAndroid?.DoNotMix ?? 1;

      if (Audio.InterruptionModeIOS?.DoNotMix === undefined) {
        console.warn("[ImageCaptionScreen] Audio.InterruptionModeIOS.DoNotMix is undefined. Using fallback value 1.");
      }
      if (Audio.InterruptionModeAndroid?.DoNotMix === undefined) {
        console.warn("[ImageCaptionScreen] Audio.InterruptionModeAndroid.DoNotMix is undefined. Using fallback value 1.");
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
        console.log("[ImageCaptionScreen] Audio mode configured successfully.");
      } catch (e) {
        // The error 'e' will contain more details about why it failed.
        // Check your console for the full error object.
        console.error("Failed to set audio mode on ImageCaptionScreen. Error details:", e);
      }

      // 3. Initialize DB and load initial set of images
      console.log("[ImageCaptionScreen] Loading initial data...");
      try {
        setIsInitialLoading(true);
        await initDatabase();
        const count = await getTotalDictionaryImagesCount();
        console.log('[ImageCaptionScreen] Total image count from DB:', count);
        setTotalImageCount(count);

        const initialItems = await getDictionaryImages(IMAGES_PER_PAGE, 0);
        console.log('[ImageCaptionScreen] Initial items from DB:', JSON.stringify(initialItems, null, 2));
        setGalleryDbItems(initialItems);
        setCurrentPage(0);

        if (initialItems.length > 0) {
          // Select the first image from the initial set by default
          const firstItem = initialItems[0];
          console.log('[ImageCaptionScreen] First item from DB:', JSON.stringify(firstItem, null, 2));
          console.log('[ImageCaptionScreen] First item image_key:', firstItem.image_key);

          const imageResource = allImageSources[firstItem.image_key];
          console.log(`[ImageCaptionScreen] Looking up image_key "${firstItem.image_key}" in allImageSources. Result:`, imageResource);

          if (allImageSources[firstItem.image_key]) {
            setSelectedImageSource(allImageSources[firstItem.image_key]);
            setCurrentApiIdentifier(firstItem.image_key);
            console.log('[ImageCaptionScreen] setSelectedImageSource with:', allImageSources[firstItem.image_key], 'and calling fetchCaptionAndTranslate for', firstItem.image_key);
            await fetchCaptionAndTranslate(firstItem.image_key, firstItem.english_caption);
          } else {
            console.warn(`[ImageCaptionScreen] Image key "${firstItem.image_key}" (asset: ${firstItem.asset_filename || 'N/A'}) NOT FOUND in allImageSources map. Cannot display initial image.`);
             // Optionally select nothing or a generic placeholder
            setSelectedImageSource(null);
            setCurrentApiIdentifier(null);
            setEnglishCaption("Default image shown. Select from gallery or check image data.");
            setYorubaCaption(""); // Clear Yoruba caption
          } // Closes: if (allImageSources[firstItem.image_key])
        } else {
          console.log('[ImageCaptionScreen] No initial items found in DB.');
          setSelectedImageSource(null);
          setCurrentApiIdentifier(null);
          setEnglishCaption("No images in local gallery. Pick an image or add to dictionary.");
          setYorubaCaption("");
        } // Closes: if (initialItems.length > 0)
      } catch (error) {
        console.error("Failed to load data from database:", error);
        Alert.alert("Error", "Could not load image dictionary. " + (error instanceof Error ? error.message : String(error)));
        setEnglishCaption("Error loading image dictionary.");
        setYorubaCaption("");
      } finally {
        setIsInitialLoading(false);
      }
      console.log("[ImageCaptionScreen] Initialization complete.");
    };
    initializeScreen();

    return () => {
      console.log("[ImageCaptionScreen] Unmounting component. Minimal sound cleanup will run.");
      // Minimal, correct sound cleanup
      if (soundRef.current) {
        console.log("[ImageCaptionScreen] Sound object exists, attempting to unload (minimal cleanup).");
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current.unloadAsync()
          .then(() => {
            console.log("[ImageCaptionScreen] Minimal sound unloaded successfully during unmount.");
            soundRef.current = null;
          })
          .catch(error => {
            console.error("[ImageCaptionScreen] Minimal error unloading sound during unmount:", error);
            soundRef.current = null;
          })
          .finally(() => console.log("[ImageCaptionScreen] Minimal unmount sound cleanup finished."));
      }
    };
  }, []);

  const handleLoadMore = async () => {
    if (isLoadingMore || galleryDbItems.length >= totalImageCount) {
      return;
    }
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const offset = nextPage * IMAGES_PER_PAGE;
    try {
      const newItems = await getDictionaryImages(IMAGES_PER_PAGE, offset);
      if (newItems.length > 0) {
        setGalleryDbItems(prevItems => [...prevItems, ...newItems]);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more images:", error);
      Alert.alert("Error", "Could not load more images.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const canLoadMoreImages = galleryDbItems.length < totalImageCount && !isLoadingMore;

  // handlePickImage function removed

  const handleSelectFromLocalGallery = async (item: DictionaryImage) => {
    if (isLoadingCaption || isLoadingTranslation) return;

    if (allImageSources[item.image_key]) {
      setSelectedImageSource(allImageSources[item.image_key]);
      setCurrentApiIdentifier(item.image_key); 
      
      setEnglishCaption("");
      setYorubaCaption("");
      await fetchCaptionAndTranslate(item.image_key, item.english_caption);
    } else {
      console.warn(`Image key "${item.image_key}" not found in allImageSources. Cannot select.`);
      Alert.alert("Error", "Image resource not found for this item.");
    }
  };

  const fetchCaptionAndTranslate = async (identifier: string, preFetchedEngCaption?: string) => {
    if (!identifier) return;

    setIsLoadingCaption(true);
    setEnglishCaption("");
    setYorubaCaption("");
    try {
      let engCaption = preFetchedEngCaption;
      
      if (preFetchedEngCaption === undefined) {
        console.log("Fetching caption via mock API for identifier:", identifier);
        engCaption = await mockGetEnglishCaptionAPI(identifier);
      } else {
        console.log("Using pre-fetched caption for identifier:", identifier, preFetchedEngCaption);
      }
      setEnglishCaption(engCaption || ""); 
      
      if (engCaption && !engCaption.startsWith("Error:")) {
        setIsLoadingTranslation(true);
        const yorCaption = await translateToYorubaAPI(engCaption);
        setYorubaCaption(yorCaption);
      } else {
        setYorubaCaption(engCaption ? "Could not translate English caption." : "No English caption to translate.");
      }
    } catch (error) {
      console.error("Captioning/Translation error:", error);
      setYorubaCaption("Error processing image caption.");
    } finally {
      setIsLoadingCaption(false);
      setIsLoadingTranslation(false);
    }
  };

  const handleSpeakYorubaCaption = async () => {
    if (!yorubaCaption.trim() || yorubaCaption.startsWith("Error:")) {
      return;
    }
    if (isSpeaking && soundRef.current) {
      console.log("[ImageCaptionScreen] Stopping and unloading existing sound before playing new.");
      await soundRef.current.stopAsync();
      soundRef.current.setOnPlaybackStatusUpdate(null); 
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsSpeaking(true);
    try {
      if (soundRef.current) { // Ensure any previous sound object is fully gone
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const audioDataUri = await speakYorubaTextAPI(yorubaCaption);
      if (audioDataUri && !audioDataUri.startsWith("Error:")) {
        const { sound } = await Audio.Sound.createAsync({ uri: audioDataUri }, { shouldPlay: false });
        soundRef.current = sound;
        soundRef.current.setOnPlaybackStatusUpdate(async (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              console.error(`Playback Error: ${status.error}`);
              setIsSpeaking(false);
              if (soundRef.current) {
                soundRef.current.setOnPlaybackStatusUpdate(null);
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                console.log("[ImageCaptionScreen] Sound unloaded due to playback error.");
              }
            }
          } else {
            if (status.didJustFinish && !status.isLooping) {
              setIsSpeaking(false);
              if (soundRef.current) {
                soundRef.current.setOnPlaybackStatusUpdate(null);
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                console.log("[ImageCaptionScreen] Sound unloaded after finishing playback.");
              }
            }
          }
        });
        await soundRef.current.playAsync();
      } else {
        console.error("Failed to get valid audio data URI for caption. Received:", audioDataUri);
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Error in handleSpeakYorubaCaption:", error);
      setIsSpeaking(false);
      if (soundRef.current) {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        console.log("[ImageCaptionScreen] Sound unloaded in catch block of handleSpeakYorubaCaption.");
      }
    }
  };

  // Simplified imageSourceForDisplay logic as selectedImageSource is now only number | null
  const imageSourceForDisplay: number | null = selectedImageSource;
  // if (selectedImageSource) {
  //   if (typeof selectedImageSource === 'number') { 
  //     imageSourceForDisplay = selectedImageSource;
  //   } else { // This branch is no longer reachable if ImagePicker is removed
  //     imageSourceForDisplay = { uri: selectedImageSource.uri };
  //   }
  // }
  if (selectedImageSource) {
    // imageSourceForDisplay is already set if selectedImageSource is a number
  }
  const isProcessing = isLoadingCaption || isLoadingTranslation; // isLoadingImage removed
  const canInteractWithGallery = !isProcessing;
  const canPlaySound = !isSpeaking && yorubaCaption && !yorubaCaption.startsWith("Error:");

  return (
    <>
      {/* Optional: Display a loading indicator while initial data is loading */}
      {isInitialLoading && (
        <View style={styles.loadingOverlay}>
          <Text>Loading Dictionary...</Text>
        </View>
      )}
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Image Caption Translator" }} />
      <Text style={styles.title}>Image Caption Screen</Text>
      {/* "Pick an Image from Gallery" Button removed */}

      <Text style={styles.galleryTitle}>Or select from local gallery:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScrollView}>
        {galleryDbItems.map((item) => (
          <Pressable 
            key={item.image_key} // Use image_key from DB as key
            onPress={() => handleSelectFromLocalGallery(item)}
            style={[
              styles.galleryItem, 
              currentApiIdentifier === item.image_key && styles.galleryItemSelected,
              !canInteractWithGallery && styles.galleryItemDisabled
            ]}
            disabled={!canInteractWithGallery}
          >
            {allImageSources[item.image_key] ? (
              <Image source={allImageSources[item.image_key]} style={styles.galleryImage} resizeMode="cover" />
            ) : (
              <View style={[styles.galleryImage, styles.galleryImagePlaceholder]}>
                <Text style={styles.galleryImagePlaceholderText}>?</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
      {canLoadMoreImages && (
        <Button title={isLoadingMore ? "Loading..." : "Load More Images"} onPress={handleLoadMore} disabled={isLoadingMore} />
      )}

      <View style={styles.imageContainer}>
        {imageSourceForDisplay ? (
          <Image source={imageSourceForDisplay} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.noImageText}>No image selected or available.</Text>
        )}
      </View>

      {isLoadingCaption && <Text style={styles.loadingText}>Getting English caption...</Text>}
      {englishCaption && !isLoadingCaption && (
        <View style={styles.captionBox}>
          <Text style={styles.label}>English Caption:</Text>
          <Text>{englishCaption}</Text>
        </View>
      )}

      {isLoadingTranslation && <Text style={styles.loadingText}>Translating to Yoruba...</Text>}
      {yorubaCaption && !isLoadingTranslation && (
        <View style={styles.captionBox}>
          <Text style={styles.label}>Yoruba Caption:</Text>
          <Text>{yorubaCaption}</Text>
          {canPlaySound && (
            <Button 
              title={isSpeaking ? "Playing..." : "🔊 Play Yoruba Caption"} 
              onPress={handleSpeakYorubaCaption}
              disabled={isSpeaking || isProcessing}
            />
          )}
        </View>
      )}
       <View style={{ marginTop: 20 }}>
        {/* Custom "Go Back to Home" button removed, relying on header back button */}
        {/* <Link href="/" style={styles.link}>Go Back to Home</Link> */}
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 20, // Keep padding
  },
  title: {
    fontSize: 22,
    fontWeight: "bold", // Keep title style
    marginBottom: 20,
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  galleryScrollView: {
    width: '100%',
    maxHeight: 120, // Adjust as needed
    marginBottom: 20,
  },
  galleryItem: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden', // Ensures image respects border radius
    alignItems: 'center',
    // paddingBottom: 5, // Removed as thumbnail text is gone
  },
  galleryItemSelected: {
    borderColor: '#007AFF', // Highlight selected item
    borderWidth: 2,
  },
  galleryItemDisabled: {
    opacity: 0.5,
  },
  galleryImage: {
    width: 80, // Adjust as needed
    height: 80, // Adjust as needed
  },
  galleryImagePlaceholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImagePlaceholderText: {
    fontSize: 24,
    color: '#a0a0a0',
  },

  // galleryItemText: { // Style removed as text is gone from thumbnail
  //   fontSize: 12,
  //   marginTop: 4,
  // },
  imageContainer: {
    marginVertical: 20,
    width: '100%',
    height: 250,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImageText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  captionBox: {
    width: '100%',
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'lightgray',
    borderRadius: 5,
    backgroundColor: '#f9f9f9',
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  loadingText: {
    marginVertical: 10,
    fontStyle: 'italic',
  },
  link: {
    color: 'blue',
    textDecorationLine: 'underline',
    fontSize: 16,
  },
  loadingOverlay: { // Basic style for loading overlay, adjust as needed
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensure it's on top
  },
});
