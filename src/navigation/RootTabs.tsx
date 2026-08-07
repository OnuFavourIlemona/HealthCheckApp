import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AssessScreen } from '../screens/AssessScreen';
import { FindCareScreen } from '../screens/FindCareScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AnimatedTabBar, type TabIconMap } from './AnimatedTabBar';

const Tab = createBottomTabNavigator();

const tabIcons: TabIconMap = {
  Home: { active: 'home', inactive: 'home-outline' },
  Assess: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
  Messages: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  'Find Care': { active: 'location', inactive: 'location-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} tabIcons={tabIcons} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Assess" component={AssessScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Find Care" component={FindCareScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
