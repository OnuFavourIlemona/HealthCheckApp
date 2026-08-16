import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PatternBackground } from '../../components/ui/PatternBackground';
import { Tappable } from '../../components/ui/Tappable';
import { setDemoScenario } from '../../lib/devSimulation';
import { colors, fonts } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectRole'>;

export function SelectRoleScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <PatternBackground height={580} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Image
        source={require('../../../assets/images/dashboard/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Select Role</Text>
      <Text style={styles.subtitle}>Pick a role so that we'll tailor the dashboard specifically to you.</Text>

      <View style={styles.roleRow}>
        <Tappable
          scaleDown={false}
          style={[styles.roleCard, { backgroundColor: colors.roleMedicalPractitioner }]}
          onPress={() => navigation.navigate('SignupMedicalPractitioner')}
        >
          <Text
            style={[styles.roleLabel, styles.medicalPractitionerLabel]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            Medical Practitioner
          </Text>
        </Tappable>
        <Image
          source={require('../../../assets/images/roles/doctor.png')}
          style={styles.doctorImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.roleRow}>
        <Tappable
          scaleDown={false}
          style={[styles.roleCard, styles.pharmacyCard, { backgroundColor: colors.rolePharmacy }]}
          onPress={() => navigation.navigate('SignupPharmacy')}
        >
          <Text style={[styles.roleLabel, styles.pharmacyLabel]}>Pharmacy</Text>
        </Tappable>
        <Image
          source={require('../../../assets/images/roles/pharmacy.png')}
          style={styles.pharmacyImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.roleRow}>
        <Tappable
          scaleDown={false}
          style={[styles.roleCard, { backgroundColor: colors.rolePatient }]}
          onPress={() => navigation.navigate('SignupPatient')}
        >
          <Text style={styles.roleLabel}>Patient</Text>
        </Tappable>
        <Image
          source={require('../../../assets/images/roles/patient.png')}
          style={styles.patientImage}
          resizeMode="contain"
        />
      </View>

      <Pressable style={styles.loginRow} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.loginText}>
          Already have an account? <Text style={styles.loginLink}>Log In</Text>
        </Text>
      </Pressable>

      {__DEV__ ? (
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Preview without an account:</Text>
          <View style={styles.previewLinks}>
            <Pressable
              onPress={() => {
                setDemoScenario(null);
                navigation.navigate('MainTabs');
              }}
            >
              <Text style={styles.previewLink}>Patient</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('ProTabs')}>
              <Text style={styles.previewLink}>Professional</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('PharmacyTabs')}>
              <Text style={styles.previewLink}>Pharmacy</Text>
            </Pressable>
          </View>
          <Text style={[styles.previewLabel, styles.previewLabelSpacing]}>
            Simulate risk scenario:
          </Text>
          <View style={styles.previewLinks}>
            <Pressable
              onPress={() => {
                setDemoScenario('low');
                navigation.navigate('MainTabs');
              }}
            >
              <Text style={styles.previewLink}>Low Risk</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setDemoScenario('high');
                navigation.navigate('MainTabs');
              }}
            >
              <Text style={[styles.previewLink, styles.previewLinkDanger]}>High Risk</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// Real dimensions from the Figma inspector: the pill shape itself is 345 x 64
// with corner radius 999 (fully rounded) — the taller numbers seen earlier
// (97, 103) were the outer group bounding box including the overhanging photo.
const CARD_HEIGHT = 64;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  // Real dimensions from Figma inspector: 208 x 48, sitting 56pt below the
  // designed status-bar row (which SafeAreaView's top inset already covers).
  logo: {
    width: 208,
    height: 48,
    alignSelf: 'center',
    marginTop: 56,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: 28,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 21,
  },
  roleRow: {
    marginTop: 40,
  },
  roleCard: {
    height: CARD_HEIGHT,
    borderRadius: CARD_HEIGHT / 2,
    justifyContent: 'center',
    // Figma: text side has 40pt inner padding.
    paddingLeft: 40,
  },
  // Pharmacy's photo sits on the LEFT, so its label is pushed to the right via
  // textAlign (not justifyContent, which would drop the text to the pill's
  // bottom and misalign it vertically against the other two roles). 40pt from
  // the right edge to match the design.
  pharmacyCard: {
    paddingRight: 40,
    paddingLeft: 0,
  },
  roleLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 24,
    color: colors.white,
  },
  pharmacyLabel: {
    textAlign: 'right',
  },
  // "Medical Practitioner" is long enough to run into the doctor photo, so cap
  // its width to the design's 208pt text box; it shrinks (via
  // adjustsFontSizeToFit) only if the app font renders wider than that.
  medicalPractitionerLabel: {
    maxWidth: 210,
  },
  // Figma inspector: 70 x 103, overhanging ~39pt above the 64pt pill and flush
  // at the bottom, sitting 21pt in from the pill's right edge.
  doctorImage: {
    position: 'absolute',
    right: 21,
    top: -39,
    width: 70,
    height: 103,
    pointerEvents: 'none',
  },
  // Figma inspector: 210 x 102, overhanging ~19pt above/below the pill and
  // extending 20pt past the card's left edge.
  pharmacyImage: {
    position: 'absolute',
    left: -20,
    top: -19,
    width: 210,
    height: 102,
    pointerEvents: 'none',
  },
  // Figma inspector: 60 x 97, overhanging ~33pt above the pill and flush at the
  // bottom, sitting 26pt in from the card's right edge.
  patientImage: {
    position: 'absolute',
    right: 26,
    top: -33,
    width: 60,
    height: 97,
    pointerEvents: 'none',
  },
  loginRow: {
    alignItems: 'center',
    marginTop: 32,
  },
  loginText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLink: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primaryGreen,
  },
  // Dev-only preview shortcuts (__DEV__): stripped from production builds.
  previewRow: {
    alignItems: 'center',
    marginTop: 18,
  },
  previewLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
  },
  previewLinks: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 8,
  },
  previewLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.primaryGreen,
    textDecorationLine: 'underline',
  },
  previewLabelSpacing: {
    marginTop: 14,
  },
  previewLinkDanger: {
    color: colors.danger,
  },
});
