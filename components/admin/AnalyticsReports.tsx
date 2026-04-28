import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { BRAND } from '../../constants/Theme';
import { ArrowUp, ArrowDown, Calendar, Download } from 'lucide-react-native';

const REPORTS = [
  { name: 'Monthly Performance Summary', period: 'October 2024', generated: '2024-10-31' },
  { name: 'Q3 Revenue Analysis', period: 'Jul - Sep 2024', generated: '2024-10-15' },
  { name: 'Delivery Efficiency Report', period: 'October 2024', generated: '2024-10-30' },
];

export default function AnalyticsReports() {
  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {};

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
         <Text style={styles.pageTitle}>Analytics & Reports</Text>
         <View style={{flexDirection: 'row', gap: 16}}>
             <TouchableOpacity style={styles.dropdownBtn}>
                <Calendar size={16} color="#1a1a1a" />
                <Text style={styles.dropdownText}>Last 30 Days</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.addBtn}>
                <Download size={18} color={BRAND.green} />
                <Text style={styles.addBtnText}>Export Report</Text>
             </TouchableOpacity>
         </View>
      </View>

      {/* KPI Stats Row */}
      <View style={styles.statsContainer}>
        {/* Card 1 */}
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Total Shipments</Text>
            <Text style={styles.statValue}>12,458</Text>
            <View style={styles.trendRow}>
               <ArrowUp size={16} color={BRAND.green} />
               <Text style={styles.trendGreen}>18%</Text>
            </View>
        </View>
        {/* Card 2 */}
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Total Revenue</Text>
            <Text style={styles.statValue}>₦48.2M</Text>
            <View style={styles.trendRow}>
               <ArrowUp size={16} color={BRAND.green} />
               <Text style={styles.trendGreen}>12%</Text>
            </View>
        </View>
        {/* Card 3 */}
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Avg. Delivery Time</Text>
            <Text style={styles.statValue}>2.4 hrs</Text>
            <View style={styles.trendRow}>
               <ArrowDown size={16} color={BRAND.danger} />
               <Text style={styles.trendRed}>-22%</Text>
            </View>
        </View>
        {/* Card 4 */}
        <View style={[styles.statCard, glass]}>
            <Text style={styles.statLabel}>Success Rate</Text>
            <Text style={styles.statValue}>96.8%</Text>
            <View style={styles.trendRow}>
               <ArrowUp size={16} color={BRAND.green} />
               <Text style={styles.trendGreen}>+2.1%</Text>
            </View>
        </View>
      </View>

      {/* Middle Row Layout (Graphs) */}
      <View style={styles.middleRow}>
          {/* Main Trend Line Graph Mock */}
          <View style={[styles.graphCard, glass, {flex: 2}]}>
             <View style={styles.graphHeader}>
                 <Text style={styles.graphTitle}>Shipments & Revenue Trend</Text>
                 <View style={styles.legendRow}>
                     <View style={[styles.legendDot, {backgroundColor: BRAND.green}]} />
                     <Text style={styles.legendText}>Shipments</Text>
                     <View style={[styles.legendDot, {backgroundColor: '#3b82f6', marginLeft: 16}]} />
                     <Text style={styles.legendText}>Revenue</Text>
                 </View>
             </View>
             <View style={styles.lineGraphMock}>
                {/* Visual placeholder representing the lines */}
                <View style={styles.graphLineGreen} />
                <View style={styles.graphLineBlue} />
                <View style={styles.yAxis}>
                    <Text style={styles.axisText}>100%</Text>
                    <Text style={styles.axisText}>80%</Text>
                    <Text style={styles.axisText}>60%</Text>
                    <Text style={styles.axisText}>40%</Text>
                    <Text style={styles.axisText}>20%</Text>
                    <Text style={styles.axisText}>%</Text>
                </View>
                <View style={styles.xAxis}>
                    <Text style={styles.axisText}>5-day</Text>
                    <Text style={styles.axisText}>10-day</Text>
                    <Text style={styles.axisText}>15-day</Text>
                    <Text style={styles.axisText}>20-day</Text>
                    <Text style={styles.axisText}>25-day</Text>
                    <Text style={styles.axisText}>30-day</Text>
                </View>
             </View>
          </View>

          {/* Side Panel: Pie Chart & Bar Chart */}
          <View style={{flex: 1, gap: 24, minWidth: 300}}>
              {/* Pie Chart Mock */}
              <View style={[styles.graphCard, glass]}>
                 <Text style={styles.graphTitle}>Delivery Status Breakdown</Text>
                 <View style={styles.pieChartContainer}>
                    <View style={styles.pieGraphic}>
                        <View style={styles.pieSliceMain} />
                        <View style={styles.pieSliceSecondary} />
                        <View style={styles.pieSliceDanger} />
                    </View>
                    <View style={styles.pieLegendStack}>
                        <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: BRAND.green}]}/><Text style={styles.legendText}>Delivered 82%</Text></View>
                        <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: '#3b82f6'}]}/><Text style={styles.legendText}>In Transit 15%</Text></View>
                        <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: BRAND.danger}]}/><Text style={styles.legendText}>Failed 3%</Text></View>
                    </View>
                 </View>
              </View>
              
              {/* Bar Chart Mock */}
              <View style={[styles.graphCard, glass]}>
                 <Text style={styles.graphTitle}>Top Performing Cities</Text>
                 <View style={styles.barChartWrapper}>
                     <View style={styles.barWrap}><Text style={styles.barVal}>3200</Text><View style={[styles.barObj, {height: 80}]} /><Text style={styles.barLabel}>Lagos</Text></View>
                     <View style={styles.barWrap}><Text style={styles.barVal}>2800</Text><View style={[styles.barObj, {height: 65}]} /><Text style={styles.barLabel}>Abuja</Text></View>
                     <View style={styles.barWrap}><Text style={styles.barVal}>2100</Text><View style={[styles.barObj, {height: 45}]} /><Text style={styles.barLabel}>Port Harcourt</Text></View>
                     <View style={styles.barWrap}><Text style={styles.barVal}>1800</Text><View style={[styles.barObj, {height: 35}]} /><Text style={styles.barLabel}>Kano</Text></View>
                     <View style={styles.barWrap}><Text style={styles.barVal}>1500</Text><View style={[styles.barObj, {height: 25}]} /><Text style={styles.barLabel}>Enugu</Text></View>
                 </View>
              </View>
          </View>
      </View>

      {/* Reports Table Area */}
      <View style={[styles.tableContainer, glass]}>
         <Text style={[styles.graphTitle, {marginBottom: 16}]}>Recent Reports</Text>
         <View style={styles.tableHeader}>
             <Text style={[styles.colHeader, {flex: 2}]}>Report Name</Text>
             <Text style={[styles.colHeader, {flex: 1}]}>Period</Text>
             <Text style={[styles.colHeader, {flex: 1}]}>Generated On</Text>
             <Text style={[styles.colHeader, {flex: 1, textAlign: 'center'}]}>Actions</Text>
         </View>
         {REPORTS.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
               <Text style={[styles.cellText, {flex: 2, fontWeight: '600'}]}>{item.name}</Text>
               <Text style={[styles.cellText, {flex: 1}]}>{item.period}</Text>
               <Text style={[styles.cellText, {flex: 1}]}>{item.generated}</Text>
               <View style={{flex: 1, alignItems: 'center'}}>
                  <TouchableOpacity style={styles.actionBtnGreen}>
                     <Text style={styles.actionBtnTextWhite}>Download</Text>
                  </TouchableOpacity>
               </View>
            </View>
         ))}
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
    padding: 20,
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
  trendRed: {
    color: BRAND.danger,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
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
    color: '#4B5568',
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
    bottom: 40,
    height: 2,
    backgroundColor: BRAND.green,
    transform: [{ rotate: '-15deg' }],
  },
  graphLineBlue: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    height: 2,
    backgroundColor: '#3b82f6',
    transform: [{ rotate: '-10deg' }],
  },
  pieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pieGraphic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: BRAND.green,
    position: 'relative',
    overflow: 'hidden',
  },
  pieSliceSecondary: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 50,
    height: 50,
    backgroundColor: '#3b82f6',
  },
  pieSliceDanger: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 50,
    height: 30,
    backgroundColor: BRAND.danger,
  },
  pieLegendStack: {
    gap: 12,
  },
  barChartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  barWrap: {
    alignItems: 'center',
    flex: 1,
  },
  barVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  barObj: {
    width: 30,
    backgroundColor: BRAND.green,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#4b5563',
    marginTop: 6,
  },
  tableContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    elevation: 2,
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
    color: '#4B5568',
  },
  actionBtnGreen: {
    backgroundColor: BRAND.green,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionBtnTextWhite: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  }
});
