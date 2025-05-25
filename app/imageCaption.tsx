import { DictionaryImage, getDictionaryImages, getTotalDictionaryImagesCount, initDatabase } from "@/src/services/databaseService";
import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { Stack } from "expo-router";
import React, { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Button, Image, ImageSourcePropType, ScrollView, StyleSheet, Text, View } from "react-native";

import { ImageGallery } from "@/src/components/imageGallery"; // Import your existing component
import { useAudioPlayer } from "@/src/hooks/useAudioPlayer";
import { useHorizontalScroll } from "@/src/hooks/useHorizontalScroll"; // Import the new hook
import { fetchServerImageMetadata, ServerImageMetadata } from "@/src/services/contentApiService";

import { BACKEND_BASE_URL } from "@/src/config/apiConfig";

// Ensure these images exist in /Users/davidolagunju/Projects/React-Native/TranslationApp/assets/images/
const allImageSources: Record<string, number> = {
  bird: require("@/assets/images/animals_bird.png"),
  cat: require("@/assets/images/animals_cat.png"),
  dog: require("@/assets/images/animals_dog.png"),
  ears: require("@/assets/images/body_parts_ears.png"),
  hands: require("@/assets/images/body_parts_hands.png"),
  // Add all your other images here with relative paths
  
};

// --- Backend API Configuration ---
//const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // Make sure this is correct!
// --- End Backend API Configuration ---

const IMAGES_PER_PAGE = 5;
export interface DisplayableImageItem extends Omit<DictionaryImage, 'id'> {
  id?: number;
  image_url?: string;
  source: 'local' | 'server'; // Add a source property
};

export default function ImageCaptionScreen() {
  const [localGalleryItems, setLocalGalleryItems] = useState<DisplayableImageItem[]>([]);
  const [serverGalleryItems, setServerGalleryItems] = useState<DisplayableImageItem[]>([]);
  const [selectedImageSource, setSelectedImageSource] = useState<number | { uri: string } | null>(null);
  const [currentApiIdentifier, setCurrentApiIdentifier] = useState<string | null>(null);
  const [englishCaption, setEnglishCaption] = useState<string>("");
  const [yorubaCaption, setYorubaCaption] = useState<string>("");
  const [isLoadingCaption, setIsLoadingCaption] = useState<boolean>(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState<boolean>(false); // Keep this for translation-specific loading
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalImageCount, setTotalImageCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isFetchingFromServer, setIsFetchingFromServer] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [showingServerGallery, setShowingServerGallery] = useState<boolean>(false); // New state

  const { isSpeaking, playSound } = useAudioPlayer();

  // For LOCAL gallery scroll arrows
  const localGalleryScrollRef = useRef<ScrollView>(null);
  const {
    canScrollLeft: localCanScrollLeft,
    canScrollRight: localCanScrollRight,
    handleScroll: handleLocalGalleryScroll,
    handleLayout: handleLocalGalleryLayout,
    handleContentSizeChange: handleLocalGalleryContentSizeChange,
    scrollProgrammatically: scrollLocalGallery,
  } = useHorizontalScroll({ scrollRef: localGalleryScrollRef });

  // For SERVER gallery scroll arrows
  const serverGalleryScrollRef = useRef<ScrollView>(null);
  const {
    canScrollLeft: serverCanScrollLeft,
    canScrollRight: serverCanScrollRight,
    handleScroll: handleServerGalleryScroll,
    handleLayout: handleServerGalleryLayout,
    handleContentSizeChange: handleServerGalleryContentSizeChange,
    scrollProgrammatically: scrollServerGallery,
  } = useHorizontalScroll({ scrollRef: serverGalleryScrollRef });

  useEffect(() => {
    const initializeScreen = async () => {
      setIsInitialLoading(true);
      try {
        await initDatabase();

        // Parallelize fetching count and initial items
        const [count, dbItems] = await Promise.all([
          getTotalDictionaryImagesCount(),
          getDictionaryImages(IMAGES_PER_PAGE, 0)
        ]);

        // Add source property
        const initialItemsWithSource: DisplayableImageItem[] = dbItems.map(item => ({ ...item, source: 'local' }));

        setTotalImageCount(count);
        setLocalGalleryItems(initialItemsWithSource);
        setCurrentPage(0);

        if (initialItemsWithSource.length > 0) {
          const firstItem = initialItemsWithSource[0];
          let imageSourceToSet: number | { uri: string } | null = null;
          let captionToSet = firstItem.english_caption || "Caption not available.";

          if (firstItem.image_url) { // Prioritize image_url if present
            imageSourceToSet = { uri: firstItem.image_url };
          } else if (allImageSources[firstItem.image_key]) { // Local DB image with mapped asset
            imageSourceToSet = allImageSources[firstItem.image_key];
          }

          if (imageSourceToSet) {
            setSelectedImageSource(imageSourceToSet);
            setEnglishCaption(captionToSet);
            setYorubaCaption(""); // Clear previous, prepare for new translation
            setCurrentApiIdentifier(firstItem.image_key);
            // Fetch caption and translate asynchronously; don't await it here.
            // fetchCaptionAndTranslate will manage its own loading states.
            fetchCaptionAndTranslate(firstItem.image_key, firstItem.english_caption);
          } else {
            setSelectedImageSource(null);
            setEnglishCaption("Select an image from the gallery.");
            setYorubaCaption("");
            setCurrentApiIdentifier(null);
          }
          // Set initial active gallery to local if items exist
          setShowingServerGallery(false);
        } else {
          setSelectedImageSource(null);
          setEnglishCaption("No images in local DB. Try fetching from server or add images to DB.");
          setYorubaCaption("");
          setCurrentApiIdentifier(null);
          // Keep showingServerGallery as false if no local items
          setShowingServerGallery(false);
        }
      } catch (error) {
        // Keep showingServerGallery as false on error
        setShowingServerGallery(false);
        console.error("Error initializing screen:", error);
        Alert.alert("Error", "Could not initialize the screen.");
        setEnglishCaption("Error loading data.");
        setYorubaCaption("");
        setCurrentApiIdentifier(null);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initializeScreen();
    // Audio configuration and cleanup is now handled by useAudioPlayer hook
  }, []);

  const handleLoadMore = async () => {
    if (isLoadingMore || localGalleryItems.length >= totalImageCount || showingServerGallery) return; // Disable if showing server gallery
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const offset = nextPage * IMAGES_PER_PAGE;
    try {
      const newItems = await getDictionaryImages(IMAGES_PER_PAGE, offset);
      if (newItems.length > 0) {
        // Add source property
        setLocalGalleryItems(prevItems => [...prevItems, ...newItems.map(item => ({ ...item, source: 'local' }))]);
        setCurrentPage(nextPage);
        // Ensure local gallery is shown when loading more local items
        setShowingServerGallery(false);
      }
    } catch (error) {
      Alert.alert("Error", "Could not load more images.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const canLoadMoreDbImages = localGalleryItems.length < totalImageCount && !isLoadingMore;

  const handleFetchFromServer = async () => {
    if (isFetchingFromServer) return;
    setIsFetchingFromServer(true);
    try {
      const serverMetadata: ServerImageMetadata[] = await fetchServerImageMetadata();
      if (serverMetadata.length > 0) {
        const newServerDisplayableItems: DisplayableImageItem[] = serverMetadata.map(meta => ({
          image_key: meta.image_key,
          english_caption: meta.english_caption,
          image_url: `${BACKEND_BASE_URL}/api/images/${meta.asset_filename}`, // Construct URL here
          source: 'server',
        }));
        setServerGalleryItems(newServerDisplayableItems);
        // Switch to showing server gallery
        setShowingServerGallery(true);
      } else {
        setServerGalleryItems([]);
        Alert.alert("No Images Found", "No images were found on the server at this time.");
      }
    } catch (error) {
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

    // Determine source and update showingServerGallery state
    if (item.source === 'local') {
        setShowingServerGallery(false);
    } else if (item.source === 'server') {
        setShowingServerGallery(true);
    }

    if (item.image_url) {
      setSelectedImageSource({ uri: item.image_url });
    } else if (item.asset_filename && allImageSources[item.image_key]) {
      setSelectedImageSource(allImageSources[item.image_key]);
    } else {
      Alert.alert("Error", "Image resource not found or is invalid for this item.");
      setSelectedImageSource(null);
      return;
    }
    await fetchCaptionAndTranslate(item.image_key, item.english_caption);
  };

  const fetchCaptionAndTranslate = useCallback(async (identifier: string, preFetchedEngCaption?: string) => {
    if (!identifier) return;
    setIsLoadingCaption(true);
    setIsLoadingTranslation(true);
    setYorubaCaption("");
    try {
      setEnglishCaption(preFetchedEngCaption || "Caption not available.");
      setIsLoadingCaption(false);
      if (preFetchedEngCaption) {
        const yorubaTrans = await translateToYorubaAPI(preFetchedEngCaption);
        setYorubaCaption(yorubaTrans);
      } else {
        setYorubaCaption("Cannot translate without English caption.");
      }
    } catch (error) {
      setEnglishCaption(preFetchedEngCaption || "Error fetching caption.");
      setYorubaCaption("Error in translation process.");
    } finally {
      setIsLoadingCaption(false);
      setIsLoadingTranslation(false);
    }
  }, []);

  const handleSpeakYorubaCaption = async () => {
    if (!yorubaCaption.trim() || yorubaCaption.startsWith("Error:")) return;
    // Use the playSound function from the hook
    playSound(yorubaCaption);
  };

  // The scroll logic (state and handlers) is now managed by the useHorizontalScroll hook.
  // Old state variables (e.g., localGalleryScrollViewWidth, currentLocalGalleryScrollX) and
  // useCallback functions (e.g., updateLocalScrollArrowVisibility) related to manual scroll handling
  // have been removed as the hook provides these functionalities.

  const imageSourceForDisplay = selectedImageSource;
  const isProcessingAny = isLoadingCaption || isLoadingTranslation || isFetchingFromServer || isInitialLoading || isLoadingMore || isSpeaking; // Added isSpeaking
  const canInteractWithGallery = !isProcessingAny;
  const canPlaySound = !isSpeaking && yorubaCaption && !yorubaCaption.startsWith("Error:");

  const resolveLocalItemSource = (item: DisplayableImageItem): ImageSourcePropType | undefined => {
    if (item.image_key && allImageSources[item.image_key]) {
      return allImageSources[item.image_key];
    }
    return undefined; // Or a placeholder source
  };

  const resolveServerItemSource = (item: DisplayableImageItem): ImageSourcePropType | undefined => {
    if (item.image_url) {
      return { uri: item.image_url };
    }
    return undefined; // Or a placeholder source
  };

  // Button to switch galleries
  const handleSwitchGallery = () => {
    // If currently showing server, switch to local (if local items exist)
    // If currently showing local, switch to server (if server items exist)
    if (showingServerGallery) {
      if (localGalleryItems.length > 0) {
        setShowingServerGallery(false);
      } else {
        Alert.alert("No Local Images", "There are no images in the local gallery to display.");
      }
    } else { // Currently showing local or none
      if (serverGalleryItems.length > 0) {
        setShowingServerGallery(true);
      } else {
         Alert.alert("No Server Images", "Please fetch images from the server first.");
      }
    }
  };

  const showLocalGallery = !showingServerGallery && localGalleryItems.length > 0;
  const showServerGallery = showingServerGallery && serverGalleryItems.length > 0;
  const showSwitchButton = localGalleryItems.length > 0 || serverGalleryItems.length > 0;


  if (isInitialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading initial data...</Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1}}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
      >
        <Stack.Screen options={{ title: "Image Caption Translator" }} />
        {/* <Text style={styles.title}>Image Caption Screen</Text> */}

        {/* Fetch Server Button - Always visible */}
        <View style={styles.fetchButtonContainer}>
          <Button
            title={isFetchingFromServer ? "Fetching from Server..." : "Fetch New Images from Server"}
            onPress={handleFetchFromServer}
            disabled={isFetchingFromServer || isProcessingAny}
          />
        </View>
        
        {/* Gallery Switch Button */}
        {showSwitchButton && (
           <View style={styles.switchButtonContainer}>
             <Button
               title={showingServerGallery ? "Show Local Gallery" : "Show Server Images"}
               onPress={handleSwitchGallery}
               disabled={isProcessingAny}
             />
           </View>
        )}

        {/* Local Gallery Section */}
        {showLocalGallery && (
          <>
            <ImageGallery
              title="Local Gallery:"
              items={localGalleryItems}
              onSelectItem={handleSelectImage}
              currentSelectedItemKey={currentApiIdentifier}
              canInteractWithGallery={canInteractWithGallery}
              scrollRef={localGalleryScrollRef as RefObject<ScrollView>}
              canScrollLeft={localCanScrollLeft}
              canScrollRight={localCanScrollRight}
              onScrollArrowPress={scrollLocalGallery}
              handleScroll={handleLocalGalleryScroll}
              handleLayout={handleLocalGalleryLayout}
              handleContentSizeChange={(w, h) => handleLocalGalleryContentSizeChange(w, h)}
              resolveItemSource={resolveLocalItemSource}
              isThisGalleryActive={!showingServerGallery}
              // Props for "Load More" button for local gallery
              isLoadingMore={isLoadingMore}
              canLoadMore={canLoadMoreDbImages}
              onLoadMore={handleLoadMore}
              testID="local-gallery"
            />
            {/* "Load More DB Images" button is now part of ImageGallery component if canLoadMore & onLoadMore are passed */}
          </>
        )}
        {/* Server Images Gallery Section */}
        {showServerGallery && (
          <>
            <ImageGallery
              title="Server Images:"
              items={serverGalleryItems}
              onSelectItem={handleSelectImage}
              currentSelectedItemKey={currentApiIdentifier}
              canInteractWithGallery={canInteractWithGallery}
              scrollRef={serverGalleryScrollRef as RefObject<ScrollView>}
              canScrollLeft={serverCanScrollLeft}
              canScrollRight={serverCanScrollRight}
              onScrollArrowPress={scrollServerGallery}
              handleScroll={handleServerGalleryScroll}
              handleLayout={handleServerGalleryLayout}
              handleContentSizeChange={(w, h) => handleServerGalleryContentSizeChange(w, h)}
              resolveItemSource={resolveServerItemSource}
              isThisGalleryActive={showingServerGallery}
              // Server gallery does not have "Load More" in this setup
              // isLoadingMore={false} // Or omit
              // canLoadMore={false}   // Or omit
              // onLoadMore={undefined} // Or omit
              testID="server-gallery"
            />
          </>
        )}

        {/* Message if no gallery is shown */}
        {!showLocalGallery && !showServerGallery && (
            <View style={styles.noGalleryMessageContainer}>
                <Text style={styles.noGalleryMessageText}>
                    {showingServerGallery ? "No server images available. Try fetching." : "No local images available. Try fetching from server."}
                </Text>
            </View>
        )}


        <View style={styles.imageContainer}>
          {imageSourceForDisplay ? (
            <Image source={imageSourceForDisplay} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>Select an image</Text>
            </View>
          )}
        </View>

        <View style={styles.captionBox}>
          <Text style={styles.captionLabel}>English Caption:</Text>
          {isLoadingCaption ? (
            <ActivityIndicator size="small" color="#0000ff" />
          ) : (
            <Text style={styles.captionText}>{englishCaption}</Text>
          )}
        </View>

        <View style={styles.captionBox}>
          <Text style={styles.captionLabel}>Yoruba Translation:</Text>
          {isLoadingTranslation ? (
            <ActivityIndicator size="small" color="#0000ff" />
          ) : (
            <Text style={styles.captionText}>{yorubaCaption}</Text>
          )}
          {canPlaySound && (
            <Button
              title={isSpeaking ? "Playing..." : "🔊 Play Yoruba Caption"}
              onPress={handleSpeakYorubaCaption}
              disabled={isSpeaking || isProcessingAny}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 200,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  fetchButtonContainer: {
    marginBottom: 15,
    width: '80%',
    alignSelf: 'center',
  },
  switchButtonContainer: { // New style for the switch button
    marginBottom: 15,
    width: '80%',
    alignSelf: 'center',
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'flex-start', // This style is now in imageGallery.tsx (galleryTitleStyle)
  },
  imageContainer: {
    width: "100%",
    height: 250,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: "lightgray",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  imagePlaceholderText: {
    color: '#a0a0a0',
    fontSize: 16,
  },
  captionBox: {
    width: "100%",
    padding: 10,
    marginVertical: 10,
    borderColor: "lightgray",
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: "#f9f9f9",
  },
  captionLabel: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
  },
  captionText: {
    fontSize: 16,
    marginBottom: 10,
  },
  noGalleryMessageContainer: { // New style for message when no gallery is shown
    width: '100%',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100, // Give it some space
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  noGalleryMessageText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  }
});
