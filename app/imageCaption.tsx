import { translateToYorubaAPI } from "@/src/services/translationApiService";
import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Link, Stack } from "expo-router"; // Keep Stack if you want to set screen options here
import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Ensure these images exist in /Users/davidolagunju/Projects/React-Native/TranslationApp/assets/images/
const catImage = require('@/assets/images/animals_cat.png');
const birdImage = require('@/assets/images/animals_bird.png'); // Example: Add this image
const dogImage = require('@/assets/images/animals_dog.png'); 
const earsImage = require('@/assets/images/body_parts_ears.png'); //
const handsImage = require('@/assets/images/body_parts_hands.png'); //


const localGalleryImages = [
  { id: 'cat', source: catImage, apiIdentifier: 'local_gallery_cat_image', name: 'Cat' },
  { id: 'bird', source: birdImage, apiIdentifier: 'local_gallery_bird_image', name: 'Bird' },
  { id: 'dog', source: dogImage, apiIdentifier: 'local_gallery_dog_image', name: 'Dog' },
  { id: 'ears', source: earsImage, apiIdentifier: 'local_gallery_ears_image', name: 'Ears'},
  { id: 'hands', source: handsImage, apiIdentifier: 'local_gallery_hands_image', name: 'Hands'},

  // Add more images here. Make sure the files exist and are required above.
];

// --- Mock Image Captioning Service ---
// In a real app, this would call an actual image captioning API.
// It would likely take the image URI or base64 data as input.
const mockGetEnglishCaptionAPI = async (apiId: string): Promise<string> => {
  console.log("ImageCaptionAPI: Getting English caption for identifier:", apiId);
  return new Promise(resolve => {
    setTimeout(() => {
      let englishCaption: string;
      const localPrefix = "local_gallery_";
      const localSuffix = "_image";

      if (apiId.startsWith(localPrefix) && apiId.endsWith(localSuffix)) {
        // Extract the core name from identifiers like "local_gallery_cat_image" -> "cat"
        const coreName = apiId.substring(localPrefix.length, apiId.length - localSuffix.length);
        if (coreName) {
          // Use the core name directly without capitalization
          englishCaption = coreName;
        } else {
          englishCaption = "Error: Could not parse local image name.";
        }
      } else {
        // This is likely an image picked from the device gallery (URI)
        // For now, return a generic caption. A real API would be called here for actual captioning.
        // You could also keep the random captions if you prefer for picked images.
        englishCaption = "This image was selected from your device gallery.";
        // Example of keeping random captions for picked images:
        // const randomCaptions = ["A photo from the gallery.", "User-selected image.", "A picture from device."];
        // englishCaption = randomCaptions[Math.floor(Math.random() * randomCaptions.length)];
      }
      resolve(englishCaption);
    }, 250); // Shorter delay for quicker feedback
  });
};
// --- End Mock Service ---

export default function ImageCaptionScreen() {
  // selectedImageSource can be a number (from require()) or an ImagePickerAsset (from device gallery)
  const [selectedImageSource, setSelectedImageSource] = useState<ImagePicker.ImagePickerAsset | number | null>(
    localGalleryImages.length > 0 ? localGalleryImages[0].source : null
  );
  // currentApiIdentifier will be the string passed to the mock API
  // It's either a URI from ImagePicker or a custom identifier for local images
  const [currentApiIdentifier, setCurrentApiIdentifier] = useState<string | null>(
    localGalleryImages.length > 0 ? localGalleryImages[0].apiIdentifier : null
  );

  const [englishCaption, setEnglishCaption] = useState<string>("");
  const [yorubaCaption, setYorubaCaption] = useState<string>("");
  
  // Loading states
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [isLoadingCaption, setIsLoadingCaption] = useState<boolean>(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Request media library permissions
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
        }
      }
    })();

    // Audio configuration
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.error("Failed to set audio mode on ImageCaptionScreen", e);
      }
    };
    configureAudio();

    // Fetch caption for the initially selected gallery image (if any)
    if (currentApiIdentifier && !englishCaption && !isLoadingCaption && !isLoadingTranslation) {
      fetchCaptionAndTranslate(currentApiIdentifier);
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const handlePickImage = async () => {
    setIsLoadingImage(true);
    // No need to reset selectedImageSource here, it will be overwritten or picker cancelled
    setEnglishCaption("");
    setYorubaCaption("");

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageSource(asset); // Store the whole asset
        setCurrentApiIdentifier(asset.uri); // Use URI for API
        await fetchCaptionAndTranslate(asset.uri);
      }
    } catch (error) {
      console.error("Image picking error:", error);
      Alert.alert("Error", "Could not pick image.");
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleSelectFromLocalGallery = async (item: typeof localGalleryImages[0]) => {
    if (isLoadingCaption || isLoadingTranslation) return; // Don't change if already processing

    setSelectedImageSource(item.source);
    setCurrentApiIdentifier(item.apiIdentifier);
    
    // Reset captions and trigger fetch
    setEnglishCaption("");
    setYorubaCaption("");
    await fetchCaptionAndTranslate(item.apiIdentifier);
  };

  const fetchCaptionAndTranslate = async (apiId: string) => {
    if (!apiId) return;

    setIsLoadingCaption(true);
    setEnglishCaption("");
    setYorubaCaption("");
    try {
      // Log which identifier is being used (URI from picker or local gallery ID)
      console.log("Fetching caption for API identifier:", apiId);
      const engCaption = await mockGetEnglishCaptionAPI(apiId);
      setEnglishCaption(engCaption);
      
      if (engCaption && !engCaption.startsWith("Error:")) {
        setIsLoadingTranslation(true);
        const yorCaption = await translateToYorubaAPI(engCaption);
        setYorubaCaption(yorCaption);
      } else {
        setYorubaCaption("Could not get English caption to translate.");
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
      await soundRef.current.stopAsync();
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
        soundRef.current.setOnPlaybackStatusUpdate(async (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              console.error(`Playback Error: ${status.error}`);
              setIsSpeaking(false);
              if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          } else {
            if (status.didJustFinish && !status.isLooping) {
              setIsSpeaking(false);
              if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
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
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }
  };

  let imageSourceForDisplay;
  if (selectedImageSource) {
    if (typeof selectedImageSource === 'number') { // From require()
      imageSourceForDisplay = selectedImageSource;
    } else { // From ImagePicker (ImagePicker.ImagePickerAsset)
      imageSourceForDisplay = { uri: selectedImageSource.uri };
    }
  } else if (localGalleryImages.length > 0) {
    // Fallback to first gallery image if selectedImageSource became null somehow
    // and gallery is not empty
    imageSourceForDisplay = localGalleryImages[0].source;
  } else {
    // Absolute fallback if gallery is empty and nothing selected
    // You might want a more generic placeholder image here if localGalleryImages can be empty
    imageSourceForDisplay = catImage; // Default to catImage or a specific placeholder
  }

  const isProcessing = isLoadingImage || isLoadingCaption || isLoadingTranslation;
  const canInteractWithGallery = !isProcessing;
  const canPickImage = !isProcessing;
  const canPlaySound = !isSpeaking && yorubaCaption && !yorubaCaption.startsWith("Error:");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Image Caption Translator" }} />
      <Text style={styles.title}>Image to Yoruba Caption</Text>

      <Button 
        title={isLoadingImage ? "Loading Image..." : "Pick an Image from Gallery"} 
        onPress={handlePickImage} 
        disabled={!canPickImage}
      />

      <Text style={styles.galleryTitle}>Or select from local gallery:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScrollView}>
        {localGalleryImages.map((item) => (
          <Pressable 
            key={item.id} 
            onPress={() => handleSelectFromLocalGallery(item)}
            style={[
              styles.galleryItem, 
              (typeof selectedImageSource === 'number' && selectedImageSource === item.source) && styles.galleryItemSelected,
              !canInteractWithGallery && styles.galleryItemDisabled
            ]}
            disabled={!canInteractWithGallery}
          >
            <Image source={item.source} style={styles.galleryImage} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.imageContainer}>
        <Image source={imageSourceForDisplay} style={styles.image} resizeMode="contain" />
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
        <Link href="/" style={styles.link}>Go back to Home</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
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
    // paddingBottom: 5, // No longer needed if text is removed, or adjust as preferred
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
  // galleryItemText: { // Style is no longer needed
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
  }
});