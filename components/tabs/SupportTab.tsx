import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Phone, Mail, ChevronDown, ChevronUp, Search, Send } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const FAQS = [
  { q: 'How long does a standard delivery take?', a: 'Depending on the route and package size, standard deliveries within the same state take 24-48 hours. Interstate heavy freight takes 3-5 business days.' },
  { q: 'What happens if my package is lost or damaged?', a: 'All shipments via RENAX Logistics are fully insured. If your package is damaged, please log a ticket here immediately with photos of the damaged item to start a claim.' },
  { q: 'How do I add a landmark to my delivery?', a: 'On the "Track Shipment" page, click the "Add Landmark" button under Shipment Details. The courier will be instantly notified with the updated routing information.' },
  { q: 'Can I change my delivery address mid-transit?', a: 'Address changes are only permitted if the item is still at a distribution hub. Once the item is "Out for Delivery", you must contact the courier directly to arrange an alternate drop-off if possible.' },
];

export default function SupportTab() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 32, paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>{t('dash.support', 'Customer Support')}</Text>
          <Text style={styles.pageSub}>Get help with your shipments, tracking, and account.</Text>
        </View>
      </View>

      <View style={styles.mainGrid}>
        
        {/* Left Column: Contact Methods */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.leftCol}>
          <View style={styles.contactCard}>
            <View style={styles.contactIconWrap}>
              <MessageSquare color="#004d3d" size={24} />
            </View>
            <Text style={styles.contactTitle}>Live Chat</Text>
            <Text style={styles.contactSub}>Chat instantly with a support agent.</Text>
            <Pressable style={styles.btnSolid}>
              <Text style={styles.btnSolidText}>Start Chat</Text>
            </Pressable>
          </View>

          <View style={styles.contactCard}>
            <View style={styles.contactIconWrap}>
              <Phone color="#004d3d" size={24} />
            </View>
            <Text style={styles.contactTitle}>Call Us</Text>
            <Text style={styles.contactSub}>Mon-Fri from 8am to 6pm WAT.</Text>
            <Pressable style={styles.btnOutline}>
              <Text style={styles.btnOutlineText}>+234 800 RENAX</Text>
            </Pressable>
          </View>
          
          <View style={styles.contactCard}>
            <View style={styles.contactIconWrap}>
              <Mail color="#004d3d" size={24} />
            </View>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactSub}>We usually reply within 24 hours.</Text>
            <Pressable style={styles.btnOutline}>
              <Text style={styles.btnOutlineText}>support@renax.com</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Right Column: FAQ & Search */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.rightCol}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
            
            <View style={styles.searchBar}>
              <Search color="#999" size={18} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="Search help articles..." 
                placeholderTextColor="#aaa"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.faqList}>
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <View key={i} style={[styles.faqItem, isOpen && styles.faqItemOpen]}>
                    <Pressable style={styles.faqHeader} onPress={() => setOpenFaq(isOpen ? null : i)}>
                      <Text style={[styles.faqQ, isOpen && { color: '#004d3d' }]}>{faq.q}</Text>
                      {isOpen ? <ChevronUp color="#004d3d" size={20} /> : <ChevronDown color="#999" size={20} />}
                    </Pressable>
                    {isOpen && (
                      <View style={styles.faqBody}>
                        <Text style={styles.faqA}>{faq.a}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Quick Support Ticket form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Submit a Ticket</Text>
            <View style={{ gap: 16 }}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Related Order ID (Optional)</Text>
                <TextInput style={styles.input} placeholder="e.g. RNX-1207" placeholderTextColor="#aaa" />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Describe the issue</Text>
                <TextInput 
                  style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                  placeholder="How can we help you today?" 
                  placeholderTextColor="#aaa" 
                  multiline={true} 
                />
              </View>
              <Pressable style={[styles.btnSolid, { alignSelf: 'flex-start', marginTop: 8 }]}>
                <Send color="#004d3d" size={16} style={{ marginRight: 8 }} />
                <Text style={styles.btnSolidText}>Submit Ticket</Text>
              </Pressable>
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
  leftCol: { flex: 1, minWidth: 260, maxWidth: 300, gap: 16 },
  rightCol: { flex: 2, minWidth: 320 },

  contactCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, alignItems: 'center', textAlign: 'center' },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(204,253,58,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  contactTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 18, color: '#111', marginBottom: 6 },
  contactSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  
  btnSolid: { flexDirection: 'row', backgroundColor: '#ccfd3a', width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnSolidText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },
  btnOutline: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#004d3d' },
  btnOutlineText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#004d3d' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, marginBottom: 24 },
  cardTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#111', marginBottom: 20 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 16, marginBottom: 24 },
  searchInput: { flex: 1, paddingVertical: 14, paddingLeft: 12, fontFamily: 'Outfit_4', fontSize: 15, color: '#111' },

  faqList: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  faqItemOpen: { backgroundColor: '#fdfdfd' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 },
  faqQ: { fontFamily: 'Outfit_6', fontSize: 15, color: '#333', flex: 1, paddingRight: 16 },
  faqBody: { paddingBottom: 20, paddingTop: 0 },
  faqA: { fontFamily: 'Outfit_4', fontSize: 14, color: '#666', lineHeight: 22 },

  inputWrap: { gap: 8 },
  inputLabel: { fontFamily: 'Outfit_6', fontSize: 13, color: '#555' },
  input: { backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Outfit_4', fontSize: 15, color: '#111' },
});
