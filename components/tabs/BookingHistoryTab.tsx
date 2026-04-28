// BookingHistoryTab.tsx — Booking history table matching reference design
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { ChevronDown, FileText, Navigation2, Filter } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const BOOKINGS_DATA = [
  { id: 'RLX-0018', date: 'Sep 18, 2023', dest: 'Port Harcourt', status: 'Delivered',  amount: '₦8,500' },
  { id: 'RLX-0014', date: 'Sep 15, 2023', dest: 'Abuja',          status: 'In Transit', amount: '₦12,200' },
  { id: 'RLX-0010', date: 'Sep 11, 2023', dest: 'Lagos',          status: 'Delivered',  amount: '₦7,900' },
  { id: 'RLX-0006', date: 'Sep 08, 2023', dest: 'Kaduna',         status: 'Delivered',  amount: '₦9,100' },
  { id: 'RLX-0003', date: 'Sep 04, 2023', dest: 'Enugu',          status: 'Cancelled',  amount: '₦5,600' },
  { id: 'RLX-0001', date: 'Sep 01, 2023', dest: 'Kano',           status: 'Delivered',  amount: '₦11,000' },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  'Delivered':  { bg: '#004d3d', text: '#ccfd3a' },
  'In Transit': { bg: '#F59E0B', text: '#fff' },
  'Cancelled':  { bg: '#EF4444', text: '#fff' },
};

const DATE_OPTIONS = ['All Time', 'Last 7 days', 'Last 30 days', 'Last 3 months'];
const STATUS_OPTIONS = ['All Status', 'Delivered', 'In Transit', 'Cancelled'];

const FilterDropdown = ({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: 'relative', zIndex: 10 }}>
      <Pressable onPress={() => setOpen(p => !p)} style={styles.filterBtn}>
        <Text style={styles.filterBtnText}>{selected}</Text>
        <ChevronDown color="#444" size={16} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          {options.map(opt => (
            <Pressable key={opt} onPress={() => { onSelect(opt); setOpen(false); }} style={[styles.filterOption, selected === opt && styles.filterOptionActive]}>
              <Text style={[styles.filterOptionText, selected === opt && { color: '#ccfd3a' }]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

export default function BookingHistoryTab() {
  const [dateFilter, setDateFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All Status');

  const filtered = BOOKINGS_DATA.filter(b =>
    statusFilter === 'All Status' || b.status === statusFilter
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 60 }}>
      <Text style={styles.pageTitle}>Booking History</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Past Bookings</Text>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <FilterDropdown options={DATE_OPTIONS} selected={dateFilter} onSelect={setDateFilter} />
          <FilterDropdown options={STATUS_OPTIONS} selected={statusFilter} onSelect={setStatusFilter} />
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          {['Date', 'Order ID', 'Destination', 'Status', 'Amount (₦)', 'Actions'].map((h, i) => (
            <Text key={h} style={[styles.thCell, i === 5 && { textAlign: 'right' }]}>{h}</Text>
          ))}
        </View>

        {/* Rows */}
        {filtered.map((b, i) => {
          const sc = STATUS_STYLE[b.status] || STATUS_STYLE['Delivered'];
          return (
            <Animated.View key={b.id} entering={FadeInDown.delay(i * 60).duration(350)} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
              <Text style={styles.tdCell}>{b.date}</Text>
              <Text style={[styles.tdCell, { color: '#004d3d', fontFamily: 'Outfit_6' }]}>{b.id}</Text>
              <Text style={styles.tdCell}>{b.dest}</Text>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusBadgeText, { color: sc.text }]}>{b.status}</Text>
              </View>
              <Text style={[styles.tdCell, { fontFamily: 'Outfit_6' }]}>{b.amount}</Text>
              <View style={styles.actionsCell}>
                <Pressable style={styles.actionBtn}>
                  <FileText color="#fff" size={14} />
                  <Text style={styles.actionBtnText}>View Details</Text>
                </Pressable>
                <Pressable style={styles.actionBtnOutline}>
                  <Navigation2 color="#004d3d" size={14} />
                  <Text style={styles.actionBtnOutlineText}>Track</Text>
                </Pressable>
              </View>
            </Animated.View>
          );
        })}

        <Text style={styles.footNote}>Displaying the last 50 bookings.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#111', marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#111', marginBottom: 20 },
  filtersRow: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', minWidth: 200 },
  filterBtnText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#333', flex: 1 },
  filterDropdown: { position: 'absolute', top: 50, left: 0, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, minWidth: 200, overflow: 'hidden' },
  filterOption: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  filterOptionActive: { backgroundColor: '#004d3d' },
  filterOptionText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#333' },
  tableHeader: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: '#f0f0f0', marginBottom: 4 },
  thCell: { flex: 1, fontFamily: 'Outfit_7', fontSize: 13, color: '#555', letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f8f8f8' },
  tableRowAlt: { backgroundColor: '#fafcfb' },
  tdCell: { flex: 1, fontFamily: 'Outfit_4', fontSize: 14, color: '#333' },
  statusBadge: { flex: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  statusBadgeText: { fontFamily: 'Outfit_7', fontSize: 12 },
  actionsCell: { flex: 1, flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ccfd3a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { fontFamily: 'Outfit_7', fontSize: 12, color: '#002B22' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#004d3d', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnOutlineText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' },
  footNote: { fontFamily: 'Outfit_4', fontSize: 13, color: '#888', marginTop: 20 },
});
