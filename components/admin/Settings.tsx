import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView, Image } from 'react-native';
import { BRAND } from '../../constants/Theme';
import { ChevronDown } from 'lucide-react-native';

export default function Settings() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};

  // Mock toggle states
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [tfa, setTfa] = useState(true);

  // Custom Toggle Component
  const ToggleSwitch = ({ active, onChange }) => (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={() => onChange(!active)}
      style={[styles.toggleTrack, active ? {backgroundColor: BRAND.green} : {backgroundColor: '#d1d5db'}]}
    >
      <View style={[styles.toggleThumb, active ? {transform: [{translateX: 24}]} : {transform: [{translateX: 2}]}]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Settings</Text>

      <View style={styles.gridLayout}>
         
         {/* Left Column */}
         <View style={styles.columnView}>
            
            {/* Company Profile */}
            <View style={[styles.card, glass]}>
               <Text style={styles.cardTitle}>Company Profile</Text>
               <View style={styles.profileBox}>
                  <View style={styles.logoContainer}>
                     <Image source={require('../../assets/images/logo.jpg')} style={{width: 100, height: 40}} resizeMode="contain" />
                  </View>
                  <View style={{flex: 1}}>
                     <Text style={styles.infoText}><Text style={styles.infoBold}>Company Name:</Text> RENAX Logistics</Text>
                     <Text style={styles.infoText}><Text style={styles.infoBold}>Address:</Text> 12 Logistics Way, Lagos, Nigeria</Text>
                     <Text style={styles.infoText}><Text style={styles.infoBold}>Phone:</Text> +234 901 234 5678</Text>
                     <Text style={styles.infoText}><Text style={styles.infoBold}>Email:</Text> admin@renaxlogistics.com</Text>
                  </View>
               </View>
               <TouchableOpacity style={styles.editBtn}>
                   <Text style={styles.editBtnText}>Edit Profile</Text>
               </TouchableOpacity>
            </View>

            {/* Notification Settings */}
            <View style={[styles.card, glass]}>
               <Text style={styles.cardTitle}>Notification Settings</Text>
               <View style={styles.rowBetween}>
                  <Text style={styles.labelDark}>Email Notifications</Text>
                  <ToggleSwitch active={emailAlerts} onChange={setEmailAlerts} />
               </View>
               <View style={styles.rowBetween}>
                  <Text style={styles.labelDark}>SMS Alerts</Text>
                  <ToggleSwitch active={smsAlerts} onChange={setSmsAlerts} />
               </View>
            </View>

            {/* Security Settings */}
            <View style={[styles.card, glass]}>
               <Text style={styles.cardTitle}>Security Settings</Text>
               <View style={styles.rowBetween}>
                  <View>
                     <Text style={styles.labelDark}>Two-Factor Authentication</Text>
                  </View>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                     <Text style={{color: BRAND.green, fontWeight: '600'}}>Enabled</Text>
                     <TouchableOpacity style={styles.genericBtnLime}><Text style={styles.genericBtnTextLime}>Configure</Text></TouchableOpacity>
                  </View>
               </View>
               <View style={[styles.rowBetween, {alignItems: 'flex-start', marginTop: 16}]}>
                  <Text style={[styles.labelDark, {flex: 1}]}>Password Policy</Text>
                  <Text style={[styles.subText, {flex: 1}]}>Minimum 8 characters, must include a number and symbol</Text>
               </View>
            </View>

         </View>

         {/* Right Column */}
         <View style={styles.columnView}>
            
            {/* General Settings */}
            <View style={[styles.card, glass]}>
               <Text style={styles.cardTitle}>General Settings</Text>
               
               <View style={styles.inputGrid}>
                  <View style={styles.inputGroup}>
                     <Text style={styles.labelDark}>Default Currency</Text>
                     <View style={styles.dropdownInput}>
                        <Text style={styles.dropdownValue}>NGN (₦)</Text>
                        <ChevronDown size={16} color="#666" />
                     </View>
                  </View>
                  <View style={styles.inputGroup}>
                     <Text style={styles.labelDark}>Time Zone</Text>
                     <View style={styles.dropdownInput}>
                        <Text style={styles.dropdownValue}>Africa/Lagos</Text>
                        <ChevronDown size={16} color="#666" />
                     </View>
                  </View>
                  <View style={styles.inputGroup}>
                     <Text style={styles.labelDark}>Language</Text>
                     <View style={styles.dropdownInput}>
                        <Text style={styles.dropdownValue}>English</Text>
                        <ChevronDown size={16} color="#666" />
                     </View>
                  </View>
                  <View style={styles.inputGroup}>
                     <Text style={styles.labelDark}>Date Format</Text>
                     <View style={styles.dropdownInput}>
                        <Text style={styles.dropdownValue}>DD-MM-YYYY</Text>
                        <ChevronDown size={16} color="#666" />
                     </View>
                  </View>
               </View>
               
               <View style={[styles.rowBetween, {marginTop: 20}]}>
                  <Text style={styles.labelDark}>Session Timeout</Text>
                  <View style={[styles.dropdownInput, {minWidth: 150}]}>
                     <Text style={styles.dropdownValue}>30 Minutes</Text>
                     <ChevronDown size={16} color="#666" />
                  </View>
               </View>
            </View>

            {/* Payment & Billing */}
            <View style={[styles.card, glass]}>
               <Text style={styles.cardTitle}>Payment & Billing</Text>
               
               <View style={styles.inputGrid}>
                  <View style={styles.inputGroup}>
                     <Text style={styles.labelDark}>Payment Gateway</Text>
                     <View style={{flexDirection: 'row', gap: 10, marginTop: 6}}>
                        <TouchableOpacity style={[styles.pillBtn, styles.pillBtnActive]}><Text style={styles.pillTextActive}>Flutterwave</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.pillBtn}><Text style={styles.pillText}>Paystack</Text></TouchableOpacity>
                     </View>
                  </View>
                  <View style={styles.inputGroup}>
                     {/* Empty spacer or additional option in future */}
                  </View>
                  <View style={styles.inputGroup}>
                     <Text style={styles.labelDark}>Commission Rate</Text>
                     <View style={styles.dropdownInput}>
                        <Text style={styles.dropdownValue}>12%</Text>
                        <ChevronDown size={16} color="#666" />
                     </View>
                  </View>
                  <View style={styles.inputGroup}>
                     <Text style={styles.labelDark}>Payout Schedule</Text>
                     <View style={styles.dropdownInput}>
                        <Text style={styles.dropdownValue}>Weekly (Every Friday)</Text>
                        <ChevronDown size={16} color="#666" />
                     </View>
                  </View>
               </View>
            </View>

            <TouchableOpacity style={styles.saveBtn}>
               <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>

         </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 24,
  },
  gridLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  columnView: {
    flex: 1,
    minWidth: 400,
    gap: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  profileBox: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  logoContainer: {
    padding: 10,
    backgroundColor: '#00281a',
    borderRadius: 8,
  },
  infoText: {
    color: '#4B5568',
    fontSize: 14,
    marginBottom: 6,
  },
  infoBold: {
    fontWeight: '700',
    color: '#1a1a1a',
  },
  editBtn: {
    backgroundColor: BRAND.lime,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  editBtnText: {
    color: BRAND.green,
    fontWeight: '700',
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  labelDark: {
    fontWeight: '600',
    color: '#1a1a1a',
    fontSize: 14,
  },
  subText: {
    color: '#4B5568',
    fontSize: 13,
  },
  toggleTrack: {
    width: 52,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  genericBtnLime: {
    backgroundColor: BRAND.green,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  genericBtnTextLime: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  inputGroup: {
    flex: 1,
    minWidth: '45%',
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    backgroundColor: '#fff',
  },
  dropdownValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  pillBtn: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pillBtnActive: {
    backgroundColor: BRAND.green,
  },
  pillText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: BRAND.lime,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'flex-end',
    width: 200,
  },
  saveBtnText: {
    color: BRAND.green,
    fontWeight: '800',
    fontSize: 16,
  }
});
