import React, { useState } from 'react';
import { View, Text } from 'react-native';
import AdminAuthScreen from '../components/admin/AdminAuthScreen';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../components/admin/AdminDashboard';
import TrackShipments from '../components/admin/TrackShipments';
import FleetManagement from '../components/admin/FleetManagement';
import RidersDrivers from '../components/admin/RidersDrivers';
import Customers from '../components/admin/Customers';
import AnalyticsReports from '../components/admin/AnalyticsReports';
import EarningsFinance from '../components/admin/EarningsFinance';
import Settings from '../components/admin/Settings';
import Shipments from '../components/admin/Shipments';
import Terminals from '../components/admin/Terminals';
import { BRAND } from '../constants/Theme';

export default function AdminScreen() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentMenu, setCurrentMenu] = useState('dashboard');

  if (!isAdminAuthenticated) {
    return (
      <AdminAuthScreen 
        onAuthenticated={() => setIsAdminAuthenticated(true)} 
      />
    );
  }

  // Render the selected admin page inside the layout
  const renderContent = () => {
    switch (currentMenu) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'track_shipments':
        return <TrackShipments />;
      case 'terminals':
        return <Terminals />;
      case 'fleet':
        return <FleetManagement />;
      case 'riders':
        return <RidersDrivers />;
      case 'customers':
        return <Customers />;
      case 'analytics':
        return <AnalyticsReports />;
      case 'earnings':
        return <EarningsFinance />;
      case 'settings':
        return <Settings />;
      case 'shipments':
        return <Shipments />;
      default:
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: BRAND.text, fontWeight: '600' }}>
              {currentMenu.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={{ fontSize: 16, color: BRAND.subtext, marginTop: 10 }}>
              Module in development
            </Text>
          </View>
        );
    }
  };

  return (
    <AdminLayout 
      currentMenu={currentMenu} 
      onMenuChange={(menu) => setCurrentMenu(menu)}
      onLogout={() => setIsAdminAuthenticated(false)}
    >
      {renderContent()}
    </AdminLayout>
  );
}
