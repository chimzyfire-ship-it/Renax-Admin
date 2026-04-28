// CreateShipmentTab.tsx — 3-step wizard matching reference design
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { ChevronDown, MapPin, Phone, RotateCcw, Printer, X, Bike, Truck, Package } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const STEPS = ['Sender', 'Recipient', 'Package & Service'];
const NIGERIAN_STATES = ['Lagos','Abuja','Rivers','Kano','Oyo','Anambra','Enugu','Delta','Kaduna','Ibadan'];
const SERVICES = [
  { id: 'bike',  label: 'Express Bike Delivery',  icon: Bike,  sub: 'Service Level • Fast speed' },
  { id: 'van',   label: 'Standard Van Freight',    icon: Truck, sub: 'Service Level • Standard speed' },
  { id: 'cargo', label: 'Priority Cargo Haulage',  icon: Package, sub: 'Service Level • Heavy loads' },
];

export default function CreateShipmentTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 1024;

  const [step, setStep] = useState(2); // 0-based, show step 3 (index 2) by default = what design shows
  const [senderState, setSenderState] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [pickupAddr, setPickupAddr] = useState('');
  const [pickupLandmark, setPickupLandmark] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryAddr, setDeliveryAddr] = useState('');
  const [weight, setWeight] = useState('');
  const [dims, setDims] = useState('');
  const [category, setCategory] = useState('Package Can...');
  const [serviceSelected, setServiceSelected] = useState('van');
  const [payMethod, setPayMethod] = useState('Drop');
  const [price] = useState('₦8,500');

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => setStep(i)} style={styles.stepDotWrap}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive, i === step && styles.stepDotCurrent]}>
              {i < step && <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Outfit_7' }}>✓</Text>}
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
          </Pressable>
          {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineDone]} />}
        </View>
      ))}
    </View>
  );

  const SelectBox = ({ value, placeholder }: { value: string; placeholder: string }) => (
    <View style={styles.select}>
      <Text style={[styles.selectText, !value && { color: '#aaa' }]}>{value || placeholder}</Text>
      <ChevronDown color="#666" size={16} />
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 100 }}>
      {/* Page header */}
      <Text style={styles.pageTitle}>Create New Shipment</Text>
      <View style={styles.stepRow}>
        <Text style={styles.stepCrumb}>Step {step + 1} of 3: {STEPS[step]}</Text>
        {renderStepIndicator()}
      </View>
      <Text style={styles.orderType}>Create New Shipment (Single Order)</Text>

      <View style={[styles.formGrid, isMobile && { flexDirection: 'column' }]}>
        {/* LEFT — sender */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>1. Sender Details</Text>
          <View style={styles.row}>
            <SelectBox value={senderState} placeholder="Sender Profile (Address Book Dropdown)" />
            <View style={[styles.inputWrap, { maxWidth: 180 }]}>
              <TextInput placeholder="Phone Number" placeholderTextColor="#aaa" style={styles.input} value={senderPhone} onChangeText={setSenderPhone} keyboardType="phone-pad" />
              <Phone color="#004d3d" size={16} />
            </View>
          </View>
          <Text style={styles.fieldNoteTitle}>Pickup Address (Autofill Predictive Input)</Text>
          <Text style={styles.fieldNote}>Courier needs landmark near your location.</Text>
          <View style={styles.inputWrap}>
            <TextInput placeholder="Address [PHT Harcourt Address]" placeholderTextColor="#aaa" style={[styles.input, { flex: 1 }]} value={pickupAddr} onChangeText={setPickupAddr} />
            <MapPin color="#004d3d" size={16} />
          </View>
          <Pressable style={styles.landmarkBtn}>
            <Text style={styles.landmarkBtnText}>+ ADD pickup LANDMARK (optional)</Text>
          </Pressable>
        </View>

        {/* RIGHT — recipient */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>2. Recipient Details</Text>
          <View style={styles.row}>
            <SelectBox value="" placeholder="Saved Recipients" />
            <TextInput placeholder="Full Name" placeholderTextColor="#aaa" style={[styles.input, { flex: 1 }]} value={recipientName} onChangeText={setRecipientName} />
            <TextInput placeholder="Phone Number" placeholderTextColor="#aaa" style={[styles.input, { flex: 1 }]} value={recipientPhone} onChangeText={setRecipientPhone} keyboardType="phone-pad" />
          </View>
          <Text style={styles.fieldNoteTitle}>Delivery Address (Autofill Input)</Text>
          <View style={styles.inputWrap}>
            <TextInput placeholder="Delivery Address | Specific address landmark needed..." placeholderTextColor="#aaa" style={[styles.input, { flex: 1 }]} value={deliveryAddr} onChangeText={setDeliveryAddr} />
            <MapPin color="#004d3d" size={16} />
          </View>
          <View style={styles.landmarkRequiredBox}>
            <Text style={styles.landmarkReqTitle}>ADD DELIVERY LANDMARK (Required)</Text>
            <Text style={styles.landmarkReqSub}>Example: near PH Refinery, specific address landmark needed for [Recipient Address]</Text>
          </View>
          <Pressable style={styles.viewMapBtn}>
            <Text style={styles.viewMapBtnText}>View Landmark on Map</Text>
          </Pressable>
        </View>
      </View>

      {/* Package & Service */}
      <View style={[styles.formGrid, isMobile && { flexDirection: 'column' }]}>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>3. Package & Service Details</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldNoteTitle}>Weight (kg)</Text>
              <TextInput placeholder="kg" placeholderTextColor="#aaa" style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldNoteTitle}>Dimensions (cm) - Optional</Text>
              <TextInput placeholder="Dimensions cm" placeholderTextColor="#aaa" style={styles.input} value={dims} onChangeText={setDims} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldNoteTitle}>Package Category</Text>
              <SelectBox value={category} placeholder="Package Can..." />
            </View>
          </View>
        </View>

        {/* Service Selector */}
        <View style={[styles.formCard, { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Service Selector</Text>
          <View style={styles.serviceRow}>
            {SERVICES.map(s => {
              const Icon = s.icon;
              const active = serviceSelected === s.id;
              return (
                <Pressable key={s.id} onPress={() => setServiceSelected(s.id)} style={[styles.serviceCard, active && styles.serviceCardActive]}>
                  <Icon color={active ? '#ccfd3a' : '#666'} size={28} />
                  <Text style={[styles.serviceLabel, active && { color: '#ccfd3a' }]}>{s.label}</Text>
                  <Text style={styles.serviceSub}>{s.sub}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.pmRow}>
            <Text style={styles.fieldNoteTitle}>Payment Method</Text>
            <SelectBox value={payMethod} placeholder="Select..." />
          </View>
        </View>
      </View>

      {/* Summary & CTA */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle}>Shipment Summary & Price</Text>
          <Text style={styles.summaryLine}>Distance: 614 km (Lagos to Port Harcourt)</Text>
          <Text style={styles.summaryLine}>Est. Arrival: 16:30 Tomorrow</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.summaryLine}>Service Level: Standard Van</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>Estimated Price:</Text>
          <Text style={styles.priceValue}>{price}</Text>
        </View>
        <Pressable style={styles.recalcBtn}>
          <RotateCcw color="#004d3d" size={16} />
          <Text style={styles.recalcText}>RECALCULATE PRICE</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.ctaRow}>
        <Pressable style={styles.createBtn}>
          <Printer color="#fff" size={18} />
          <Text style={styles.createBtnText}>CREATE SHIPMENT & PRINT LABEL</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn}>
          <X color="#666" size={16} />
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#111', marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  stepCrumb: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepDotWrap: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#004d3d' },
  stepDotCurrent: { backgroundColor: '#004d3d', borderWidth: 3, borderColor: '#ccfd3a' },
  stepLine: { width: 80, height: 2, backgroundColor: '#e0e0e0', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#004d3d' },
  stepLabel: { fontFamily: 'Outfit_4', fontSize: 12, color: '#999' },
  stepLabelActive: { fontFamily: 'Outfit_7', color: '#004d3d' },
  orderType: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#222', marginBottom: 20 },
  formGrid: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  formCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 16, color: '#111', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  select: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fafafa' },
  selectText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#333', flex: 1 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#fafafa' },
  input: { flex: 1, fontFamily: 'Outfit_4', fontSize: 14, color: '#333', paddingVertical: 8 },
  fieldNoteTitle: { fontFamily: 'Outfit_6', fontSize: 13, color: '#333', marginBottom: 2 },
  fieldNote: { fontFamily: 'Outfit_4', fontSize: 12, color: '#888', marginBottom: 8 },
  landmarkBtn: { borderWidth: 1, borderColor: '#ccfd3a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 8 },
  landmarkBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  landmarkRequiredBox: { backgroundColor: '#FEF9E7', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#F2C94C', marginTop: 8 },
  landmarkReqTitle: { fontFamily: 'Outfit_7', fontSize: 13, color: '#B45309', marginBottom: 4 },
  landmarkReqSub: { fontFamily: 'Outfit_4', fontSize: 12, color: '#92400E' },
  viewMapBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-end', marginTop: 8 },
  viewMapBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#444' },
  serviceRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  serviceCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa' },
  serviceCardActive: { borderColor: '#004d3d', backgroundColor: '#004d3d' },
  serviceLabel: { fontFamily: 'Outfit_7', fontSize: 13, color: '#333', textAlign: 'center' },
  serviceSub: { fontFamily: 'Outfit_4', fontSize: 11, color: '#999', textAlign: 'center' },
  pmRow: { gap: 8 },
  summaryBar: { backgroundColor: '#fff', borderRadius: 16, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  summaryTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 16, color: '#111', marginBottom: 6 },
  summaryLine: { fontFamily: 'Outfit_4', fontSize: 13, color: '#555' },
  priceBox: { alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#eee' },
  priceLabel: { fontFamily: 'Outfit_4', fontSize: 12, color: '#777', marginBottom: 4 },
  priceValue: { fontFamily: 'PlusJakartaSans_7', fontSize: 28, color: '#004d3d' },
  recalcBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ccfd3a', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10 },
  recalcText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#002B22' },
  ctaRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  createBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#004d3d', borderRadius: 12, paddingVertical: 18 },
  createBtnText: { fontFamily: 'Outfit_7', fontSize: 15, color: '#ccfd3a', letterSpacing: 0.5 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 18, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  cancelBtnText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#666' },
});
