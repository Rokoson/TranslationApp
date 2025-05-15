import { fromByteArray } from 'base64-js';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function Index() {
  const [englishText, setEnglishText] = useState("");
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // For TTS loading state
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1, // Corresponds to DoNotMix for iOS
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // Corresponds to DoNotMix for Android
          playThroughEarpieceAndroid: false,
        });
        console.log("Audio mode configured.");
      } catch (e) {
        console.error("Failed to set audio mode", e);
      }
    };

    configureAudio();

    return () => {
      // Cleanup sound when component unmounts
      if (soundRef.current) {
        console.log("Unloading sound on component unmount.");
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // --- WAV Encoding Helper Functions ---
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function floatTo16BitPCM(output: DataView, offset: number, input: number[]) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i])); // Clamp to -1 to 1
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // true for little-endian
    }
  }

  function pcmToWavBase64(pcmDataFloats: number[], sampleRate: number, numChannels: number = 1, bitsPerSample: number = 16): string {
    const SAMPLES = pcmDataFloats.length;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = SAMPLES * blockAlign;
    const bufferSize = 44 + dataSize; // 44 bytes for WAV header

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true); // ChunkSize
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true); // Subchunk2Size
    floatTo16BitPCM(view, 44, pcmDataFloats);
    const base64Wav = fromByteArray(new Uint8Array(buffer));
    return `data:audio/wav;base64,${base64Wav}`;
  }
  // --- End WAV Encoding Helper Functions ---

  const translateToYorubaAPI = async (text: string): Promise<string> => {
    if (!text.trim()) {
      return "";
    }
    const endpoint = "https://629f1160b15d.ngrok.app/translate";
    console.log(`API CALL: Translating "${text}" to Yoruba using ${endpoint}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any other necessary headers here, like an API key if required
          // 'Authorization': 'Bearer YOUR_API_KEY',
        },
        body: JSON.stringify({
          text: text,       // The text to translate
          source_lang: 'EN', // Source language
          target_lang: 'YO', // Target language (Yoruba)
        }),
      });

      if (!response.ok) {
        const errorData = await response.text(); // Or response.json() if error details are in JSON
        console.error("API Error Response:", errorData);
        throw new Error(`API request failed: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      // Adjust this based on the actual structure of your API's response
      // For example, if the translated text is in data.translation or data.data.translations[0].translatedText
      const translatedText = data.translated_text;
      
      return translatedText || `Error: Could not find translation in response for "${text}"`;
    } catch (error) {
      console.error("Error during translation API call:", error);
      return `Error translating: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  };

  const speakYorubaTextAPI = async (text: string): Promise<string | null> => {
    if (!text.trim()) {
      return "No text to speak.";
    }
    // Replace with your actual TTS API endpoint
    // Use your computer's local network IP address here:
    const ttsEndpoint = "http://127.0.0.1:8001/pronounce"; // e.g., http://192.168.1.100:5000/pronounce
    console.log(`TTS API CALL: Requesting speech for "${text}" from ${ttsEndpoint}`);

    try {
      const response = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any necessary auth headers for your TTS API
        },
        body: JSON.stringify({
          text: text,
          //language: 'yo', // Yoruba language code
          // Add other parameters your TTS API might need (e.g., voice, speed)
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("TTS API Error Response:", errorData);
        throw new Error(`TTS API request failed: ${response.status} - ${response.statusText}`);
      }

      // API returns a tuple: [float_array_audio_data, int_sample_rate]
      // Let's be more robust and check the actual structure.
      const jsonData = await response.json();
      console.log("TTS API JSON Data received:", JSON.stringify(jsonData)); // Log the raw data

      let pcmDataFloats: number[] | undefined;
      let sampleRate: number | undefined;

      if (Array.isArray(jsonData) && jsonData.length === 2) {
        // Case 1: Server sent a JSON array [audio_floats, sample_rate]
        pcmDataFloats = jsonData[0] as number[];
        sampleRate = jsonData[1] as number;
      } else if (typeof jsonData === 'object' && jsonData !== null) {
        // Case 2: Server sent a JSON object. Adjust keys as needed.
        // Common patterns:
        // Option A: { "audio": [...], "sample_rate": ... }
        // Option B: { "audio_data": [...], "sample_rate": ... }
        // Option C: { "data": [...], "rate": ... }
        // Choose or adapt based on your actual server response (see log above)
        pcmDataFloats = (jsonData as any).audio || (jsonData as any).audio_data || (jsonData as any).data;
        sampleRate = (jsonData as any).sample_rate || (jsonData as any).rate;
      }
      
      if (!pcmDataFloats || !Array.isArray(pcmDataFloats) || typeof sampleRate !== 'number') {
        console.error("Extracted audio data or sample rate is invalid/missing.", "pcmDataFloats type:", typeof pcmDataFloats, "sampleRate type:", typeof sampleRate);
        throw new Error(`Invalid or incomplete audio data structure received from API. Got pcmDataFloats (length ${pcmDataFloats?.length}) and sampleRate (${sampleRate})`);
      }
      return pcmToWavBase64(pcmDataFloats, sampleRate);
    } catch (error) {
      console.error("Error during TTS API call:", error);
      return `Error getting speech: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  };
  const handleTranslate = async () => {
    if (!englishText.trim()) {
      setYorubaText("");
      return;
    }
    setIsLoading(true);
    try {
      const translation = await translateToYorubaAPI(englishText);
      setYorubaText(translation);
    } catch (error) {
      console.error("Translation error:", error);
      setYorubaText("Error translating text.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeakYoruba = async () => {
    if (!yorubaText.trim() || yorubaText.startsWith("Error:")) {
      console.log("No valid Yoruba text to speak or text is an error message.");
      return;
    }

    if (isSpeaking && soundRef.current) {
      console.log("Already speaking or preparing to speak. Stopping previous sound.");
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (error) {
        console.error("Error stopping previous sound:", error);
      }
      // Fall through to start new playback after attempting to stop.
    }

    setIsSpeaking(true);

    try {
      // Ensure any lingering sound object (e.g. from a previous failed attempt that didn't clear ref) is handled
      if (soundRef.current) {
        console.log("Unloading existing sound object before new playback.");
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      console.log(`Requesting audio for: "${yorubaText}"`);
      const audioDataUri = await speakYorubaTextAPI(yorubaText);

      if (audioDataUri && !audioDataUri.startsWith("Error:")) {
        console.log("Received audio data URI. Attempting to create sound object...");
        // For debugging, you can log a snippet of the URI:
        // console.log("Audio Data URI (first 100 chars):", audioDataUri.substring(0, 100));

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioDataUri },
          { shouldPlay: false } // Load but don't play immediately
        );
        soundRef.current = sound;

        soundRef.current.setOnPlaybackStatusUpdate(async (playbackStatus) => {
          if (!playbackStatus.isLoaded) {
            if (playbackStatus.error) {
              console.error(`Playback Error: ${playbackStatus.error}`);
              setIsSpeaking(false);
              if (soundRef.current) { // Check again as it might be cleared
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          } else {
            if (playbackStatus.isPlaying) {
              // console.log("Playback is active.");
            }
            if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
              console.log("Playback finished.");
              setIsSpeaking(false);
              if (soundRef.current) { // Check again
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          }
        });
        
        console.log("Playing sound...");
        await soundRef.current.playAsync();
        // isSpeaking remains true until didJustFinish or an error occurs
      } else {
        console.error("Failed to get valid audio data URI. Received:", audioDataUri);
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Error in handleSpeakYoruba:", error);
      setIsSpeaking(false);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>English to Yoruba Translator</Text>

      <Text style={styles.label}>Enter English Text:</Text>
      <TextInput
        style={styles.input}
        placeholder="Type English here..."
        value={englishText}
        onChangeText={setEnglishText}
        multiline
      />
      <Button title={isLoading ? "Translating..." : "Translate to Yoruba"} onPress={handleTranslate} disabled={isLoading} />
      
      <View style={styles.translationSection}>
        <Text style={styles.label}>Yoruba Translation:</Text>
        {yorubaText && !yorubaText.startsWith("Error:") && (
          <Button 
            title={isSpeaking ? "Playing..." : "🔊 Play"} 
            onPress={handleSpeakYoruba} 
            disabled={isSpeaking} // Simplified: if button is visible, yorubaText is valid. isSpeaking controls playability.
          />
        )}
      </View>
      <View style={styles.outputContainer}>
        <Text style={styles.outputText}>
          {yorubaText || "Translation will appear here..."}</Text>
      </View>
    </ScrollView>
  );


};

const styles = StyleSheet.create({
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
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    alignSelf: "flex-start",
  },
  input: {
    width: "100%",
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginTop: 5,
    marginBottom: 15,
    minHeight: 80,
    textAlignVertical: 'top', // For multiline input
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
  },
  translationSection: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
});