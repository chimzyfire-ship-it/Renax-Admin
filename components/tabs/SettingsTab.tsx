import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { User, Bell, Lock, Globe, ChevronRight, LogOut, Check } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SettingsTab() {
  const { t } = useTranslation();
  
  // Example toggles
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>{t('dash.settings', 'Settings')}</Text>
          <Text style={styles.pageSub}>Manage your account preferences and security.</Text>
        </View>
      </View>

      <View style={styles.mainGrid}>
        
        {/* Left Column: List of Settings Sections */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.leftCol}>
          <View style={styles.menuCard}>
            {[
              { id: 'profile', icon: User, label: 'Profile Information', active: true },
              { id: 'notifications', icon: Bell, label: 'Notifications' },
              { id: 'security', icon: Lock, label: 'Password & Security' },
              { id: 'language', icon: Globe, label: 'Language & Region' },
            ].map((item, idx) => (
              <Pressable key={item.id} style={[styles.menuItem, item.active && styles.menuItemActive, idx === 0 && { borderTopWidth: 0 }]}>
                <View style={styles.menuItemLeft}>
                  <item.icon color={item.active ? '#ccfd3a' : '#004d3d'} size={20} />
                  <Text style={[styles.menuItemLabel, item.active && { color: '#fff' }]}>{item.label}</Text>
                </View>
                <ChevronRight color={item.active ? '#ccfd3a' : '#888'} size={18} />
              </Pressable>
            ))}
          </View>
          
          <Pressable style={styles.logoutBtn}>
            <LogOut color="#EF4444" size={20} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </Animated.View>

        {/* Right Column: Active Settings View (Mocking Profile Info as default) */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.rightCol}>
          
          {/* Section 1: Profile */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile Information</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput style={styles.input} defaultValue="Adewale" placeholder="Your Name" />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput style={styles.input} defaultValue="adewale@example.com" placeholder="Email" />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput style={styles.input} defaultValue="+234 801 234 5678" placeholder="Phone" />
              </View>
            </View>
            <View style={{ alignItems: 'flex-start', marginTop: 24 }}>
              <Pressable style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>

          {/* Section 2: Notifications */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notification Preferences</Text>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Email Notifications</Text>
                <Text style={styles.toggleSub}>Receive updates on your shipments via email</Text>
              </View>
              <Switch value={emailNotif} onValueChange={setEmailNotif} trackColor={{ false: '#e0e0e0', true: '#004d3d' }} thumbColor="#fff" />
            </View>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>SMS Alerts</Text>
                <Text style={styles.toggleSub}>Get real-time tracking texts directly to your phone</Text>
              </View>
              <Switch value={smsNotif} onValueChange={setSmsNotif} trackColor={{ false: '#e0e0e0', true: '#004d3d' }} thumbColor="#fff" />
            </View>
            <View style={[styles.toggleRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View>
                <Text style={styles.toggleTitle}>Push Notifications</Text>
                <Text style={styles.toggleSub}>In-app alerts for all major delivery milestones</Text>
              </View>
              <Switch value={pushNotif} onValueChange={setPushNotif} trackColor={{ false: '#e0e0e0', true: '#004d3d' }} thumbColor="#fff" />
            </View>
          </View>

        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#111', marginBottom: 4 },
  pageSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666' },
  
  mainGrid: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  leftCol: { flex: 1, minWidth: 280, maxWidth: 320 },
  rightCol: { flex: 2, minWidth: 320 },

  menuCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuItemActive: { backgroundColor: '#004d3d' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemLabel: { fontFamily: 'Outfit_6', fontSize: 15, color: '#333' },
  
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, backgroundColor: '#FEF2F2', borderRadius: 16, borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { fontFamily: 'Outfit_6', fontSize: 15, color: '#EF4444' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 24 },
  cardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 24 },
  
  inputGrid: { gap: 16 },
  inputWrap: { gap: 8 },
  inputLabel: { fontFamily: 'Outfit_6', fontSize: 13, color: '#555' },
  input: { backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Outfit_4', fontSize: 15, color: '#111' },
  
  saveBtn: { backgroundColor: '#ccfd3a', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
  saveBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  toggleTitle: { fontFamily: 'Outfit_6', fontSize: 15, color: '#111', marginBottom: 4 },
  toggleSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#777' },
});
