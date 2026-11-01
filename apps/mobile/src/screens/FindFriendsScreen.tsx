import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Alert } from 'react-native';
import { MobileCallingPermissionService } from '../services/CallingPermissionService';
import { CallType, Role } from '../../../../packages/shared/src/types';

export const FindFriendsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<any>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (searching) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
        ])
      ).start();

      const timer = setTimeout(() => {
        setSearching(false);
        setMatch({
          id: 'usr-sam-02',
          name: 'Samantha Chen',
          bio: 'UX designer, book lover, indie games fan. Let’s connect!',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          interests: ['UI/UX', 'Reading', 'Gaming']
        });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [searching]);

  const handleStartSearch = () => {
    setMatch(null);
    setSearching(true);
  };

  const handleConnectAudio = () => {
    // Current mobile user demo state
    const userMembership = {
      canUserAudioCall: true,
      canCelebrityAudioCall: true,
      canCelebrityVideoCall: true,
      credits: 35,
      planName: 'Gold VIP'
    };

    const perm = MobileCallingPermissionService.checkPermission(
      Role.NORMAL_USER,
      Role.NORMAL_USER,
      CallType.AUDIO,
      userMembership
    );

    if (!perm.allowed) {
      Alert.alert('Permission Denied', perm.message);
      return;
    }

    navigation.navigate('AudioCall', { partnerName: match.name, partnerAvatar: match.avatar });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Radar Matchmaker</Text>
      <Text style={styles.subtitle}>Discover available friends online based on common interests.</Text>

      {/* Radar Center */}
      <View style={styles.radarContainer}>
        <Animated.View style={[styles.radarWave, { transform: [{ scale: pulseAnim }] }]} />
        <TouchableOpacity style={styles.searchButton} onPress={handleStartSearch}>
          <Text style={styles.buttonText}>{searching ? 'Searching...' : 'Find Friend'}</Text>
        </TouchableOpacity>
      </View>

      {match && (
        <View style={styles.matchCard}>
          <Image source={{ uri: match.avatar }} style={styles.avatar} />
          <Text style={styles.matchName}>{match.name}</Text>
          <Text style={styles.matchBio}>{match.bio}</Text>
          <View style={styles.interestsRow}>
            {match.interests.map((tag: string, i: number) => (
              <View key={i} style={styles.interestPill}><Text style={styles.pillText}>{tag}</Text></View>
            ))}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.skipButton} onPress={() => setMatch(null)}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.connectButton} onPress={handleConnectAudio}>
              <Text style={styles.connectText}>Voice Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', marginTop: 30 },
  subtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  radarContainer: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
  radarWave: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: 'rgba(16, 185, 129, 0.4)' },
  searchButton: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  matchCard: { width: '100%', backgroundColor: '#0f172a', borderRadius: 24, padding: 20, alignItems: 'center', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1 },
  avatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#10b981', marginBottom: 10 },
  matchName: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  matchBio: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginVertical: 6 },
  interestsRow: { flexDirection: 'row', gap: 6, marginVertical: 10 },
  interestPill: { backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { color: '#e2e8f0', fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 10 },
  skipButton: { flex: 1, backgroundColor: '#1e293b', padding: 12, borderRadius: 14, alignItems: 'center' },
  skipText: { color: '#cbd5e1', fontWeight: 'bold' },
  connectButton: { flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 14, alignItems: 'center' },
  connectText: { color: '#ffffff', fontWeight: 'bold' }
});

