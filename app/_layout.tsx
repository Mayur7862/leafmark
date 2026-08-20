import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Library' }} />
        <Stack.Screen name="book/[id]" options={{ title: 'Book' }} />
        <Stack.Screen name="reader/[id]" options={{ title: 'Reader' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
