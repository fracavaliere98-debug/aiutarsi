import React from 'react';
import { Stack , Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#311b92" />
      </View>
    );
  }

  // Guard for Admin Area
  if (!user || user.role !== 'ADMIN') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen 
        name="report/[id]" 
        options={{ 
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
