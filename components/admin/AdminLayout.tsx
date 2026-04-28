import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, ScrollView, Image, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import {
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Settings,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Truck,
  List,
  MapPin,
  Car,
  Users,
  User,
  BarChart2,
  CircleDollarSign,
  LogOut,
} from 'lucide-react-native';
import { BRAND } from '../../constants/Theme';

const SIDEBAR_MENUS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'shipments', label: 'Shipments', icon: Truck },
  { key: 'track_shipments', label: 'Track Shipments', icon: MapPin },
  { key: 'terminals', label: 'Terminals', icon: List },
  { key: 'fleet', label: 'Fleet Management', icon: Car },
  { key: 'riders', label: 'Riders & Drivers', icon: Users },
  { key: 'customers', label: 'Customers', icon: User },
  { key: 'analytics', label: 'Analytics & Reports', icon: BarChart2 },
  { key: 'earnings', label: 'Earnings & Finance', icon: CircleDollarSign },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const TOP_NAV_MENUS = [
  { key: 'shipments', label: 'Shipments' },
  { key: 'fleet', label: 'Fleet Management' },
  { key: 'riders', label: 'Riders' },
  { key: 'earnings', label: 'Earnings' },
];

export default function AdminLayout({ children, currentMenu = 'dashboard', onMenuChange, onLogout }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 1024;
  const [isCollapsed, setIsCollapsed] = useState(false);

  const expandedWidth = 240; // slightly wider to fit new long texts comfortably
  const collapsedWidth = 84; // wide enough to center icons nicely
  const sidebarWidth = useSharedValue(expandedWidth);

  useEffect(() => {
    sidebarWidth.value = withTiming(isCollapsed ? collapsedWidth : expandedWidth, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [isCollapsed]);

  const animatedSidebarStyle = useAnimatedStyle(() => {
    return {
      width: sidebarWidth.value,
    };
  });

  const toggleBtnStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: sidebarWidth.value - 14 }], // 14 to perfectly center it on the boundary (-14 to push left)
    };
  });

  return (
    <View style={styles.container}>
      {/* Absolute Border Toggle Button */}
      {!isMobile && (
        <Animated.View style={[styles.toggleBtnWrapper, toggleBtnStyle]}>
          <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.toggleBtn} activeOpacity={0.8}>
            {isCollapsed ? <ChevronRight size={18} color={BRAND.green} /> : <ChevronLeft size={18} color={BRAND.green} />}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Sidebar - Hidden on mobile */}
      {!isMobile && (
        <Animated.View style={[styles.sidebar, animatedSidebarStyle]}>
          <View style={styles.sidebarInner}>
            <View style={styles.branding}>
               <Image source={require('../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="cover" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuContainer}>
              {SIDEBAR_MENUS.map((menu) => {
                const Icon = menu.icon;
                const isActive = currentMenu === menu.key;
                return (
                  <TouchableOpacity
                    key={menu.key}
                    style={[
                      styles.menuItem, 
                      isActive && styles.activeMenuItem,
                    ]}
                    onPress={() => onMenuChange && onMenuChange(menu.key)}
                  >
                    <View style={styles.iconBox}>
                       <Icon size={20} color={isActive ? BRAND.green : BRAND.white} />
                    </View>
                    {!isCollapsed && (
                      <>
                        <Text style={[styles.menuText, isActive && styles.activeMenuText]} numberOfLines={1}>
                          {menu.label}
                        </Text>
                        {menu.hasChevron && <ChevronDown size={16} color={isActive ? BRAND.green : BRAND.white} />}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            
            <View style={[styles.sidebarFooter]}>
               <TouchableOpacity style={styles.logoutBtn} onPress={() => onLogout && onLogout()}>
                 <View style={styles.iconBox}>
                   <LogOut size={20} color={'rgba(255,255,255,0.7)'} />
                 </View>
                 {!isCollapsed && <Text style={styles.logoutText}>Logout</Text>}
               </TouchableOpacity>
               <Text style={styles.versionText} numberOfLines={1}>
                 {isCollapsed ? 'v1.1' : 'RENAX Logistics | v1.1.0'}
               </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Main Content Area */}
      <View style={styles.mainArea}>
        {/* ABSOLUTE GLOBAL BACKGROUND - Adjusted to bring yellow to center */}
        <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
           <Image 
             source={require('../../assets/images/Tabs Background.png')} 
             style={{ position: 'absolute', width: '150%', height: '100%', left: '-25%' }}
             resizeMode="cover" 
           />
        </View>
        
        {/* Overlay to ensure readability if the background is too visually active */}
        <View style={StyleSheet.absoluteFillObject} backgroundColor="rgba(244, 247, 245, 0.4)" />

        {/* Top Navigation Bar */}
        <View style={styles.topNav}>
          <View style={styles.topNavLeft}>
            {/* The old top nav header icon is removed per request */}
            <View style={styles.topNavLinks}>
              {TOP_NAV_MENUS.map(nav => (
                <TouchableOpacity key={nav.key} style={styles.topNavLink}>
                  <Text style={styles.topNavLinkText}>{nav.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.topNavRight}>
            <TouchableOpacity style={styles.notificationBtn}>
              <Bell size={20} color={BRAND.text} />
              <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.profileBtn}>
               <View style={styles.avatarPlaceholder} />
               <ChevronDown size={16} color={BRAND.subtext} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Content */}
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: BRAND.bg,
  },
  sidebar: {
    backgroundColor: BRAND.green,
    overflow: 'hidden',
    zIndex: 10,
  },
  toggleBtnWrapper: {
    position: 'absolute',
    top: 24,
    left: 0,
    zIndex: 50,
  },
  toggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sidebarInner: {
    paddingTop: 0,
    justifyContent: 'space-between',
    width: 240, 
    flex: 1,
  },
  branding: {
    marginBottom: 20,
    height: 120, // Tall enough to cover the top box completely
    width: '100%', // Fills the width 
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00281a', // Fallback color
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  menuContainer: {
    paddingHorizontal: 16, 
    paddingBottom: 20, // scrolling safety
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 48,
  },
  activeMenuItem: {
    backgroundColor: BRAND.lime,
  },
  iconBox: {
    width: 32, // Gives the icon a fixed bounding box to keep it aligned when closed
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  activeMenuText: {
    color: BRAND.green,
    fontWeight: '800',
  },
  sidebarFooter: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  logoutText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  versionText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  mainArea: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative',
    marginLeft: 0,
  },
  topNav: {
    height: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40, // Increased padding to avoid toggle button overlap
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topNavLinks: {
    flexDirection: 'row',
    gap: 30,
  },
  topNavLink: {
    paddingVertical: 10,
  },
  topNavLinkText: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: '500',
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  notificationBtn: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: BRAND.danger,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: BRAND.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND.green,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 30,
  }
});
