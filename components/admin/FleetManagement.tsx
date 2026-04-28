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
import { MapPin, RefreshCw, Truck, Wrench, PauseCircle, Search, X } from 'lucide-react-native';
import { supabase } from '../../supabase';
import { fetchFleetRows, updateFleetVehicleStatus } from '../../utils/adminData';
import { shipmentStatusFromStage, stageColor, stageLabel } from '../../utils/routingService';

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function FleetManagement() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadFleet = useCallback(async () => {
    setLoading(true);
    try {
      const fleetRows = await fetchFleetRows();
      setVehicles(fleetRows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleet();

    const channel = supabase
      .channel('admin-fleet-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, () => loadFleet())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => loadFleet())
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadFleet]);

  const totals = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter((vehicle) => vehicle.status === 'Available').length,
    onDelivery: vehicles.filter((vehicle) => vehicle.status === 'On Delivery').length,
    maintenance: vehicles.filter((vehicle) => vehicle.status === 'Maintenance').length,
    offline: vehicles.filter((vehicle) => vehicle.status === 'Offline').length,
  }), [vehicles]);

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((vehicle) =>
      vehicle.vehicleId?.toLowerCase().includes(query)
      || vehicle.plateNumber?.toLowerCase().includes(query)
      || vehicle.riderName?.toLowerCase().includes(query)
      || vehicle.phoneNumber?.toLowerCase().includes(query)
      || vehicle.vehicleType?.toLowerCase().includes(query)
      || vehicle.terminalCode?.toLowerCase().includes(query)
    );
  }, [vehicles, searchQuery]);

  const handleToggleMaintenance = async (vehicle: any) => {
    const nextStatus = vehicle.status === 'Maintenance' ? 'available' : 'maintenance';
    setBusyId(vehicle.riderId);
    try {
      await updateFleetVehicleStatus(vehicle.riderId, nextStatus);
      await loadFleet();
      if (selectedVehicle?.riderId === vehicle.riderId) {
        const updatedRows = await fetchFleetRows();
        const next = updatedRows.find((row: any) => row.riderId === vehicle.riderId);
        if (next) setSelectedVehicle(next);
      }
    } finally {
      setBusyId(null);
    }
  };

  const openVehicle = (vehicle: any) => {
    setSelectedVehicle(vehicle);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Fleet Management</Text>
          <Text style={styles.pageSub}>Live rider fleet, current shipment load, vehicle readiness, and maintenance status.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={loadFleet}>
          <RefreshCw size={18} color={BRAND.green} />
          <Text style={styles.refreshBtnText}>Refresh Fleet</Text>
        </Pressable>
      </View>

      <View style={styles.statsContainer}>
        {[
          { label: 'Total Fleet', value: totals.total, icon: Truck, color: '#3B82F6' },
          { label: 'Available', value: totals.available, icon: MapPin, color: '#10B981' },
          { label: 'On Delivery', value: totals.onDelivery, icon: Truck, color: '#0EA5E9' },
          { label: 'Maintenance', value: totals.maintenance, icon: Wrench, color: '#F59E0B' },
          { label: 'Offline', value: totals.offline, icon: PauseCircle, color: '#6B7280' },
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

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search color="#6b7280" size={16} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search vehicle ID, plate, rider, phone, type, or terminal..."
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      <View style={[styles.tableContainer, glass]}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={BRAND.green} size="large" />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1500 }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { flex: 1.0 }]}>Vehicle ID</Text>
                <Text style={[styles.colHeader, { flex: 1.0 }]}>Plate</Text>
                <Text style={[styles.colHeader, { flex: 1.0 }]}>Type</Text>
                <Text style={[styles.colHeader, { flex: 1.4 }]}>Rider</Text>
                <Text style={[styles.colHeader, { flex: 1.0 }]}>Status</Text>
                <Text style={[styles.colHeader, { flex: 1.3 }]}>Current Shipment</Text>
                <Text style={[styles.colHeader, { flex: 1.1 }]}>Terminal</Text>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Deliveries Today</Text>
                <Text style={[styles.colHeader, { flex: 1.3 }]}>Last Seen</Text>
                <Text style={[styles.colHeader, { flex: 1.8, textAlign: 'center' }]}>Actions</Text>
              </View>

              {filteredVehicles.map((vehicle) => {
                const statusColor =
                  vehicle.status === 'Available' ? '#10B981'
                    : vehicle.status === 'On Delivery' ? '#0EA5E9'
                    : vehicle.status === 'Maintenance' ? '#F59E0B'
                    : '#6B7280';

                return (
                  <View key={vehicle.riderId} style={styles.tableRow}>
                    <Text style={[styles.cellText, { flex: 1.0, fontWeight: '700', color: '#003822' }]}>{vehicle.vehicleId}</Text>
                    <Text style={[styles.cellText, { flex: 1.0 }]}>{vehicle.plateNumber}</Text>
                    <Text style={[styles.cellText, { flex: 1.0 }]}>{vehicle.vehicleType}</Text>
                    <View style={{ flex: 1.4 }}>
                      <Text style={[styles.cellText, { fontWeight: '700' }]}>{vehicle.riderName}</Text>
                      <Text style={styles.cellMeta}>{vehicle.phoneNumber}</Text>
                    </View>

                    <View style={{ flex: 1.0 }}>
                      <View style={[styles.statusPill, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}33` }]}>
                        <Text style={[styles.statusPillText, { color: statusColor }]}>{vehicle.status}</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1.3 }}>
                      {vehicle.currentShipment ? (
                        <>
                          <Text style={[styles.cellText, { fontWeight: '700' }]}>{vehicle.currentShipment.trackingId || vehicle.currentShipment.id}</Text>
                          <Text style={styles.cellMeta}>{stageLabel(vehicle.currentShipment.stage)}</Text>
                        </>
                      ) : (
                        <Text style={styles.cellText}>No active job</Text>
                      )}
                    </View>

                    <Text style={[styles.cellText, { flex: 1.1 }]}>{vehicle.terminalCode}</Text>
                    <Text style={[styles.cellText, { flex: 1.2 }]}>{vehicle.deliveriesToday}</Text>
                    <Text style={[styles.cellText, { flex: 1.3 }]}>{formatDate(vehicle.lastSeen)}</Text>

                    <View style={styles.actionCell}>
                      <Pressable style={styles.actionBtnGray} onPress={() => openVehicle(vehicle)}>
                        <Text style={styles.actionBtnTextGray}>Details</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnLime} onPress={() => handleToggleMaintenance(vehicle)} disabled={busyId === vehicle.riderId}>
                        <Text style={styles.actionBtnTextDark}>
                          {busyId === vehicle.riderId
                            ? 'Working...'
                            : vehicle.status === 'Maintenance'
                              ? 'Resume'
                              : 'Maintenance'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {!filteredVehicles.length && (
                <View style={styles.centerState}>
                  <Text style={styles.emptyText}>No fleet rows matched your search.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={!!selectedVehicle} transparent animationType="fade" onRequestClose={() => setSelectedVehicle(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Fleet Vehicle</Text>
                <Text style={styles.modalSub}>{selectedVehicle?.vehicleId || selectedVehicle?.riderId}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={() => setSelectedVehicle(null)}>
                <X size={18} color="#111827" />
              </Pressable>
            </View>

            {selectedVehicle ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailsGrid}>
                  {[
                    ['Rider', selectedVehicle.riderName],
                    ['Phone', selectedVehicle.phoneNumber],
                    ['Vehicle Type', selectedVehicle.vehicleType],
                    ['Plate', selectedVehicle.plateNumber],
                    ['Status', selectedVehicle.status],
                    ['Terminal', selectedVehicle.terminalCode],
                    ['Current Location', selectedVehicle.currentLocation],
                    ['Mileage', String(selectedVehicle.mileage)],
                    ['Last Service', String(selectedVehicle.lastService)],
                    ['Last Seen', formatDate(selectedVehicle.lastSeen)],
                    ['Deliveries Today', String(selectedVehicle.deliveriesToday)],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={styles.detailCard}>
                      <Text style={styles.detailLabel}>{String(label)}</Text>
                      <Text style={styles.detailValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Current Assignment</Text>
                {selectedVehicle.currentShipment ? (
                  <View style={styles.assignmentCard}>
                    <Text style={styles.assignmentTitle}>{selectedVehicle.currentShipment.trackingId || selectedVehicle.currentShipment.id}</Text>
                    <Text style={styles.assignmentMeta}>{selectedVehicle.currentShipment.route}</Text>
                    <Text style={[styles.assignmentStage, { color: stageColor(selectedVehicle.currentShipment.stage) }]}>
                      {stageLabel(selectedVehicle.currentShipment.stage)} • {shipmentStatusFromStage(selectedVehicle.currentShipment.stage, 'last_mile_local')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>This rider has no active shipment assigned right now.</Text>
                )}

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.actionBtnLimeLarge}
                    onPress={() => handleToggleMaintenance(selectedVehicle)}
                    disabled={busyId === selectedVehicle.riderId}
                  >
                    <Text style={styles.actionBtnTextDark}>
                      {busyId === selectedVehicle.riderId
                        ? 'Working...'
                        : selectedVehicle.status === 'Maintenance'
                          ? 'Return To Service'
                          : 'Move To Maintenance'}
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
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  pageSub: {
    fontSize: 15,
    color: '#4b5563',
    maxWidth: 760,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.lime,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  refreshBtnText: {
    color: BRAND.green,
    fontWeight: '700',
    fontSize: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statLabel: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  statValue: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '800',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    marginBottom: 18,
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
    minHeight: 520,
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
    fontSize: 12,
    color: '#4B5568',
    textTransform: 'uppercase',
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
  actionBtnLime: {
    backgroundColor: BRAND.lime,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnTextDark: {
    color: BRAND.green,
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
    maxWidth: 860,
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
  actionBtnLimeLarge: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.lime,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
});
