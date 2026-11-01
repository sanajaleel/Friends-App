import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

export const AudioCallScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { partnerName, partnerAvatar } = route.params || { partnerName: 'Samantha Chen', partnerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' };
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const mins = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${mins}:${s}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>WebRTC Encrypted Audio Call</Text>

      <Image source={{ uri: partnerAvatar }} style={styles.avatar} />
      <Text style={styles.name}>{partnerName}</Text>
      <Text style={styles.timer}>{formatTimer(seconds)}</Text>

      <View style={styles.controlsRow}>
        <TouchableOpacity style={[styles.controlBtn, muted && styles.controlBtnActive]} onPress={() => setMuted(!muted)}>
          <Text style={styles.controlText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlBtn, speaker && styles.controlBtnActive]} onPress={() => setSpeaker(!speaker)}>
          <Text style={styles.controlText}>{speaker ? 'Earpiece' : 'Speaker'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', padding: 20 },
  badge: { fontSize: 11, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 30 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#10b981', marginBottom: 16 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  timer: { fontSize: 16, color: '#34d399', fontFamily: 'monospace', marginTop: 6, marginBottom: 40 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  controlBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  controlBtnActive: { backgroundColor: '#334155', borderWidth: 1, borderColor: '#10b981' },
  controlText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  endCallBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  endCallText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 }
});

