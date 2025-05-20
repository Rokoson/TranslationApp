import { DictionaryImage, getDictionaryImages, getTotalDictionaryImagesCount, initDatabase } from "@/src/services/databaseService"; // Import DB service
import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import { Stack } from "expo-router"; // Removed Link as it's not used in this version
import React, { useCallback, useEffect, useRef, useState } from "react";
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
// Define a type for items that can be displayed in the gallery,
// accommodating both local DB items and items fetched from a server.
interface DisplayableImageItem extends Omit<DictionaryImage, 'id'> { // Exclude 'id' if it's strictly from DB
  id?: number; // Optional, from DB
  image_url?: string; // For server-fetched images
  // image_key, english_caption, asset_filename are inherited from DictionaryImage
}

// --- Backend API Configuration ---
const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // <<< IMPORTANT: Make sure this is correct!
                                                 // For Android emulators, if your server is on your host machine, try "http://10.0.2.2:5005".
                                                 // For iOS simulators, "http://localhost:5005" or "http://127.0.0.1:5005" should work.
                                                 // Ensure your server is running and accessible.
// --- End Backend API Configuration ---

// --- Mock New Images API ---
const mockFetchNewImagesAPI = async (): Promise<Array<Omit<DisplayableImageItem, 'id' | 'asset_filename'>>> => {
  console.log("[ImageCaptionScreen] mockFetchNewImagesAPI: Fetching new images from server...");
  return new Promise(resolve => {
    setTimeout(() => {
      const newImages: Array<Omit<DisplayableImageItem, 'id' | 'asset_filename'>> = [
        {
          image_key: `server_img_${Date.now()}`, // Ensure unique key
          english_caption: "A beautiful landscape from server.",
          image_url: "https://picsum.photos/seed/server1/200/300" 
        },
        {
          image_key: `server_img_${Date.now() + 1}`, // Ensure unique key
          english_caption: "An interesting object from server.",
          image_url: "https://picsum.photos/seed/server2/300/200"
        }
      ];
      console.log("[ImageCaptionScreen] mockFetchNewImagesAPI: Received new images from server:", newImages);
      resolve(newImages);
    }, 1500);
  });
};
// --- End Mock New Images API ---

// --- Real API Service to Fetch New Images ---
interface ServerImageMetadata {
  image_key: string;
  english_caption: string;
  asset_filename: string; // e.g., "image1.jpg", "photo_abc.png" - Changed from filename
}

// const SERVER_IMAGES_PER_FETCH = 5; // Removed: Number of images to fetch from server per request

const fetchRealImagesFromServer = async (): Promise<Array<Omit<DisplayableImageItem, 'id' | 'asset_filename'>>> => { // Removed limit and offset params
  if (BACKEND_BASE_URL === "YOUR_BACKEND_URL_HERE") {
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL in imageCaption.tsx.");
    throw new Error("Backend URL not configured.");
  }
  const apiUrl = `${BACKEND_BASE_URL}/api/image_metadata`; // URL no longer includes limit/offset
  console.log(`[ImageCaptionScreen] fetchRealImagesFromServer: Fetching image metadata from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const metadataList: ServerImageMetadata[] = await response.json();
    console.log("[ImageCaptionScreen] fetchRealImagesFromServer: Received metadata:", metadataList);

    // Filter out items with invalid image_key or asset_filenames
    const validMetadataList = metadataList.filter(meta => {
      const imageKeyIsPresentAndValidString = meta.image_key && typeof meta.image_key === 'string' && meta.image_key.trim() !== "";
      const assetFilenameIsPresentAndValidString = meta.asset_filename && typeof meta.asset_filename === 'string' && meta.asset_filename.trim() !== "";
      const assetFilenameIsNotTheStringUndefined = meta.asset_filename?.trim().toLowerCase() !== "undefined";
      const isValid = imageKeyIsPresentAndValidString && assetFilenameIsPresentAndValidString && assetFilenameIsNotTheStringUndefined;
      if (!isValid) {
        console.warn(`[ImageCaptionScreen] fetchRealImagesFromServer: Filtering out item due to invalid data. Image Key: "${meta.image_key}", Asset Filename: "${meta.asset_filename}"`);
      }
      return isValid;
    });

    return validMetadataList.map(meta => {
      console.log(`[ImageCaptionScreen] fetchRealImagesFromServer: Processing metadata for image_key "${meta.image_key}", using asset_filename: "${meta.asset_filename}"`);
      return {
        image_key: meta.image_key,
        english_caption: meta.english_caption,
        image_url: `${BACKEND_BASE_URL}/api/images/${meta.asset_filename}`, // Construct the full image URL using asset_filename
      };
    });
  } catch (error) {
    console.error("[ImageCaptionScreen] fetchRealImagesFromServer: Error fetching images:", error);
    throw error; // Re-throw to be caught by the caller
  }
};
// --- End Real API Service ---

export default function ImageCaptionScreen() {
  const [localGalleryItems, setLocalGalleryItems] = useState<DisplayableImageItem[]>([]);
  const [serverGalleryItems, setServerGalleryItems] = useState<DisplayableImageItem[]>([]);
  const [selectedImageSource, setSelectedImageSource] = useState<number | { uri: string } | null>(null);
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
  const [isFetchingFromServer, setIsFetchingFromServer] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // const [serverImagesOffset, setServerImagesOffset] = useState(0); // Removed
  // const [allServerImagesLoaded, setAllServerImagesLoaded] = useState(false); // Removed

  // For LOCAL gallery scroll arrows
  const localGalleryScrollRef = useRef<ScrollView>(null);
  const [localCanScrollLeft, setLocalCanScrollLeft] = useState(false);
  const [localCanScrollRight, setLocalCanScrollRight] = useState(false);
  const [localGalleryScrollViewWidth, setLocalGalleryScrollViewWidth] = useState(0);
  const [currentLocalGalleryScrollX, setCurrentLocalGalleryScrollX] = useState(0);

  // For SERVER gallery scroll arrows
  const serverGalleryScrollRef = useRef<ScrollView>(null);
  const [serverCanScrollLeft, setServerCanScrollLeft] = useState(false);
  const [serverCanScrollRight, setServerCanScrollRight] = useState(false);
  const [serverGalleryScrollViewWidth, setServerGalleryScrollViewWidth] = useState(0);
  const [currentServerGalleryScrollX, setCurrentServerGalleryScrollX] = useState(0);


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
        setLocalGalleryItems(initialItems.map(item => ({...item}))); // Ensure they are DisplayableImageItem
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
    if (isLoadingMore || localGalleryItems.length >= totalImageCount) {
      return;
    }
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const offset = nextPage * IMAGES_PER_PAGE;
    try {
      const newItems = await getDictionaryImages(IMAGES_PER_PAGE, offset);
      if (newItems.length > 0) {
        setLocalGalleryItems(prevItems => [...prevItems, ...newItems.map(item => ({...item}))]);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more images:", error);
      Alert.alert("Error", "Could not load more images.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const canLoadMoreDbImages = localGalleryItems.length < totalImageCount && !isLoadingMore;

  // handlePickImage function removed

  const handleFetchFromServer = async () => {
    if (isFetchingFromServer) return; // Simpler check now
    setIsFetchingFromServer(true);
    // Optionally clear captions or don't, depending on desired UX
    // setEnglishCaption(""); 
    // setYorubaCaption("");

    try {
      const newServerImages = await fetchRealImagesFromServer(); // Call without limit/offset
      if (newServerImages.length > 0) {
        setServerGalleryItems(prevItems => {
          console.log("[ImageCaptionScreen] handleFetchFromServer: prevItems keys", JSON.stringify(prevItems.map(i => i.image_key)));
          console.log("[ImageCaptionScreen] handleFetchFromServer: newServerImages keys", JSON.stringify(newServerImages.map(i => i.image_key)));
          const newItemsToAdd = newServerImages.filter(
            serverImg => !prevItems.some(existingImg => existingImg.image_key === serverImg.image_key)
          );
          console.log("[ImageCaptionScreen] handleFetchFromServer: newItemsToAdd keys", JSON.stringify(newItemsToAdd.map(i => i.image_key)));
          const updatedItems = [...prevItems, ...newItemsToAdd];
          console.log("[ImageCaptionScreen] handleFetchFromServer: updatedItems for gallery (keys)", JSON.stringify(updatedItems.map(i => i.image_key)));
          return updatedItems;
        });
        // Logic for serverImagesOffset and allServerImagesLoaded removed

        // Optionally, select the first newly fetched image
        // const firstNew = newServerImages[0];
        // await handleSelectImage(firstNew);
      } else {
        // Logic for allServerImagesLoaded removed
        Alert.alert("No More Images", "No new images were found on the server at this time.");
      }
    } catch (error) {
      console.error("Failed to fetch images from server:", error);
      Alert.alert("Error", "Could not fetch new images from the server.");
    } finally {
      setIsFetchingFromServer(false);
    }
  };

  const handleSelectImage = async (item: DisplayableImageItem) => {
    if (isLoadingCaption || isLoadingTranslation || isFetchingFromServer) return;

    setEnglishCaption("");
    setYorubaCaption("");
    setCurrentApiIdentifier(item.image_key);

    if (item.image_url) { // Server image
      setSelectedImageSource({ uri: item.image_url });
    } else if (item.asset_filename && allImageSources[item.image_key]) { // Local DB image
      setSelectedImageSource(allImageSources[item.image_key]);
    } else {
      console.warn(`Image key "${item.image_key}" (asset: ${item.asset_filename}) not found or not usable. Cannot select.`);
      Alert.alert("Error", "Image resource not found or is invalid for this item.");
      setSelectedImageSource(null); // Clear selection
      return; // Don't proceed to fetch caption
    }
    await fetchCaptionAndTranslate(item.image_key, item.english_caption);
  };

  const fetchCaptionAndTranslate = useCallback(async (identifier: string, preFetchedEngCaption?: string) => {
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
  }, []); // Add dependencies if any are used from outside and change, e.g. API keys, etc.

  // --- Scroll Arrow Logic for LOCAL Gallery ---
  const updateLocalScrollArrowVisibility = useCallback((
    contentOffsetX: number,
    contentWidth: number,
    layoutWidth: number
  ) => {
    if (layoutWidth <= 0) return; // Avoid calculations if layout width is not yet known
    setLocalCanScrollLeft(contentOffsetX > 5); 
    setLocalCanScrollRight(contentOffsetX < contentWidth - layoutWidth - 5); 
  }, []);

  const handleLocalGalleryScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCurrentLocalGalleryScrollX(contentOffset.x);
    updateLocalScrollArrowVisibility(contentOffset.x, contentSize.width, layoutMeasurement.width);
  };

  const handleLocalGalleryContentSizeChange = (contentWidth: number, contentHeight: number) => {
    updateLocalScrollArrowVisibility(currentLocalGalleryScrollX, contentWidth, localGalleryScrollViewWidth);
  };

  const scrollLocalGallery = (direction: 'left' | 'right') => {
    const scrollAmount = localGalleryScrollViewWidth * 0.8; 
    const currentOffset = currentLocalGalleryScrollX; 
    const newOffset = direction === 'left' ? Math.max(0, currentOffset - scrollAmount) : currentOffset + scrollAmount;
    localGalleryScrollRef.current?.scrollTo({ x: newOffset, animated: true });
  };
  // --- End Scroll Arrow Logic for LOCAL Gallery ---

  // --- Scroll Arrow Logic for SERVER Gallery ---
  const updateServerScrollArrowVisibility = useCallback((
    contentOffsetX: number,
    contentWidth: number,
    layoutWidth: number
  ) => {
    if (layoutWidth <= 0) return;
    setServerCanScrollLeft(contentOffsetX > 5);
    setServerCanScrollRight(contentOffsetX < contentWidth - layoutWidth - 5);
  }, []);

  const handleServerGalleryScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCurrentServerGalleryScrollX(contentOffset.x);
    updateServerScrollArrowVisibility(contentOffset.x, contentSize.width, layoutMeasurement.width);
  };

  const handleServerGalleryContentSizeChange = (contentWidth: number, contentHeight: number) => {
    updateServerScrollArrowVisibility(currentServerGalleryScrollX, contentWidth, serverGalleryScrollViewWidth);
  };

  const scrollServerGallery = (direction: 'left' | 'right') => {
    const scrollAmount = serverGalleryScrollViewWidth * 0.8;
    const currentOffset = currentServerGalleryScrollX;
    const newOffset = direction === 'left' ? Math.max(0, currentOffset - scrollAmount) : currentOffset + scrollAmount;
    serverGalleryScrollRef.current?.scrollTo({ x: newOffset, animated: true });
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

  // console.log("[ImageCaptionScreen] Checking SERVER_IMAGES_PER_FETCH just before render. Type:", typeof SERVER_IMAGES_PER_FETCH, "Value:", SERVER_IMAGES_PER_FETCH); // Removed

  const imageSourceForDisplay = selectedImageSource; // This can be ImageRequireSource (number) or { uri: string }

  const isProcessingAny = isLoadingCaption || isLoadingTranslation || isFetchingFromServer || isInitialLoading || isLoadingMore;
  const canInteractWithGallery = !isProcessingAny;
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
      {/* <Text style={styles.title}>Image Caption Screen</Text> */}
      
      <View style={styles.fetchButtonContainer}>
        <Button 
          title={isFetchingFromServer ? "Fetching from Server..." : "Fetch New Images from Server"} 
          onPress={handleFetchFromServer} 
          disabled={isFetchingFromServer || isProcessingAny}
        />
      </View>

      {/* Local Gallery Section */}
      <Text style={styles.galleryTitle}>Local Gallery:</Text>
      <View style={styles.galleryContainerWithArrows}>
        {localCanScrollLeft && (
          <Pressable onPress={() => scrollLocalGallery('left')} style={[styles.arrowButton, styles.leftArrow]}>
            <Text style={styles.arrowText}>{"<"}</Text>
          </Pressable>
        )}
        <ScrollView 
          ref={localGalleryScrollRef}
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.galleryScrollView}
          onScroll={handleLocalGalleryScroll}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setLocalGalleryScrollViewWidth(width);
          }}
          onContentSizeChange={handleLocalGalleryContentSizeChange}
          scrollEventThrottle={16} // Important for onScroll performance
        >
          {localGalleryItems.map((item) => (
            <Pressable 
              key={item.image_key} // Use image_key from DB as key
              onPress={() => handleSelectImage(item)}
              style={[
                styles.galleryItem, 
                currentApiIdentifier === item.image_key && styles.galleryItemSelected,
                !canInteractWithGallery && styles.galleryItemDisabled
              ]}
              disabled={!canInteractWithGallery}
            >
              {item.image_url ? (
                <Image 
                  source={{ uri: item.image_url }} 
                  style={styles.galleryImage} 
                  resizeMode="cover" 
                  onLoad={() => console.log(`[ImageCaptionScreen] Gallery Image LOADED: ${item.image_key} from ${item.image_url}`)}
                  onError={(e) => console.error(`[ImageCaptionScreen] Gallery Image FAILED to load: ${item.image_key} from ${item.image_url}. Error: ${e.nativeEvent.error}`)}
                />
              ) : allImageSources[item.image_key] ? (
                <Image 
                  source={allImageSources[item.image_key]} 
                  style={styles.galleryImage} 
                  resizeMode="cover" />
              ) : (
                <View style={[styles.galleryImage, styles.galleryImagePlaceholder]}>
                  <Text style={styles.galleryImagePlaceholderText}>?</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
        {localCanScrollRight && (
          <Pressable onPress={() => scrollLocalGallery('right')} style={[styles.arrowButton, styles.rightArrow]}>
            <Text style={styles.arrowText}>{">"}</Text>
          </Pressable>
        )}
      </View>
      {canLoadMoreDbImages && (
        <Button title={isLoadingMore ? "Loading..." : "Load More DB Images"} onPress={handleLoadMore} disabled={isLoadingMore || isProcessingAny} />
      )}

      {/* Server Images Gallery Section */}
      {serverGalleryItems.length > 0 && (
        <>
          <Text style={styles.galleryTitle}>Server Images:</Text>
          <View style={styles.galleryContainerWithArrows}>
            {serverCanScrollLeft && (
              <Pressable onPress={() => scrollServerGallery('left')} style={[styles.arrowButton, styles.leftArrow]}>
                <Text style={styles.arrowText}>{"<"}</Text>
              </Pressable>
            )}
            <ScrollView 
              ref={serverGalleryScrollRef}
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.galleryScrollView}
              onScroll={handleServerGalleryScroll}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                setServerGalleryScrollViewWidth(width);
              }}
              onContentSizeChange={handleServerGalleryContentSizeChange}
              scrollEventThrottle={16}
            >
              {serverGalleryItems.map((item) => (
                <Pressable 
                  key={item.image_key} 
                  onPress={() => handleSelectImage(item)}
                  style={[
                    styles.galleryItem, 
                    currentApiIdentifier === item.image_key && styles.galleryItemSelected,
                    !canInteractWithGallery && styles.galleryItemDisabled
                  ]}
                  disabled={!canInteractWithGallery}
                >
                  {/* Server items will always have image_url */}
                  <Image 
                    source={{ uri: item.image_url! }} 
                    style={styles.galleryImage} 
                    resizeMode="cover" 
                    onLoad={() => console.log(`[ImageCaptionScreen] Gallery Image LOADED: ${item.image_key} from ${item.image_url}`)}
                    onError={(e) => console.error(`[ImageCaptionScreen] Gallery Image FAILED to load: ${item.image_key} from ${item.image_url}. Error: ${e.nativeEvent.error}`)}
                  />
                </Pressable>
              ))}
            </ScrollView>
            {serverCanScrollRight && (
              <Pressable onPress={() => scrollServerGallery('right')} style={[styles.arrowButton, styles.rightArrow]}>
                <Text style={styles.arrowText}>{">"}</Text>
              </Pressable>
            )}
          </View>
        </>
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
              disabled={isSpeaking || isProcessingAny}
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
    paddingHorizontal: 20, // Keep horizontal padding
    paddingTop: 20,        // Keep top padding
    paddingBottom: 60,     // Further increased bottom padding
  },
  title: {
    fontSize: 22,
    fontWeight: "bold", // Keep title style
    marginBottom: 20,
  },
  fetchButtonContainer: {
    marginBottom: 15,
    width: '80%', // Let's try reducing the width
    alignSelf: 'center', // And center it
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  galleryContainerWithArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%', // Ensure it takes full width to position arrows correctly
  },
  galleryScrollView: {
    flex: 1, // Takes up space between arrows
    maxHeight: 120, // Adjust as needed
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
  arrowButton: {
    paddingHorizontal: 8,
    paddingVertical: 20, // Make it easier to tap
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)', // Optional: for better visibility
    // borderRadius: 5,
    zIndex: 1, // Ensure arrows are on top of scroll content if overlapping
  },
  leftArrow: {
    // marginRight: 5, // Space between arrow and scrollview
  },
  rightArrow: {
    // marginLeft: 5, // Space between scrollview and arrow
  },
  arrowText: {
    fontSize: 24, // Make arrows bigger
    fontWeight: 'bold',
    color: '#007AFF',
  },
});
