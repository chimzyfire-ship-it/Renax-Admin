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
import { CheckCircle, Circle, MapPin, Search, Trash2, Truck, UserPlus, Users, X } from 'lucide-react-native';
import { supabase } from '../../supabase';
import {
  enrollFleetStaff,
  fetchFleetRows,
  removeFleetStaffFromOps,
  updateFleetVehicleStatus,
  updateStaffTerminalAssignment,
} from '../../utils/adminData';
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

const SERVICE_PROFILES = [
  { key: 'final_mile', label: 'Final-Mile Rider' },
  { key: 'first_mile', label: 'First-Mile Driver' },
  { key: 'dual', label: 'Dual Ops' },
];

const VEHICLE_TYPES = ['bike', 'van', 'mini_truck', 'truck', 'cold_chain_van'];

const emptyStaffForm = {
  userId: '',
  fullName: '',
  phoneNumber: '',
  role: 'rider',
  serviceProfile: 'final_mile' as 'final_mile' | 'first_mile' | 'dual',
  state: '',
  city: '',
  vehicleId: '',
  vehicleCode: '',
  vehicleType: 'bike',
  plateNumber: '',
  capacityKg: '',
  capacityVolumeCm3: '',
  maxParcelCount: '',
  goodsCapabilities: 'documents, fragile, general',
  assignedTerminalId: '',
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
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [staffFormError, setStaffFormError] = useState('');
  const [enrollTerminalSearch, setEnrollTerminalSearch] = useState('');

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

  const filteredEnrollTerminals = useMemo(() => {
    const query = enrollTerminalSearch.trim().toLowerCase();
    if (!query) return terminals;
    return terminals.filter((terminal) =>
      terminal.name?.toLowerCase().includes(query)
      || terminal.code?.toLowerCase().includes(query)
      || terminal.city?.toLowerCase().includes(query)
      || terminal.state?.toLowerCase().includes(query)
    );
  }, [enrollTerminalSearch, terminals]);

  const refreshSelectedRider = async (riderId: string) => {
    const next = (await fetchFleetRows()).find((row: any) => row.riderId === riderId);
    if (next) setSelectedRider(next);
  };

  const handleSetAvailability = async (rider: any, nextStatus: string) => {
    setBusyId(`${nextStatus}:${rider.riderId}`);
    try {
      await updateFleetVehicleStatus(rider.riderId, nextStatus);
      await loadRiders();
      if (selectedRider?.riderId === rider.riderId) {
        await refreshSelectedRider(rider.riderId);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspendToggle = async (rider: any) => {
    const nextStatus = rider.status === 'Offline' ? 'available' : 'offline';
    await handleSetAvailability(rider, nextStatus);
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

  const handleEnrollStaff = async () => {
    setStaffFormError('');
    setBusyId('enroll-staff');
    try {
      await enrollFleetStaff({
        ...staffForm,
        assignedTerminalId: staffForm.assignedTerminalId || null,
      });
      setStaffForm(emptyStaffForm);
      setEnrollTerminalSearch('');
      setShowEnrollModal(false);
      await loadRiders();
    } catch (error: any) {
      setStaffFormError(error?.message || 'Could not enroll staff member.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveFromOps = async (rider: any) => {
    setBusyId(`remove:${rider.riderId}`);
    try {
      await removeFleetStaffFromOps(rider.riderId);
      setSelectedRider(null);
      await loadRiders();
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
        <View style={styles.headerActions}>
          <Pressable style={styles.enrollBtn} onPress={() => setShowEnrollModal(true)}>
            <UserPlus size={16} color="#002B22" />
            <Text style={styles.enrollBtnText}>Enroll Staff</Text>
          </Pressable>
          <Pressable style={styles.refreshBtn} onPress={loadRiders}>
            <Text style={styles.refreshBtnText}>Refresh Riders</Text>
          </Pressable>
        </View>
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
                      <Pressable style={styles.actionBtnGray} onPress={() => handleSuspendToggle(rider)} disabled={!!busyId?.endsWith(`:${rider.riderId}`)}>
                        <Text style={styles.actionBtnTextGray}>
                          {busyId?.endsWith(`:${rider.riderId}`) ? 'Working...' : rider.status === 'Offline' ? 'Activate' : 'Suspend'}
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

      <Modal visible={showEnrollModal} transparent animationType="fade" onRequestClose={() => setShowEnrollModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.enrollModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Enroll Rider / Driver</Text>
                <Text style={styles.modalSub}>Attach an existing app user to operations and register their vehicle.</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={() => setShowEnrollModal(false)}>
                <X size={18} color="#111827" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {staffFormError ? <Text style={styles.formError}>{staffFormError}</Text> : null}

              <Text style={styles.sectionTitle}>Service Profile</Text>
              <View style={styles.chipRow}>
                {SERVICE_PROFILES.map((profile) => {
                  const active = staffForm.serviceProfile === profile.key;
                  return (
                    <Pressable
                      key={profile.key}
                      style={[styles.formChip, active && styles.formChipActive]}
                      onPress={() => setStaffForm((current) => ({
                        ...current,
                        serviceProfile: profile.key as any,
                        role: profile.key === 'final_mile' ? 'rider' : 'driver',
                        vehicleType: profile.key === 'final_mile' ? 'bike' : current.vehicleType === 'bike' ? 'van' : current.vehicleType,
                      }))}
                    >
                      <Text style={[styles.formChipText, active && styles.formChipTextActive]}>{profile.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formGrid}>
                {[
                  ['Existing User UUID', 'userId', '00000000-0000-0000-0000-000000000000'],
                  ['Full Name', 'fullName', 'Adewale Driver'],
                  ['Phone Number', 'phoneNumber', '+234...'],
                  ['State', 'state', 'Lagos'],
                  ['City', 'city', 'Ikeja'],
                  ['Vehicle Code', 'vehicleCode', 'LOS-VAN-01'],
                  ['Vehicle ID', 'vehicleId', 'LOS-VAN-01'],
                  ['Plate Number', 'plateNumber', 'ABC-123XY'],
                  ['Capacity KG', 'capacityKg', '250'],
                  ['Volume CM3', 'capacityVolumeCm3', '800000'],
                  ['Max Parcels', 'maxParcelCount', '8'],
                  ['Goods Capabilities', 'goodsCapabilities', 'documents, fragile, general'],
                ].map(([label, key, placeholder]) => (
                  <View key={key} style={styles.formField}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <TextInput
                      value={(staffForm as any)[key]}
                      onChangeText={(value) => setStaffForm((current) => ({ ...current, [key]: value }))}
                      style={styles.formInput}
                      placeholder={placeholder}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Vehicle Type</Text>
              <View style={styles.chipRow}>
                {VEHICLE_TYPES.map((type) => {
                  const active = staffForm.vehicleType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.formChip, active && styles.formChipActive]}
                      onPress={() => setStaffForm((current) => ({ ...current, vehicleType: type }))}
                    >
                      <Text style={[styles.formChipText, active && styles.formChipTextActive]}>{type.replace(/_/g, ' ')}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Home Terminal</Text>
              <View style={styles.searchBox}>
                <Search size={16} color="#6B7280" />
                <TextInput
                  value={enrollTerminalSearch}
                  onChangeText={setEnrollTerminalSearch}
                  style={styles.searchInput}
                  placeholder="Search terminal by code, city, or state..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.terminalAssignList}>
                {filteredEnrollTerminals.slice(0, 8).map((terminal) => {
                  const active = staffForm.assignedTerminalId === terminal.id;
                  return (
                    <View key={terminal.id} style={styles.terminalAssignCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.terminalAssignTitle}>{terminal.name}</Text>
                        <Text style={styles.terminalAssignMeta}>{terminal.code} • {terminal.city}, {terminal.state}</Text>
                      </View>
                      <Pressable
                        style={[styles.assignBtn, active && styles.assignBtnActive]}
                        onPress={() => setStaffForm((current) => ({
                          ...current,
                          assignedTerminalId: terminal.id,
                          state: current.state || terminal.state || '',
                          city: current.city || terminal.city || '',
                        }))}
                      >
                        <Text style={[styles.assignBtnText, active && styles.assignBtnTextActive]}>{active ? 'Selected' : 'Select'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.enrollSubmitBtn} onPress={handleEnrollStaff} disabled={busyId === 'enroll-staff'}>
                  <Text style={styles.enrollSubmitText}>{busyId === 'enroll-staff' ? 'Saving...' : 'Enroll Staff'}</Text>
                </Pressable>
                <Pressable style={styles.actionBtnGrayLarge} onPress={() => setShowEnrollModal(false)}>
                  <Text style={styles.actionBtnTextGray}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                  <Pressable
                    style={styles.actionBtnGrayLarge}
                    onPress={() => handleSetAvailability(selectedRider, 'available')}
                    disabled={busyId === `available:${selectedRider.riderId}`}
                  >
                    <Text style={styles.actionBtnTextGray}>
                      {busyId === `available:${selectedRider.riderId}` ? 'Saving...' : 'Set Available'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtnGrayLarge}
                    onPress={() => handleSetAvailability(selectedRider, 'offline')}
                    disabled={busyId === `offline:${selectedRider.riderId}`}
                  >
                    <Text style={styles.actionBtnTextGray}>
                      {busyId === `offline:${selectedRider.riderId}` ? 'Saving...' : 'Set Offline'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtnGrayLarge}
                    onPress={() => handleSetAvailability(selectedRider, 'maintenance')}
                    disabled={busyId === `maintenance:${selectedRider.riderId}`}
                  >
                    <Text style={styles.actionBtnTextGray}>
                      {busyId === `maintenance:${selectedRider.riderId}` ? 'Saving...' : 'Set Maintenance'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtnDangerLarge}
                    onPress={() => handleRemoveFromOps(selectedRider)}
                    disabled={busyId === `remove:${selectedRider.riderId}`}
                  >
                    <Trash2 size={15} color="#991B1B" />
                    <Text style={styles.actionBtnDangerText}>
                      {busyId === `remove:${selectedRider.riderId}` ? 'Removing...' : 'Remove From Ops'}
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
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.lime,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  enrollBtnText: { color: '#002B22', fontWeight: '800', fontSize: 14 },
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
  enrollModalCard: {
    width: '100%',
    maxWidth: 980,
    maxHeight: '90%',
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
  formError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    color: '#991B1B',
    fontWeight: '700',
    marginBottom: 16,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 18,
  },
  formField: {
    width: '48%',
    minWidth: 260,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 14,
    outlineStyle: 'none' as any,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  formChip: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  formChipActive: {
    backgroundColor: BRAND.lime,
    borderColor: BRAND.lime,
  },
  formChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'capitalize',
  },
  formChipTextActive: {
    color: '#002B22',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  actionBtnDangerLarge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnDangerText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  enrollSubmitBtn: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.green,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  enrollSubmitText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
