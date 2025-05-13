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
    const endpoint = "https://e06e-34-135-191-170.ngrok-free.app/translate";
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
      const translatedText = data.translated_text || data.translation;

      return translatedText || `Error: Could not find translation in response for "${text}"`;
    } catch (error) {
      console.error("Error during translation API call:", error);
      return `Error translating: ${error instanceof Error ? error.message : "Unknown error"}`;
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