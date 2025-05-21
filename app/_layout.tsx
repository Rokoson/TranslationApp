import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        // You can set default header styles here if you want
        // headerStyle: { backgroundColor: '#f4511e' },
        // headerTintColor: '#fff',
        // headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="index" // This refers to app/index.tsx (our new homescreen)
        options={{ title: "Translator Home" }} 
      />
      <Stack.Screen 
        name="textTranslator" // This refers to app/textTranslator.tsx
        options={{ title: "Text Translator" }} 
      />
      <Stack.Screen 
        name="imageCaption" // This refers to app/imageCaption.tsx
        options={{ title: "Image Caption Translator" }} 
      />
      <Stack.Screen
        name="sentenceBuilder" // This will refer to app/sentenceBuilder.tsx
        options={{ title: "Sentence Builder" }}
      />
    </Stack>
  );
}
