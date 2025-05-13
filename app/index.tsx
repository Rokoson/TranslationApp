import React, { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function Index() {
  const [englishText, setEnglishText] = useState("");
  const [yorubaText, setYorubaText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const translateToYorubaAPI = async (text: string): Promise<string> => {
    if (!text.trim()) {
      return "";
    }
    console.log("Placeholder API CALL: Translating to Yoruba");
  
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay slightly
    // Restore placeholder logic
    if (text.trim().toLowerCase() === "hello") {
      return "Bawo";
    }
    if (text.trim().toLowerCase() === "how are you?") {
      return "Ṣe dáadáa ni?";
    }
    return `Yoruba translation for: "${text}" (API integration removed)`;
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
      <Text style={styles.label}>Yoruba Translation:</Text>
      <View style={styles.outputContainer}>
        <Text style={styles.outputText}>{yorubaText || "Translation will appear here..."}</Text>
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
});