import { speakYorubaTextAPI } from "@/src/services/ttsApiService";
import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from "react";

export const useAudioPlayer = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        const interruptionModeIOSValue = Audio.InterruptionModeIOS?.DoNotMix ?? 1;
        const interruptionModeAndroidValue = Audio.InterruptionModeAndroid?.DoNotMix ?? 1;

        if (Audio.InterruptionModeIOS?.DoNotMix === undefined) {
          console.warn("[useAudioPlayer] Audio.InterruptionModeIOS.DoNotMix is undefined. Using fallback value 1.");
        }
        if (Audio.InterruptionModeAndroid?.DoNotMix === undefined) {
          console.warn("[useAudioPlayer] Audio.InterruptionModeAndroid.DoNotMix is undefined. Using fallback value 1.");
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: interruptionModeIOSValue,
          shouldDuckAndroid: true,
          interruptionModeAndroid: interruptionModeAndroidValue,
          playThroughEarpieceAndroid: false,
        });
        console.log("[useAudioPlayer] Audio mode configured.");
      } catch (e) {
        console.error("[useAudioPlayer] Failed to set audio mode. Error details:", e);
      }
    };

    configureAudio();

    return () => {
      if (soundRef.current) {
        console.log("[useAudioPlayer] Unmounting, unloading sound.");
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current.unloadAsync().catch(e => console.error("[useAudioPlayer] Error unloading sound on unmount:", e));
        soundRef.current = null;
      }
    };
  }, []);

  const playSound = useCallback(async (textToSpeak: string) => {
    if (!textToSpeak.trim() || textToSpeak.startsWith("Error:")) {
      console.log("[useAudioPlayer] Invalid text to speak or error message, skipping playback.");
      return;
    }

    // If a sound is already loaded (soundRef.current exists), stop and unload it first.
    // This handles cases where playSound is called again while a previous sound is playing or loaded.
    if (soundRef.current) {
      console.log("[useAudioPlayer] Existing sound instance found. Stopping and unloading it before playing new sound.");
      try {
        await soundRef.current.stopAsync();
        soundRef.current.setOnPlaybackStatusUpdate(null); // Remove listener from old sound
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.error("[useAudioPlayer] Error stopping/unloading previous sound:", e);
      }
      soundRef.current = null;
    }
    
    setIsSpeaking(true);
    let newSound: Audio.Sound | null = null; // Temporary reference to the new sound

    try {
      const audioDataUri = await speakYorubaTextAPI(textToSpeak);
      if (audioDataUri && !audioDataUri.startsWith("Error:")) {
        const { sound } = await Audio.Sound.createAsync({ uri: audioDataUri }, { shouldPlay: false });
        newSound = sound;
        soundRef.current = newSound; // Store the new sound in the ref

        newSound.setOnPlaybackStatusUpdate(async (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              console.error(`[useAudioPlayer] Playback Error: ${status.error}`);
              setIsSpeaking(false);
              if (soundRef.current === newSound) { // Check if it's still the current sound
                await soundRef.current.unloadAsync().catch(e => console.error("[useAudioPlayer] Error unloading sound on playback error:", e));
                soundRef.current = null;
              }
            }
          } else if (status.didJustFinish && !status.isLooping) {
            setIsSpeaking(false);
            if (soundRef.current === newSound) { // Check if it's still the current sound
              await soundRef.current.unloadAsync().catch(e => console.error("[useAudioPlayer] Error unloading sound on completion:", e));
              soundRef.current = null;
            }
          }
        });
        await newSound.playAsync();
      } else {
        console.error("[useAudioPlayer] Failed to get valid audio data URI:", audioDataUri);
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("[useAudioPlayer] Error in playSound:", error);
      setIsSpeaking(false);
      // If an error occurred during setup (e.g., createAsync, playAsync) and newSound was created
      if (newSound) {
        console.log("[useAudioPlayer] Unloading sound due to error during playSound setup/initiation.");
        try {
          newSound.setOnPlaybackStatusUpdate(null);
          await newSound.unloadAsync();
        } catch (e) {
          console.error("[useAudioPlayer] Error unloading sound in playSound catch block:", e);
        }
        if (soundRef.current === newSound) { // If soundRef was set to this newSound
          soundRef.current = null;
        }
      }
    }
  }, []); // Removed isSpeaking from dependencies. Cleanup of previous sound is handled at the start.

  return { isSpeaking, playSound };
};