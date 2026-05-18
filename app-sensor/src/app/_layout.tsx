import { Slot } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <Slot />
    </ThemeProvider>
  );
}
