import { DictionaryImage, getDictionaryImages, getTotalDictionaryImagesCount, initDatabase } from "@/src/services/databaseService";
import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Button, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
const BACKEND_BASE_URL = "http://127.0.0.1:5005"; // Make sure this is correct!
// --- End Backend API Configuration ---

const IMAGES_PER_PAGE = 5;
export interface DisplayableImageItem extends Omit<DictionaryImage, 'id'> {
  id?: number;
  image_url?: string;
  source: 'local' | 'server'; // Add a source property
}

interface ServerImageMetadata {
  image_key: string;
  english_caption: string;
  asset_filename: string;
}

const fetchRealImagesFromServer = async (): Promise<Array<Omit<DisplayableImageItem, 'id' | 'asset_filename'>>> => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL") {
      Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL in imageCaption.tsx.");
      throw new Error("Backend URL not configured.");
  }
  const apiUrl = `${BACKEND_BASE_URL}/api/image_metadata`;
  console.log(`[ImageCaptionScreen] fetchRealImagesFromServer: Fetching image metadata from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    let metadataList: ServerImageMetadata[] = await response.json();
    console.log("[ImageCaptionScreen] fetchRealImagesFromServer: Received metadata:", metadataList);

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

    return validMetadataList.map(meta => ({
      image_key: meta.image_key,
      english_caption: meta.english_caption,
      image_url: `${BACKEND_BASE_URL}/api/images/${meta.asset_filename}`,
    }));
  } catch (error) {
    console.error("[ImageCaptionScreen] fetchRealImagesFromServer: Error fetching images:", error);
    throw error;
  }
};

export default function ImageCaptionScreen() {
  const [localGalleryItems, setLocalGalleryItems] = useState<DisplayableImageItem[]>([]);
  const [serverGalleryItems, setServerGalleryItems] = useState<DisplayableImageItem[]>([]);
  const [selectedImageSource, setSelectedImageSource] = useState<number | { uri: string } | null>(null);
  const [currentApiIdentifier, setCurrentApiIdentifier] = useState<string | null>(null);
  const [englishCaption, setEnglishCaption] = useState<string>("");
  const [yorubaCaption, setYorubaCaption] = useState<string>("");
  const [isLoadingCaption, setIsLoadingCaption] = useState<boolean>(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalImageCount, setTotalImageCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isFetchingFromServer, setIsFetchingFromServer] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [showingServerGallery, setShowingServerGallery] = useState<boolean>(false); // New state

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
    const configureAudio = async () => {
      try {
        const interruptionModeIOSValue = Audio.InterruptionModeIOS?.DoNotMix ?? 1;
        const interruptionModeAndroidValue = Audio.InterruptionModeAndroid?.DoNotMix ?? 1;

        if (Audio.InterruptionModeIOS?.DoNotMix === undefined) {
          console.warn("[ImageCaptionScreen] Audio.InterruptionModeIOS.DoNotMix is undefined. Using fallback value 1.");
        }
        if (Audio.InterruptionModeAndroid?.DoNotMix === undefined) {
          console.warn("[ImageCaptionScreen] Audio.InterruptionModeAndroid.DoNotMix is undefined. Using fallback value 1.");
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: interruptionModeIOSValue,
          shouldDuckAndroid: true,
          interruptionModeAndroid: interruptionModeAndroidValue,
          playThroughEarpieceAndroid: false,
        });
        console.log("Audio mode configured for ImageCaptionScreen.");
      } catch (e) {
        console.error("Failed to set audio mode on ImageCaptionScreen. Error details:", e);
      }
    };

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

    configureAudio();
    initializeScreen();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(e => console.error("Error unloading sound on unmount:", e));
        soundRef.current = null;
      }
    };
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
      const newServerImages = await fetchRealImagesFromServer();
      if (newServerImages.length > 0) {
        // Add source property
        setServerGalleryItems(newServerImages.map(item => ({ ...item, source: 'server' })));
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
    if (isSpeaking && soundRef.current) {
      await soundRef.current.stopAsync();
      soundRef.current.setOnPlaybackStatusUpdate(null);
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsSpeaking(true);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const audioDataUri = await speakYorubaTextAPI(yorubaCaption);
      if (audioDataUri && !audioDataUri.startsWith("Error:")) {
        const { sound } = await Audio.Sound.createAsync({ uri: audioDataUri }, { shouldPlay: false });
        soundRef.current = sound;
        soundRef.current.setOnPlaybackStatusUpdate(async (playbackStatus) => {
          if (!playbackStatus.isLoaded) {
            if (playbackStatus.error) {
              setIsSpeaking(false);
              if (soundRef.current) {
                soundRef.current.setOnPlaybackStatusUpdate(null);
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          } else {
            if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
              setIsSpeaking(false);
              if (soundRef.current) {
                soundRef.current.setOnPlaybackStatusUpdate(null);
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          }
        });
        await soundRef.current.playAsync();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      setIsSpeaking(false);
      if (soundRef.current) {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }
  };

  // --- Scroll Arrow Logic for LOCAL Gallery ---
  const updateLocalScrollArrowVisibility = useCallback((offsetX: number, contentW: number, layoutW: number) => {
    if (layoutW <= 0) return;
    setLocalCanScrollLeft(offsetX > 5);
    setLocalCanScrollRight(offsetX < contentW - layoutW - 5);
  }, []);
  const handleLocalGalleryScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCurrentLocalGalleryScrollX(contentOffset.x);
    updateLocalScrollArrowVisibility(contentOffset.x, contentSize.width, layoutMeasurement.width);
  };
  const handleLocalGalleryContentSizeChange = (contentWidth: number) => {
    updateLocalScrollArrowVisibility(currentLocalGalleryScrollX, contentWidth, localGalleryScrollViewWidth);
  };
  const scrollLocalGallery = (direction: 'left' | 'right') => {
    const scrollAmount = localGalleryScrollViewWidth * 0.8;
    const currentOffset = currentLocalGalleryScrollX;
    const newOffset = direction === 'left' ? Math.max(0, currentOffset - scrollAmount) : currentOffset + scrollAmount;
    localGalleryScrollRef.current?.scrollTo({ x: newOffset, animated: true });
  };

  // --- Scroll Arrow Logic for SERVER Gallery ---
  const updateServerScrollArrowVisibility = useCallback((offsetX: number, contentW: number, layoutW: number) => {
    if (layoutW <= 0) return;
    setServerCanScrollLeft(offsetX > 5);
    setServerCanScrollRight(offsetX < contentW - layoutW - 5);
  }, []);
  const handleServerGalleryScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCurrentServerGalleryScrollX(contentOffset.x);
    updateServerScrollArrowVisibility(contentOffset.x, contentSize.width, layoutMeasurement.width);
  };
  const handleServerGalleryContentSizeChange = (contentWidth: number) => {
    updateServerScrollArrowVisibility(currentServerGalleryScrollX, contentWidth, serverGalleryScrollViewWidth);
  };
  const scrollServerGallery = (direction: 'left' | 'right') => {
    const scrollAmount = serverGalleryScrollViewWidth * 0.8;
    const currentOffset = currentServerGalleryScrollX;
    const newOffset = direction === 'left' ? Math.max(0, currentOffset - scrollAmount) : currentOffset + scrollAmount;
    serverGalleryScrollRef.current?.scrollTo({ x: newOffset, animated: true });
  };

  const imageSourceForDisplay = selectedImageSource;
  const isProcessingAny = isLoadingCaption || isLoadingTranslation || isFetchingFromServer || isInitialLoading || isLoadingMore || isSpeaking; // Added isSpeaking
  const canInteractWithGallery = !isProcessingAny;
  const canPlaySound = !isSpeaking && yorubaCaption && !yorubaCaption.startsWith("Error:");

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
                onLayout={(event) => setLocalGalleryScrollViewWidth(event.nativeEvent.layout.width)}
                onContentSizeChange={handleLocalGalleryContentSizeChange}
                scrollEventThrottle={16}
              >
                {localGalleryItems.map((item) => (
                  <Pressable
                    key={item.image_key}
                    onPress={() => handleSelectImage(item)}
                    style={[
                      styles.galleryItem,
                      currentApiIdentifier === item.image_key && !showingServerGallery && styles.galleryItemSelected, // Highlight only if active gallery
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
              {localCanScrollRight && (
                <Pressable onPress={() => scrollLocalGallery('right')} style={[styles.arrowButton, styles.rightArrow]}>
                  <Text style={styles.arrowText}>{">"}</Text>
                </Pressable>
              )}
            </View>
            {canLoadMoreDbImages && (
              <Button title={isLoadingMore ? "Loading..." : "Load More DB Images"} onPress={handleLoadMore} disabled={isLoadingMore || isProcessingAny || showingServerGallery} />
            )}
          </>
        )}


        {/* Server Images Gallery Section */}
        {showServerGallery && (
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
                onLayout={(event) => setServerGalleryScrollViewWidth(event.nativeEvent.layout.width)}
                onContentSizeChange={handleServerGalleryContentSizeChange}
                scrollEventThrottle={16}
              >
                {serverGalleryItems.map((item) => (
                  <Pressable
                    key={item.image_key}
                    onPress={() => handleSelectImage(item)}
                    style={[
                      styles.galleryItem,
                      currentApiIdentifier === item.image_key && showingServerGallery && styles.galleryItemSelected, // Highlight only if active gallery
                      !canInteractWithGallery && styles.galleryItemDisabled
                    ]}
                    disabled={!canInteractWithGallery}
                  >
                    {item.image_url && (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                        onLoad={() => console.log(`[ImageGallery] Image LOADED: ${item.image_key} from ${item.image_url}`)}
                        onError={(e) => console.error(`[ImageGallery] Image FAILED to load: ${item.image_key} from ${item.image_url}. Error: ${e.nativeEvent.error}`)}
                      />
                    )}
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
    alignSelf: 'flex-start',
  },
  galleryContainerWithArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  galleryScrollView: {
    flex: 1,
    maxHeight: 120,
  },
  galleryItem: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  galleryItemSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  galleryItemDisabled: {
    opacity: 0.5,
  },
  galleryImage: {
    width: 80,
    height: 80,
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
  arrowButton: {
    paddingHorizontal: 8,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  leftArrow: {},
  rightArrow: {},
  arrowText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
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
