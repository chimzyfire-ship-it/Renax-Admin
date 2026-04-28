import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { BRAND } from '../../constants/Theme';
import { Users, MapPin, Calendar, Star, Plus } from 'lucide-react-native';

const CUSTOMERS = [
  { id: 'CUST-1001', name: 'John Okoro', phone: '+234 803 111 2233', email: 'john.okoro@email.com', total: '25', city: 'Port Harcourt', last: '2024-10-26', status: 'Active' },
  { id: 'CUST-1002', name: 'Aisha Bello', phone: '+234 805 222 3344', email: 'aisha.bello@email.com', total: '42', city: 'Lagos', last: '2024-10-25', status: 'Active' },
  { id: 'CUST-1003', name: 'Emeka Igwe', phone: '+234 809 333 4455', email: 'emeka.igwe@email.com', total: '18', city: 'Abuja', last: '2024-10-20', status: 'Inactive' },
  { id: 'CUST-1004', name: 'Fatima Usman', phone: '+234 802 444 5566', email: 'fatima.u@email.com', total: '31', city: 'Kano', last: '2024-10-27', status: 'Active' },
  { id: 'CUST-1005', name: 'Chinedu Obi', phone: '+234 807 555 6677', email: 'chinedu.obi@email.com', total: '9', city: 'Benin City', last: '2024-10-18', status: 'Inactive' },
  { id: 'CUST-1006', name: 'Grace Nwosu', phone: '+234 803 666 7788', email: 'grace.nwosu@email.com', total: '14', city: 'Enugu', last: '2024-10-24', status: 'Active' },
  { id: 'CUST-1007', name: 'Michael Ojo', phone: '+234 806 777 8899', email: 'michael.ojo@email.com', total: '5', city: 'Ibadan', last: '2024-10-22', status: 'Active' },
];

export default function Customers() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
         <Text style={styles.pageTitle}>Customers</Text>
         <TouchableOpacity style={styles.addBtn}>
            <Plus size={20} color={BRAND.green} />
            <Text style={styles.addBtnText}>Add New Customer</Text>
         </TouchableOpacity>
      </View>

      {/* KPI Stats Row */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, glass]}>
            <View>
                <Text style={styles.statLabel}>Total Customers</Text>
                <Text style={styles.statValue}>3,842</Text>
            </View>
            <View style={[styles.iconCircle, {backgroundColor: 'rgba(0,0,0,0.05)'}]}>
               <Users color="#333" size={20} />
            </View>
        </View>
        <View style={[styles.statCard, glass]}>
            <View>
                <Text style={styles.statLabel}>Active Customers</Text>
                <Text style={styles.statValue}>2,671</Text>
            </View>
            <View style={[styles.iconCircle, {backgroundColor: 'rgba(16, 185, 129, 0.15)'}]}>
               <MapPin color="#10b981" size={20} />
            </View>
        </View>
        <View style={[styles.statCard, glass]}>
            <View>
                <Text style={styles.statLabel}>New This Month</Text>
                <Text style={styles.statValue}>184</Text>
            </View>
            <View style={[styles.iconCircle, {backgroundColor: 'rgba(59, 130, 246, 0.15)'}]}>
               <Calendar color="#3b82f6" size={20} />
            </View>
        </View>
        <View style={[styles.statCard, glass]}>
            <View>
                <Text style={styles.statLabel}>High Value</Text>
                <Text style={styles.statValue}>312</Text>
            </View>
            <View style={[styles.iconCircle, {backgroundColor: 'rgba(245, 158, 11, 0.15)'}]}>
               <Star color="#f59e0b" fill="#f59e0b" size={18} />
            </View>
        </View>
      </View>

      {/* Data Table Area */}
      <View style={[styles.tableContainer, glass]}>
         <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1200 }}>
               {/* Header */}
               <View style={styles.tableHeader}>
                   <Text style={[styles.colHeader, {flex: 1}]}>Customer ID</Text>
                   <Text style={[styles.colHeader, {flex: 1.5}]}>Full Name</Text>
                   <Text style={[styles.colHeader, {flex: 1.8}]}>Phone Number</Text>
                   <Text style={[styles.colHeader, {flex: 2}]}>Email</Text>
                   <Text style={[styles.colHeader, {flex: 1.2, textAlign: 'center'}]}>Total Shipments</Text>
                   <Text style={[styles.colHeader, {flex: 1}]}>City</Text>
                   <Text style={[styles.colHeader, {flex: 1.2}]}>Last Shipment</Text>
                   <Text style={[styles.colHeader, {flex: 1}]}>Status</Text>
                   <Text style={[styles.colHeader, {flex: 2, textAlign: 'center'}]}>Actions</Text>
               </View>

               {/* Rows */}
               {CUSTOMERS.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                     <Text style={[styles.cellText, {flex: 1, fontWeight: '600'}]}>{item.id}</Text>
                     <Text style={[styles.cellText, {flex: 1.5}]}>{item.name}</Text>
                     <Text style={[styles.cellText, {flex: 1.8}]}>{item.phone}</Text>
                     <Text style={[styles.cellText, {flex: 2}]}>{item.email}</Text>
                     <Text style={[styles.cellText, {flex: 1.2, textAlign: 'center'}]}>{item.total}</Text>
                     <Text style={[styles.cellText, {flex: 1}]}>{item.city}</Text>
                     <Text style={[styles.cellText, {flex: 1.2}]}>{item.last}</Text>
                     
                     <View style={{flex: 1}}>
                        <View style={[
                           styles.statusPill,
                           item.status === 'Active' ? { backgroundColor: BRAND.green } : { backgroundColor: '#9ca3af' },
                        ]}>
                           <Text style={styles.statusPillText}>{item.status}</Text>
                        </View>
                     </View>

                     {/* Action Button Grid */}
                     <View style={[{flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center'}]}>
                        <TouchableOpacity style={styles.actionBtnGray}><Text style={styles.actionBtnTextGray}>View Profile</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnGray}><Text style={styles.actionBtnTextGray}>Shipments</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnGray}><Text style={styles.actionBtnTextGray}>History</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnGray}><Text style={styles.actionBtnTextGray}>Edit</Text></TouchableOpacity>
                     </View>
                  </View>
               ))}
            </View>
         </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.lime,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addBtnText: {
    color: BRAND.green,
    fontWeight: '700',
    fontSize: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statLabel: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  statValue: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '800',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    flex: 1,
    elevation: 2,
    minHeight: 500,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 16,
    marginBottom: 10,
  },
  colHeader: {
    fontWeight: '700',
    fontSize: 13,
    color: '#1a1a1a',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  cellText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnGray: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  actionBtnTextGray: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
  }
});
