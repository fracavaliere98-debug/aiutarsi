import React from 'react';
import { Tabs } from 'expo-router';
import { Shield, Settings, ShieldCheck, MessageSquare } from 'lucide-react-native';

export default function AdminTabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#311b92',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarStyle: {
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        height: 60,
        paddingBottom: 8,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '600',
      }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Segnalazioni',
          tabBarIcon: ({ color }) => <Shield size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="verifications"
        options={{
          title: 'Verifiche',
          tabBarIcon: ({ color }) => <ShieldCheck size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="faq-feedback"
        options={{
          title: 'FAQ',
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Impostazioni',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
