import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Platform, ScrollView, useWindowDimensions, Image } from 'react-native';
import { useFonts, PlusJakartaSans_800ExtraBold, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { BRAND } from '../../constants/Theme';

export default function AdminAuthScreen({ onAuthenticated }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_8: PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_6: PlusJakartaSans_600SemiBold,
    Outfit_4: Outfit_400Regular,
    Outfit_6: Outfit_600SemiBold,
    Outfit_7: Outfit_700Bold,
  });

  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!fontsLoaded) return null;

  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

  const handleSignIn = () => {
    // Admin login goes directly in
    onAuthenticated();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020f09' }}>
      {/* Specifically requested Background Image for Admin */}
      <Image 
        source={require('../../assets/images/Admin dashboard sign in page background.png')} 
        style={StyleSheet.absoluteFillObject as any} 
        resizeMode="cover" 
      />
      <LinearGradient
        colors={['rgba(0,10,6,0.3)', 'rgba(0,15,9,0.85)']}
        style={StyleSheet.absoluteFillObject as any}
      />

      <View style={[styles.authContainer, isMobile && { flexDirection: 'column' }]}>
        {/* ── LEFT PANEL ── */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.leftPanel}>
          <Image source={require('../../assets/images/logo.jpg')} style={styles.authLogo} resizeMode="contain" />
          <Text style={styles.authBrandTitle}>Command Center</Text>
          <Text style={styles.authBrandSub}>Secure administrative portal for {'\n'}RENAX Logistics operations.</Text>

          <View style={{ gap: 16, marginTop: 60 }}>
            {[
              { icon: 'verify', text: 'Authorized God-Mode Access Only' },
              { icon: 'shield', text: 'End-to-end encrypted sessions' },
              { icon: 'tracking', text: 'Monitor live fleet operations in real-time' },
            ].map((f, i) => (
              <Animated.View entering={FadeInDown.delay(100 * i)} key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={{ fontSize: 24, color: BRAND.lime }}>✓</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </Animated.View>
            ))}
          </View>

          <View style={styles.versionTag}>
            <Text style={styles.versionText}>RENAX Logistics Admin Portal | v1.1.0</Text>
          </View>
        </Animated.View>

        {/* ── RIGHT PANEL ── */}
        <Animated.View entering={FadeInDown.duration(700)} style={[styles.rightPanel, glass]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 24 }}>
              <View>
                <Text style={styles.authWelcome}>Admin Login</Text>
                <Text style={styles.authWelcomeSub}>Enter your credentials to access the command center.</Text>
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Admin Email or ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="admin.hq@renax.com"
                  placeholderTextColor="#4a6650"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrap}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.inputLabel}>Administrator Password</Text>
                  <Pressable><Text style={styles.forgotText}>Recovery</Text></Pressable>
                </View>
                <View style={styles.passWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0 }]}
                    placeholder="••••••••"
                    placeholderTextColor="#4a6650"
                    secureTextEntry={!showPass}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPass(p => !p)}>
                    {showPass ? <EyeOff color="#4a6650" size={20} /> : <Eye color="#4a6650" size={20} />}
                  </Pressable>
                </View>
              </View>

              <Pressable style={styles.authBtn} onPress={handleSignIn}>
                <Text style={styles.authBtnText}>Authorize Access</Text>
                <ArrowRight color={BRAND.green} size={20} />
              </Pressable>

              <View style={styles.securityNote}>
                 <Text style={styles.securityText}>Protected by enterprise-grade security</Text>
              </View>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1,
    padding: 50,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,40,26,0.3)',
  },
  authLogo: {
    width: 340,
    height: 140,
    marginBottom: 10,
  },
  authBrandTitle: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 42,
    color: BRAND.lime,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  authBrandSub: {
    fontFamily: 'Outfit_4',
    fontSize: 20,
    color: BRAND.white,
    lineHeight: 30,
  },
  featureText: {
    fontFamily: 'Outfit_6',
    fontSize: 16,
    color: BRAND.white,
    lineHeight: 24,
  },
  versionTag: {
    position: 'absolute',
    bottom: 30,
    left: 50,
  },
  versionText: {
    fontFamily: 'Outfit_4',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  rightPanel: {
    width: 460,
    padding: 50,
    backgroundColor: 'rgba(2, 15, 9, 0.95)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
  },
  authWelcome: {
    fontFamily: 'PlusJakartaSans_8',
    fontSize: 32,
    color: '#fff',
    marginBottom: 4,
  },
  authWelcomeSub: {
    fontFamily: 'Outfit_4',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  inputWrap: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: BRAND.lime,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontFamily: 'Outfit_4',
    fontSize: 15,
  },
  passWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: 'Outfit_4',
    fontSize: 13,
    color: '#808080',
  },
  authBtn: {
    backgroundColor: BRAND.lime,
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    shadowColor: BRAND.lime,
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  authBtnText: {
    fontFamily: 'Outfit_7',
    fontSize: 16,
    color: BRAND.green,
    letterSpacing: 0.5,
  },
  securityNote: {
    alignItems: 'center',
    marginTop: 20,
  },
  securityText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontFamily: 'Outfit_4',
  }
});
