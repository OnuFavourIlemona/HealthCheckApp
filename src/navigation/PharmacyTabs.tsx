import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NotificationGate } from '../components/NotificationGate';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PharmacyBookingsScreen } from '../screens/pharmacy/PharmacyBookingsScreen';
import { PharmacyDashboardScreen } from '../screens/pharmacy/PharmacyDashboardScreen';
import { PharmacyStoreScreen } from '../screens/pharmacy/PharmacyStoreScreen';
import type { PharmacyTabsParamList } from './types';
import { AnimatedTabBar, type TabIconMap } from './AnimatedTabBar';

const Tab = createBottomTabNavigator<PharmacyTabsParamList>();

const tabIcons: TabIconMap = {
  Dashboard: { active: 'grid', inactive: 'grid-outline' },
  Bookings: { active: 'clipboard', inactive: 'clipboard-outline' },
  'My Store': { active: 'storefront', inactive: 'storefront-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function PharmacyTabs() {
  return (
    <>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AnimatedTabBar {...props} tabIcons={tabIcons} />}
      >
        <Tab.Screen name="Dashboard" component={PharmacyDashboardScreen} />
        <Tab.Screen name="Bookings" component={PharmacyBookingsScreen} />
        <Tab.Screen name="My Store" component={PharmacyStoreScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      <NotificationGate />
    </>
  );
}
