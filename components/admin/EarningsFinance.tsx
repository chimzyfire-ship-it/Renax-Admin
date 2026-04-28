import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { BRAND } from '../../constants/Theme';
import { Calendar, Download, ArrowUp } from 'lucide-react-native';

const TRANSACTIONS = [
  { id: '#TRX-94821', date: '2024-11-05', desc: 'Delivery Fee - Order #A392', entity: 'Rider: CHI-04 (Adekunle)', amt: '15,000', status: 'Completed' },
  { id: '#TRX-94820', date: '2024-11-05', desc: 'Surge Charge - Peak Hours', entity: 'Customer: Grace E.', amt: '5,000', status: 'Pending' },
  { id: '#TRX-94819', date: '2024-11-04', desc: 'Refund - Cancelled Trip', entity: 'Rider: CHI-12 (Bola)', amt: '-8,000', status: 'Refunded' },
  { id: '#TRX-94818', date: '2024-11-04', desc: 'Delivery Fee - Order #A391', entity: 'Rider: LAG-09 (Tunde)', amt: '12,500', status: 'Completed' },
  { id: '#TRX-94817', date: '2024-11-03', desc: 'Wallet Top-up', entity: 'Customer: Michael O.', amt: '20,000', status: 'Completed' },
  { id: '#TRX-94816', date: '2024-11-03', desc: 'Commission Payout', entity: 'Rider: PHC-02 (Emeka)', amt: '45,000', status: 'Pending' },
];

export default function EarningsFinance() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
         <Text style={styles.pageTitle}>Earnings & Finance</Text>
         <View style={{flexDirection: 'row', gap: 16}}>
             <TouchableOpacity style={styles.dropdownBtn}>
                <Calendar size={16} color="#1a1a1a" />
                <Text style={styles.dropdownText}>Last 30 Days</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.addBtn}>
                <Download size={18} color={BRAND.green} />
                <Text style={styles.addBtnText}>Export Statement</Text>
             </TouchableOpacity>
         </View>
      </View>

      {/* KPI Stats Row */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={styles.statValue}>₦48.2M</Text>
            <View style={styles.trendRow}>
               <ArrowUp size={16} color={BRAND.green} />
               <Text style={styles.trendGreen}>14%</Text>
            </View>
        </View>
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Revenue Today</Text>
            <Text style={styles.statValue}>₦1,850,000</Text>
        </View>
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Pending Payouts</Text>
            <Text style={styles.statValue}>₦2,340,000</Text>
        </View>
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Avg. Earnings per Rider</Text>
            <Text style={styles.statValue}>₦124,500</Text>
        </View>
      </View>

      {/* Middle Row Layout (Graphs) */}
      <View style={styles.middleRow}>
          {/* Main Trend Line Graph Mock */}
          <View style={[styles.graphCard, glass, {flex: 2}]}>
             <View style={styles.graphHeader}>
                 <Text style={styles.graphTitle}>Revenue Trend (Last 30 Days)</Text>
             </View>
             <View style={styles.lineGraphMock}>
                {/* Visual placeholder representing the lines */}
                <View style={styles.graphLineGreen} />
                <View style={styles.yAxis}>
                    <Text style={styles.axisText}>100%</Text>
                    <Text style={styles.axisText}>80%</Text>
                    <Text style={styles.axisText}>40%</Text>
                    <Text style={styles.axisText}>10%</Text>
                    <Text style={styles.axisText}>%</Text>
                </View>
                <View style={styles.xAxis}>
                    <Text style={styles.axisText}>Day 5</Text>
                    <Text style={styles.axisText}>Day 10</Text>
                    <Text style={styles.axisText}>Day 15</Text>
                    <Text style={styles.axisText}>Day 20</Text>
                    <Text style={styles.axisText}>Day 25</Text>
                    <Text style={styles.axisText}>Day 30</Text>
                </View>
             </View>
          </View>

          {/* Pie Chart Mock */}
          <View style={[styles.graphCard, glass, {flex: 1, minWidth: 300, justifyContent: 'center'}]}>
             <Text style={[styles.graphTitle, {marginBottom: 30}]}>Earnings Breakdown</Text>
             <View style={styles.pieChartContainer}>
                <View style={styles.pieGraphic}>
                    <View style={styles.pieSliceMain} />
                    <View style={styles.pieSliceSecondary} />
                    <View style={styles.pieSliceWarning} />
                </View>
                <View style={styles.pieLegendRow}>
                    <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: BRAND.green}]}/><Text style={styles.legendText}>Delivery Fees 68%</Text></View>
                    <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: '#3b82f6'}]}/><Text style={styles.legendText}>Surge Charges 18%</Text></View>
                    <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: '#f59e0b'}]}/><Text style={styles.legendText}>Other 14%</Text></View>
                </View>
             </View>
          </View>
      </View>

      {/* Transactions Table Area */}
      <View style={[styles.tableContainer, glass]}>
         <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{minWidth: 1000}}>
               <Text style={[styles.graphTitle, {marginBottom: 16}]}>Recent Transactions</Text>
               <View style={styles.tableHeader}>
                   <Text style={[styles.colHeader, {flex: 1}]}>Transaction ID</Text>
                   <Text style={[styles.colHeader, {flex: 1}]}>Date</Text>
                   <Text style={[styles.colHeader, {flex: 2}]}>Description</Text>
                   <Text style={[styles.colHeader, {flex: 2}]}>Rider/Customer</Text>
                   <Text style={[styles.colHeader, {flex: 1, textAlign: 'right'}]}>Amount (₦)</Text>
                   <Text style={[styles.colHeader, {flex: 1.5, textAlign: 'center'}]}>Status</Text>
                   <Text style={[styles.colHeader, {flex: 1, textAlign: 'center'}]}>Action</Text>
               </View>
               {TRANSACTIONS.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                     <Text style={[styles.cellText, {flex: 1, fontWeight: '700'}]}>{item.id}</Text>
                     <Text style={[styles.cellText, {flex: 1}]}>{item.date}</Text>
                     <Text style={[styles.cellText, {flex: 2}]}>{item.desc}</Text>
                     <Text style={[styles.cellText, {flex: 2}]}>{item.entity}</Text>
                     <Text style={[styles.cellText, {flex: 1, textAlign: 'right', fontWeight: '600'}]}>{item.amt}</Text>
                     
                     <View style={{flex: 1.5, alignItems: 'center'}}>
                        <View style={[
                           styles.statusPill,
                           item.status === 'Completed' && { backgroundColor: BRAND.green },
                           item.status === 'Pending' && { backgroundColor: '#f59e0b' },
                           item.status === 'Refunded' && { backgroundColor: BRAND.danger },
                        ]}>
                           <Text style={styles.statusPillText}>{item.status}</Text>
                        </View>
                     </View>

                     <View style={{flex: 1, alignItems: 'center'}}>
                        <TouchableOpacity style={styles.actionBtn}>
                           <Text style={styles.actionBtnTextWhite}>View</Text>
                        </TouchableOpacity>
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
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  dropdownText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 14,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.lime,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    minWidth: 180,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statLabel: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  statValue: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '800',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendGreen: {
    color: BRAND.green,
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 4,
  },
  middleRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  graphCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  graphTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  lineGraphMock: {
    height: 250,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    marginLeft: 30,
    marginBottom: 20,
  },
  yAxis: {
    position: 'absolute',
    left: -40,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  xAxis: {
    position: 'absolute',
    bottom: -25,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  graphLineGreen: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    height: 2,
    backgroundColor: BRAND.green,
    transform: [{ rotate: '-10deg' }],
  },
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieGraphic: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: BRAND.green,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
  },
  pieSliceSecondary: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 70,
    height: 70,
    backgroundColor: '#3b82f6',
  },
  pieSliceWarning: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 80,
    height: 60,
    backgroundColor: '#f59e0b',
  },
  pieLegendRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  tableContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    elevation: 2,
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 12,
    marginBottom: 8,
  },
  colHeader: {
    fontWeight: '700',
    fontSize: 13,
    color: '#1a1a1a',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  cellText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  statusPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: BRAND.green,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  actionBtnTextWhite: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  }
});
