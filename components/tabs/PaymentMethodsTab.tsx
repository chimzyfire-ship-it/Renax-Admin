// PaymentMethodsTab.tsx — Payment cards grid matching reference design
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { CreditCard, Banknote, Smartphone, Plus, Pencil, Trash2, Eye } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type PayMethod = {
  id: string;
  type: 'card' | 'bank' | 'momo';
  name: string;
  detail: string;
  sub: string;
  icon: string;
};

const INITIAL_METHODS: PayMethod[] = [
  { id: '1', type: 'card', name: 'Mastercard **** 9876', detail: 'Expiry: 12/26', sub: '', icon: '💳' },
  { id: '2', type: 'bank', name: 'Access Bank (₦)', detail: '**** 1234', sub: '', icon: '🏦' },
  { id: '3', type: 'momo', name: 'MTN MoMo', detail: '+234 801 ****', sub: '', icon: '📱' },
];

export default function PaymentMethodsTab() {
  const [methods, setMethods] = useState<PayMethod[]>(INITIAL_METHODS);
  const [showAdd, setShowAdd] = useState(false);

  const remove = (id: string) => setMethods(m => m.filter(x => x.id !== id));

  const CardUI = ({ method, index }: { method: PayMethod; index: number }) => {
    const isCard = method.type === 'card';
    const isBank = method.type === 'bank';
    const isMomo = method.type === 'momo';

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).duration(400)} style={[styles.payCard, isCard && styles.payCardGreen]}>
        {/* Background pattern */}
        <View style={[styles.cardBgCircle, styles.cardBgCircle1]} />
        <View style={[styles.cardBgCircle, styles.cardBgCircle2]} />

        {/* Top row */}
        <View style={styles.cardTop}>
          {isCard ? (
            <View>
              <Text style={styles.cardChip}>▬▬▬</Text>
              <Text style={styles.cardChipText}>💳</Text>
            </View>
          ) : isBank ? (
            <View style={styles.nairaIcon}><Text style={styles.nairaText}>₦</Text></View>
          ) : (
            <View style={styles.momoLogo}><Text style={styles.momoText}>M</Text><Text style={styles.momoText2}>MoMo</Text></View>
          )}
          <View style={{ alignItems: 'flex-end' }}>
            {isCard && <Text style={styles.mcLogo}>⬤⬤</Text>}
            {isBank && <Text style={styles.bankName}>access Bank</Text>}
            {isMomo && <Text style={styles.mtnText}>MTN MoMo</Text>}
          </View>
        </View>

        {/* Name & detail */}
        <View style={styles.cardBottom}>
          <Text style={[styles.cardName, !isCard && { color: '#222' }]}>{method.name}</Text>
          <Text style={[styles.cardDetail, !isCard && { color: '#555' }]}>{method.detail}</Text>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          {isBank ? (
            <Pressable style={styles.viewBtn}>
              <Eye color="#fff" size={14} />
              <Text style={styles.viewBtnText}>View Details</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.editBtn}>
                <Pencil color="#555" size={14} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.removeBtn} onPress={() => remove(method.id)}>
                <Trash2 color="#555" size={14} />
                <Text style={styles.removeBtnText}>Remove</Text>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 60 }}>
      <Text style={styles.pageTitle}>Payment Methods</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add & Manage Payment Methods</Text>

        <View style={styles.grid}>
          {methods.map((m, i) => (
            <CardUI key={m.id} method={m} index={i} />
          ))}

          {/* Add New */}
          <Pressable onPress={() => setShowAdd(true)} style={styles.addCard}>
            <Plus color="#ccfd3a" size={40} strokeWidth={1.5} />
            <Text style={styles.addCardText}>Add New Payment Method</Text>
          </Pressable>
        </View>

        <Text style={styles.footNote}>
          Manage your secure payment options and linked accounts. Securely powered by RENAX.
        </Text>
      </View>

      {/* Add Method Modal-like form */}
      {showAdd && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.addForm}>
          <Text style={styles.addFormTitle}>Add New Payment Method</Text>
          <View style={styles.methodTypeRow}>
            {[
              { id: 'card', label: '💳 Card', icon: CreditCard },
              { id: 'bank', label: '🏦 Bank Transfer', icon: Banknote },
              { id: 'momo', label: '📱 Mobile Money', icon: Smartphone },
            ].map(opt => (
              <Pressable key={opt.id} style={styles.methodTypeCard}>
                <Text style={styles.methodTypeLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.addFormActions}>
            <Pressable style={styles.saveBtn} onPress={() => {
              setMethods(m => [...m, { id: String(Date.now()), type: 'card', name: 'New Card **** 0000', detail: 'Expiry: 12/28', sub: '', icon: '💳' }]);
              setShowAdd(false);
            }}>
              <Text style={styles.saveBtnText}>Add Method</Text>
            </Pressable>
            <Pressable style={styles.cancelFormBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelFormBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#111', marginBottom: 24 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#111', marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 24 },
  payCard: {
    width: '47%',
    minHeight: 200,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    padding: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
  },
  payCardGreen: {
    backgroundColor: '#004d3d',
  },
  cardBgCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardBgCircle1: { width: 200, height: 200, bottom: -60, right: -60 },
  cardBgCircle2: { width: 120, height: 120, top: -40, left: 60 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardChip: { color: '#ccfd3a', fontSize: 16, marginBottom: 2 },
  cardChipText: { fontSize: 22 },
  nairaIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#ccfd3a', alignItems: 'center', justifyContent: 'center' },
  nairaText: { fontFamily: 'PlusJakartaSans_7', fontSize: 28, color: '#004d3d' },
  momoLogo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#004d3d', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  momoText: { fontFamily: 'Outfit_7', fontSize: 16, color: '#fff' },
  momoText2: { fontFamily: 'Outfit_7', fontSize: 14, color: '#ccfd3a' },
  mcLogo: { color: '#ccfd3a', fontSize: 28, letterSpacing: -8 },
  bankName: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },
  mtnText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#333', backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardBottom: { gap: 4, zIndex: 2 },
  cardName: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#fff' },
  cardDetail: { fontFamily: 'Outfit_4', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  cardActions: { flexDirection: 'row', gap: 10, zIndex: 2 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ccfd3a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  viewBtnText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#002B22' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ccfd3a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  editBtnText: { fontFamily: 'Outfit_7', fontSize: 13, color: '#002B22' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0e0e0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  removeBtnText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#555' },
  addCard: {
    width: '47%',
    minHeight: 200,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fafafa',
  },
  addCardText: { fontFamily: 'Outfit_6', fontSize: 15, color: '#555', textAlign: 'center' },
  footNote: { fontFamily: 'Outfit_4', fontSize: 13, color: '#888', marginTop: 8 },
  addForm: { backgroundColor: '#fff', borderRadius: 16, padding: 28, marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
  addFormTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 20 },
  methodTypeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  methodTypeCard: { flex: 1, borderWidth: 1.5, borderColor: '#004d3d', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  methodTypeLabel: { fontFamily: 'Outfit_6', fontSize: 14, color: '#004d3d' },
  addFormActions: { flexDirection: 'row', gap: 12 },
  saveBtn: { flex: 1, backgroundColor: '#004d3d', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#ccfd3a' },
  cancelFormBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelFormBtnText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#555' },
});
