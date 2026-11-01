import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, Text } from 'react-native';
import { FindFriendsScreen } from './src/screens/FindFriendsScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends App Mobile</Text>
        <Text style={styles.headerBadge}>iOS & Android</Text>
      </View>
      <FindFriendsScreen navigation={{ navigate: (screen: string) => console.log('Navigate to:', screen) }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'between', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  headerBadge: { color: '#10b981', fontSize: 11, fontWeight: '600', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }
});

