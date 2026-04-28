// TrackShipmentTab.tsx — Shipment Tracking view matching the reference design
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Search, Truck, Clock, MapPin, Navigation, AlertCircle, CheckCircle, Circle, Phone, Plus } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MapView from '../maps';

const TIMELINE = [
  { date: 'Sep 16, 2023 | 09:15', event: 'Shipment Created (Lagos Dist. Hub)', status: 'Created', done: true },
  { date: 'Sep 17, 2023 | 11:30', event: 'Picked Up (Lagos Dist. Hub)', status: 'Picked Up', done: true },
  { date: 'Sep 17, 2023 | 16:15', event: 'Arrived at Warri Distribution Hub', status: 'Warri Hub', done: true },
  { date: 'Sep 18, 2023 | 08:30', event: 'Out for Delivery (Port Harcourt courier route)', status: 'Out for Delivery', done: false, alert: true },
];

export default function TrackShipmentTab() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 1024;
  const [trackId, setTrackId] = useState('RNX-1207');
  const [mapActive, setMapActive] = useState(false);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Shipment Tracking (RNX-1207)</Text>
          <Text style={styles.pageSub}>Details for your delivery to Port Harcourt</Text>
        </View>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Search color="#004d3d" size={18} />
          <TextInput
            style={styles.searchInput}
            value={trackId}
            onChangeText={setTrackId}
            placeholder="Enter Order ID..."
            placeholderTextColor="#aaa"
          />
          <Pressable style={styles.searchBtn}><Text style={styles.searchBtnText}>Track</Text></Pressable>
        </View>
      </View>

      {/* Alert */}
      <View style={styles.alertBanner}>
        <AlertCircle color="#EF4444" size={20} />
        <Text style={styles.alertText}>
          Landmark Description Required for Delivery to Port Harcourt.{' '}
          <Text style={styles.alertLink}>Add landmark</Text>
        </Text>
      </View>

      {/* Stat Cards */}
      <View style={[styles.statRow, isMobile && { flexWrap: 'wrap' }]}>
        {[
          { label: 'Current Status', value: 'In Transit', sub: 'Awaiting Landmark', icon: Truck, accent: true },
          { label: 'Est. Arrival', value: '16:30 Today', icon: Clock },
          { label: 'Total Distance', value: '614 km', icon: MapPin },
          { label: 'Progress', value: '85% Complete', progress: 85, icon: Navigation },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <Animated.View key={card.label} entering={FadeInDown.delay(i * 80).duration(400)} style={styles.statCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>{card.label}</Text>
                <Text style={[styles.statValue, card.accent && { color: '#ccfd3a' }]}>{card.value}</Text>
                {card.sub && (
                  <View style={styles.subPill}>
                    <AlertCircle color="#EF4444" size={12} />
                    <Text style={styles.subPillText}>{card.sub}</Text>
                  </View>
                )}
                {card.progress && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${card.progress}%` }]} />
                  </View>
                )}
              </View>
              <Icon color="#ccfd3a" size={30} />
            </Animated.View>
          );
        })}
      </View>

      {/* Map + Details */}
      <View style={[styles.mainGrid, isMobile && { flexDirection: 'column' }]}>
        {/* Map placeholder */}
        <View style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapBadge}>Tracking RNX-1207 | Est. Arrival: 16:30 Today</Text>
          </View>
          <View style={styles.mapBody}>
            {/* The base map rendering behind everything */}
            <MapView style={StyleSheet.absoluteFillObject} />

            {/* Offline Dimmer Layer */}
            {!mapActive && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5,25,15,0.85)', zIndex: 1 }]} />
            )}

            {/* Obstructive Route Visualization (Hidden completely when Map is Online/Active) */}
            {!mapActive && (
              <View pointerEvents="none" style={[styles.routeRow, { zIndex: 2, position: 'absolute', bottom: 100, width: '100%' }]}>
                {['Lagos', 'Lagos Distribution Hub', 'Warri Port', 'Port Harcourt'].map((city, i, arr) => (
                  <View key={city} style={{ alignItems: 'center', flex: 1 }}>
                    <View style={[styles.routeDot, i < 2 && styles.routeDotActive, i === 2 && styles.routeDotCurrent]} />
                    <Text style={styles.routeCity}>{city}</Text>
                    {i < arr.length - 1 && <View style={styles.routeLine} />}
                  </View>
                ))}
              </View>
            )}

            {/* Dynamic Online/Offline Toggle Button */}
            {!mapActive ? (
              <Pressable
                style={{
                  position: 'absolute',
                  bottom: 30,
                  alignSelf: 'center',
                  backgroundColor: '#10B981',
                  paddingHorizontal: 40,
                  paddingVertical: 14,
                  borderRadius: 30,
                  zIndex: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                }}
                onPress={() => setMapActive(true)}
              >
                <Text style={{ color: '#fff', fontFamily: 'PlusJakartaSans_7', fontSize: 15, letterSpacing: 1 }}>
                  GO ONLINE
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  backgroundColor: '#EF4444',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  zIndex: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                }}
                onPress={() => setMapActive(false)}
              >
                <Text style={{ color: '#fff', fontFamily: 'PlusJakartaSans_7', fontSize: 12, letterSpacing: 1 }}>
                  GO OFFLINE
                </Text>
              </Pressable>
            )}
          </View>
          {/* Timeline */}
          <View style={styles.timeline}>
            {TIMELINE.map((t, i) => (
              <View key={i} style={styles.tlRow}>
                <View style={styles.tlLeft}>
                  {t.done
                    ? <CheckCircle color="#004d3d" size={22} fill="#004d3d" />
                    : t.alert
                      ? <AlertCircle color="#EF4444" size={22} />
                      : <Circle color="#ccc" size={22} />}
                  {i < TIMELINE.length - 1 && <View style={[styles.tlLine, t.done && styles.tlLineDone]} />}
                </View>
                <View style={styles.tlBody}>
                  <Text style={styles.tlDate}>{t.date}</Text>
                  <Text style={[styles.tlEvent, t.alert && { color: '#EF4444' }]}>{t.event}</Text>
                </View>
                <View style={[styles.tlBadge, t.done && styles.tlBadgeDone, t.alert && styles.tlBadgeAlert]}>
                  <Text style={styles.tlBadgeText}>{t.status}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Shipment Details panel */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Shipment Details</Text>
          <View style={styles.detailsGrid}>
            {[
              { label: 'Order ID', value: 'RNX-1207' },
              { label: 'Sent From', value: 'Lagos Distribution' },
              { label: 'Deliver To', value: 'Specific Port Harcourt Address' },
              { label: 'Recipient', value: 'Adewale' },
            ].map(d => (
              <View key={d.label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={styles.detailValue}>{d.value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.detailActions}>
            <Pressable style={styles.btnOutline}>
              <Phone color="#004d3d" size={16} />
              <Text style={styles.btnOutlineText}>Call Courier</Text>
            </Pressable>
            <Pressable style={styles.btnSolid}>
              <Plus color="#fff" size={16} />
              <Text style={styles.btnSolidText}>Add Landmark</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 24, color: '#111', marginBottom: 4 },
  pageSub: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingLeft: 14, borderWidth: 1, borderColor: '#e0e0e0', gap: 8 },
  searchInput: { flex: 1, fontFamily: 'Outfit_4', fontSize: 14, color: '#333', paddingVertical: 10 },
  searchBtn: { backgroundColor: '#004d3d', paddingHorizontal: 16, paddingVertical: 12, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  searchBtnText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#ccfd3a' },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#fecaca' },
  alertText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#991b1b', flex: 1 },
  alertLink: { fontFamily: 'Outfit_7', color: '#EF4444', textDecorationLine: 'underline' },
  statRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, minWidth: 160, backgroundColor: '#004d3d', borderRadius: 14, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { fontFamily: 'Outfit_4', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 4 },
  statValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 22, color: '#fff', marginBottom: 4 },
  subPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  subPillText: { fontFamily: 'Outfit_6', fontSize: 11, color: '#EF4444' },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#ccfd3a', borderRadius: 3 },
  mainGrid: { flexDirection: 'row', gap: 20 },
  mapCard: { flex: 2, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  mapHeader: { padding: 16, backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'flex-end' },
  mapBadge: { fontFamily: 'Outfit_4', fontSize: 13, color: '#555', backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  mapBody: { height: 220, backgroundColor: '#1a2b25', alignItems: 'center', justifyContent: 'center', padding: 20 },
  mapPlaceholder: { fontFamily: 'PlusJakartaSans_6', fontSize: 16, color: '#fff', marginBottom: 20 },
  routeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', position: 'relative' },
  routeDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ccc', marginBottom: 4 },
  routeDotActive: { backgroundColor: '#004d3d' },
  routeDotCurrent: { backgroundColor: '#ccfd3a', width: 18, height: 18, borderRadius: 9 },
  routeCity: { fontFamily: 'Outfit_4', fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  routeLine: { position: 'absolute', top: 7, left: '55%', right: '-55%', height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  timeline: { padding: 20 },
  tlRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  tlLeft: { alignItems: 'center', width: 22 },
  tlLine: { width: 2, flex: 1, backgroundColor: '#e0e0e0', marginVertical: 4 },
  tlLineDone: { backgroundColor: '#004d3d' },
  tlBody: { flex: 1, paddingBottom: 20 },
  tlDate: { fontFamily: 'Outfit_4', fontSize: 12, color: '#999', marginBottom: 2 },
  tlEvent: { fontFamily: 'Outfit_6', fontSize: 14, color: '#222' },
  tlBadge: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  tlBadgeDone: { backgroundColor: '#004d3d' },
  tlBadgeAlert: { backgroundColor: '#FEE2E2' },
  tlBadgeText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#fff' },
  detailsCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, minWidth: 260 },
  detailsTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 20 },
  detailsGrid: { gap: 18, marginBottom: 28 },
  detailItem: { gap: 4 },
  detailLabel: { fontFamily: 'Outfit_4', fontSize: 12, color: '#999', letterSpacing: 0.5 },
  detailValue: { fontFamily: 'Outfit_6', fontSize: 15, color: '#222' },
  detailActions: { gap: 12 },
  btnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#004d3d', borderRadius: 10, paddingVertical: 13 },
  btnOutlineText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },
  btnSolid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#004d3d', borderRadius: 10, paddingVertical: 13 },
  btnSolidText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#ccfd3a' },
});
