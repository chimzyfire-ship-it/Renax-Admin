import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BRAND } from '../../constants/Theme';
import { CheckCircle, Circle, MapPin, Search, Truck, Users, X } from 'lucide-react-native';
import { supabase } from '../../supabase';
import { fetchFleetRows, updateFleetVehicleStatus, updateStaffTerminalAssignment } from '../../utils/adminData';
import { stageColor, stageLabel } from '../../utils/routingService';

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function RidersDrivers() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRider, setSelectedRider] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [terminalSearch, setTerminalSearch] = useState('');

  const loadRiders = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, terminalRows] = await Promise.all([
        fetchFleetRows(),
        supabase.from('terminals').select('id, name, code, city, state, status').eq('status', 'active').order('state'),
      ]);
      setRiders(rows);
      setTerminals(terminalRows.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRiders();

    const channel = supabase
      .channel('admin-riders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, () => loadRiders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => loadRiders())
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [loadRiders]);

  useEffect(() => {
    setTerminalSearch('');
  }, [selectedRider?.riderId]);

  const stats = useMemo(() => ({
    total: riders.length,
    online: riders.filter((rider) => rider.isOnline).length,
    available: riders.filter((rider) => rider.status === 'Available').length,
    offline: riders.filter((rider) => rider.status === 'Offline').length,
  }), [riders]);

  const filteredRiders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return riders;
    return riders.filter((rider) =>
      rider.riderName?.toLowerCase().includes(query)
      || rider.phoneNumber?.toLowerCase().includes(query)
      || rider.vehicleType?.toLowerCase().includes(query)
      || rider.plateNumber?.toLowerCase().includes(query)
      || rider.terminalCode?.toLowerCase().includes(query)
    );
  }, [riders, searchQuery]);

  const filteredTerminals = useMemo(() => {
    const query = terminalSearch.trim().toLowerCase();
    if (!query) return terminals;
    return terminals.filter((terminal) =>
      terminal.name?.toLowerCase().includes(query)
      || terminal.code?.toLowerCase().includes(query)
      || terminal.city?.toLowerCase().includes(query)
      || terminal.state?.toLowerCase().includes(query)
    );
  }, [terminalSearch, terminals]);

  const handleSuspendToggle = async (rider: any) => {
    const nextStatus = rider.status === 'Offline' ? 'available' : 'offline';
    setBusyId(rider.riderId);
    try {
      await updateFleetVehicleStatus(rider.riderId, nextStatus);
      await loadRiders();
      if (selectedRider?.riderId === rider.riderId) {
        const next = (await fetchFleetRows()).find((row: any) => row.riderId === rider.riderId);
        if (next) setSelectedRider(next);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignTerminal = async (rider: any, terminalId: string) => {
    setBusyId(`terminal:${rider.riderId}`);
    try {
      await updateStaffTerminalAssignment(rider.riderId, terminalId);
      await loadRiders();
      const next = (await fetchFleetRows()).find((row: any) => row.riderId === rider.riderId);
      if (next) setSelectedRider(next);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Riders & Drivers</Text>
          <Text style={styles.pageSub}>Live roster of riders, their current availability, locations, active assignments, and ops-owned terminal hub assignment.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={loadRiders}>
          <Text style={styles.refreshBtnText}>Refresh Riders</Text>
        </Pressable>
      </View>

      <View style={styles.statsContainer}>
        {[
          { label: 'Total Riders', value: stats.total, icon: Users, color: '#1F2937' },
          { label: 'Online', value: stats.online, icon: MapPin, color: '#10B981' },
          { label: 'Available', value: stats.available, icon: CheckCircle, color: '#3B82F6' },
          { label: 'Offline', value: stats.offline, icon: Circle, color: '#6B7280' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <View key={card.label} style={[styles.statCard, glass]}>
              <View>
                <Text style={styles.statLabel}>{card.label}</Text>
                <Text style={styles.statValue}>{card.value}</Text>
              </View>
              <View style={[styles.iconCircle, { backgroundColor: `${card.color}1A` }]}>
                <Icon color={card.color} size={20} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color="#6B7280" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholder="Search rider, phone, vehicle, plate, or terminal..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={[styles.tableContainer, glass]}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={BRAND.green} size="large" />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1340 }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { flex: 1.4 }]}>Full Name</Text>
                <Text style={[styles.colHeader, { flex: 1.5 }]}>Phone Number</Text>
                <Text style={[styles.colHeader, { flex: 1.0 }]}>Vehicle Type</Text>
                <Text style={[styles.colHeader, { flex: 1.1 }]}>Status</Text>
                <Text style={[styles.colHeader, { flex: 1.3 }]}>Current Location</Text>
                <Text style={[styles.colHeader, { flex: 1.0 }]}>Deliveries Today</Text>
                <Text style={[styles.colHeader, { flex: 0.9 }]}>Terminal</Text>
                <Text style={[styles.colHeader, { flex: 1.8, textAlign: 'center' }]}>Actions</Text>
              </View>

              {filteredRiders.map((rider) => {
                const color =
                  rider.status === 'Available' ? '#3B82F6'
                    : rider.status === 'On Delivery' ? '#10B981'
                    : rider.status === 'Maintenance' ? '#F59E0B'
                    : '#6B7280';

                return (
                  <View key={rider.riderId} style={styles.tableRow}>
                    <View style={{ flex: 1.4 }}>
                      <Text style={[styles.cellText, { fontWeight: '700' }]}>{rider.riderName}</Text>
                      <Text style={styles.cellMeta}>{rider.vehicleId}</Text>
                    </View>
                    <Text style={[styles.cellText, { flex: 1.5 }]}>{rider.phoneNumber}</Text>
                    <View style={[styles.vehicleCell, { flex: 1.0 }]}>
                      <Truck size={14} color="#666" style={{ marginRight: 6 }} />
                      <Text style={styles.cellText}>{rider.vehicleType}</Text>
                    </View>
                    <View style={{ flex: 1.1 }}>
                      <View style={[styles.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}33` }]}>
                        <Text style={[styles.statusPillText, { color }]}>{rider.status}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cellText, { flex: 1.3 }]}>{rider.currentLocation}</Text>
                    <Text style={[styles.cellText, { flex: 1.0 }]}>{rider.deliveriesToday}</Text>
                    <Text style={[styles.cellText, { flex: 0.9 }]}>{rider.terminalCode}</Text>
                    <View style={styles.actionCell}>
                      <Pressable style={styles.actionBtnGray} onPress={() => setSelectedRider(rider)}>
                        <Text style={styles.actionBtnTextGray}>View Profile</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnGray} onPress={() => handleSuspendToggle(rider)} disabled={busyId === rider.riderId}>
                        <Text style={styles.actionBtnTextGray}>
                          {busyId === rider.riderId ? 'Working...' : rider.status === 'Offline' ? 'Activate' : 'Suspend'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={!!selectedRider} transparent animationType="fade" onRequestClose={() => setSelectedRider(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Rider Profile</Text>
                <Text style={styles.modalSub}>{selectedRider?.riderName}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={() => setSelectedRider(null)}>
                <X size={18} color="#111827" />
              </Pressable>
            </View>

            {selectedRider ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailsGrid}>
                  {[
                    ['Phone', selectedRider.phoneNumber],
                    ['Vehicle', selectedRider.vehicleType],
                    ['Vehicle ID', selectedRider.vehicleId],
                    ['Plate', selectedRider.plateNumber],
                    ['Status', selectedRider.status],
                    ['Assigned Hub', selectedRider.assignedTerminalName || selectedRider.assignedTerminalCode || selectedRider.terminalCode],
                    ['Preferred Hub', selectedRider.preferredTerminalName || selectedRider.preferredTerminalCode || 'N/A'],
                    ['Operating Coverage', `${selectedRider.operatingCity || 'Unknown city'}, ${selectedRider.operatingState || 'Unknown state'}`],
                    ['Account Role', selectedRider.accountRole || 'N/A'],
                    ['Current Location', selectedRider.currentLocation],
                    ['Last Seen', formatDate(selectedRider.lastSeen)],
                    ['Deliveries Today', String(selectedRider.deliveriesToday)],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={styles.detailCard}>
                      <Text style={styles.detailLabel}>{String(label)}</Text>
                      <Text style={styles.detailValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Current Assignment</Text>
                {selectedRider.currentShipment ? (
                  <View style={styles.assignmentCard}>
                    <Text style={styles.assignmentTitle}>{selectedRider.currentShipment.trackingId || selectedRider.currentShipment.id}</Text>
                    <Text style={styles.assignmentMeta}>{selectedRider.currentShipment.route}</Text>
                    <Text style={[styles.assignmentStage, { color: stageColor(selectedRider.currentShipment.stage) }]}>
                      {stageLabel(selectedRider.currentShipment.stage)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>This rider has no active assignment right now.</Text>
                )}

                <Text style={styles.sectionTitle}>Logistics Roles</Text>
                <View style={styles.rolePillRow}>
                  {(selectedRider.logisticsRoles?.length ? selectedRider.logisticsRoles : ['unclassified']).map((role: string) => (
                    <View key={role} style={styles.rolePill}>
                      <Text style={styles.rolePillText}>{String(role).replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Assign Hub</Text>
                <Text style={styles.sectionSub}>
                  This is the live hub assignment ops owns. It should not change just because the rider edits operating state or city.
                </Text>
                <View style={styles.searchBox}>
                  <Search size={16} color="#6B7280" />
                  <TextInput
                    value={terminalSearch}
                    onChangeText={setTerminalSearch}
                    style={styles.searchInput}
                    placeholder="Search terminal by code, city, or state..."
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.terminalAssignList}>
                  {filteredTerminals.slice(0, 12).map((terminal) => {
                    const isAssigned = selectedRider.assignedTerminalId === terminal.id;
                    return (
                      <View key={terminal.id} style={styles.terminalAssignCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.terminalAssignTitle}>{terminal.name}</Text>
                          <Text style={styles.terminalAssignMeta}>{terminal.code} • {terminal.city}, {terminal.state}</Text>
                        </View>
                        <Pressable
                          style={[styles.assignBtn, isAssigned && styles.assignBtnActive]}
                          onPress={() => handleAssignTerminal(selectedRider, terminal.id)}
                          disabled={isAssigned || busyId === `terminal:${selectedRider.riderId}`}
                        >
                          <Text style={[styles.assignBtnText, isAssigned && styles.assignBtnTextActive]}>
                            {isAssigned ? 'Assigned' : busyId === `terminal:${selectedRider.riderId}` ? 'Saving...' : 'Assign Hub'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <Pressable style={styles.actionBtnGrayLarge} onPress={() => handleSuspendToggle(selectedRider)} disabled={busyId === selectedRider.riderId}>
                    <Text style={styles.actionBtnTextGray}>
                      {busyId === selectedRider.riderId ? 'Working...' : selectedRider.status === 'Offline' ? 'Reactivate Rider' : 'Suspend Rider'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
    flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  pageSub: { fontSize: 15, color: '#4b5563', maxWidth: 760 },
  refreshBtn: {
    backgroundColor: BRAND.lime,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  refreshBtnText: { color: BRAND.green, fontWeight: '700', fontSize: 14 },
  statsContainer: { flexDirection: 'row', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statLabel: { color: '#1a1a1a', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  statValue: { color: '#111827', fontSize: 32, fontWeight: '800' },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    outlineStyle: 'none' as any,
  },
  tableContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
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
  cellMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  vehicleCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionCell: {
    flex: 1.8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  actionBtnGray: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnTextGray: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  modalSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  detailCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  detailLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },
  sectionSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
    lineHeight: 20,
  },
  rolePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  rolePill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    textTransform: 'capitalize',
  },
  assignmentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#003822',
    marginBottom: 6,
  },
  assignmentMeta: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 6,
  },
  assignmentStage: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalActions: {
    marginTop: 18,
  },
  terminalAssignList: {
    gap: 10,
    marginBottom: 18,
  },
  terminalAssignCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: 14,
    padding: 14,
  },
  terminalAssignTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  terminalAssignMeta: {
    fontSize: 12,
    color: '#4B5563',
  },
  assignBtn: {
    backgroundColor: BRAND.lime,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assignBtnActive: {
    backgroundColor: '#DCFCE7',
  },
  assignBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#002B22',
  },
  assignBtnTextActive: {
    color: '#166534',
  },
  actionBtnGrayLarge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
});
