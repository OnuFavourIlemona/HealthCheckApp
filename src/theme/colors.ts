// Authoritative brand colors as specified directly by the founder — these
// override whatever a raw Figma node export shows. Do not change these
// without an explicit instruction to do so.
export const colors = {
  background: '#FFFFFF',
  white: '#FFFFFF',

  primaryGreen: '#16C23A',
  secondaryGreen: '#27AE36',
  darkAccentGreen: '#0E8F2F',

  cardDark: '#0E8F2F',
  cardDarkMutedText: '#CCE5D9',

  textPrimary: '#111111',
  textSecondary: '#737373',
  textMuted: '#8C8C8C',

  amber: '#D98C26',
  danger: '#D64545',

  border: '#EBEBEB',
  avatarBorder: '#E6E6E6',

  pillGreenBg: '#E5F5E8',
  quickActionBg: '#E6F5E8',
  moonBg: '#E6E8FA',

  tabActive: '#16C23A',
  tabInactive: '#8C8C8C',

  cardShadow: 'rgba(0,0,0,0.06)',
  cardShadowSoft: 'rgba(0,0,0,0.05)',

  // Onboarding / auth flow (sampled from the Figma "Health Check.zip" export)
  helperOrange: '#FFC38D',
  roleMedicalPractitioner: '#11977C',
  rolePharmacy: '#119797',
  rolePatient: '#115097',
  inputBg: '#FFFFFF',
  inputPlaceholder: '#A6A6A6',
} as const;

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'LOW':
      return colors.primaryGreen;
    case 'MODERATE':
      return colors.amber;
    case 'HIGH':
      return colors.danger;
  }
}
