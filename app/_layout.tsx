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
        name="index" // This refers to app/index.tsx (our home screen)
        options={{ title: "Learn Yoruba Home" }} // Updated title
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
  <Stack.Screen
    name="imageFlashcard" // This refers to app/imageFlashcard.tsx
    options={{ title: "Image Flashcards" }}
  />
  <Stack.Screen
    name="sentenceFlashcard" // This refers to app/sentenceFlashcard.tsx
    options={{ title: "Sentence Flashcards" }}
  />
  <Stack.Screen
    name="beginnerClassroom"
    options={{ title: "Beginner Classroom" }}
  />
  <Stack.Screen
    name="intermediateClassroom"
    options={{ title: "Intermediate Classroom" }}
  />
    </Stack>
  );
}
