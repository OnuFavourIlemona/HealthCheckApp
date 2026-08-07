import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type IconProps = {
  size?: number;
};

/**
 * Quick-action icons drawn as SVG so they stay crisp at any size and share one
 * green gradient identity. Each shape is chosen to be readable at a glance.
 */

const GRADIENT_FROM = '#16C23A';
const GRADIENT_TO = '#0E8F2F';

function Gradient({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={GRADIENT_FROM} />
        <Stop offset="1" stopColor={GRADIENT_TO} />
      </LinearGradient>
    </Defs>
  );
}

/** Hospital building with a medical cross. */
export function HospitalIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Gradient id="hosp" />
      {/* Roof */}
      <Path d="M24 4 44 16v3H4v-3L24 4Z" fill="url(#hosp)" />
      {/* Body */}
      <Rect x="8" y="19" width="32" height="25" rx="3" fill="url(#hosp)" opacity={0.9} />
      {/* Cross cut-out */}
      <Path
        d="M21.5 24h5v4.5H31v5h-4.5V38h-5v-4.5H17v-5h4.5V24Z"
        fill="#FFFFFF"
      />
      {/* Door */}
      <Rect x="20.5" y="40" width="7" height="4" rx="1" fill="#FFFFFF" opacity={0.55} />
    </Svg>
  );
}

/** Pharmacy capsule pill, split light/dark with a cross. */
export function PharmacyIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Gradient id="pharm" />
      <G rotation={-45} origin="24, 24">
        {/* Capsule body */}
        <Rect x="6" y="16" width="36" height="16" rx="8" fill="url(#pharm)" />
        {/* Lighter half */}
        <Path
          d="M14 16h10v16H14a8 8 0 0 1-8-8 8 8 0 0 1 8-8Z"
          fill="#FFFFFF"
          opacity={0.32}
        />
        {/* Divider */}
        <Rect x="23" y="16" width="2" height="16" fill="#FFFFFF" opacity={0.5} />
      </G>
      {/* Cross badge */}
      <Path
        d="M31 28h3.5v-3.5h4V28H42v4h-3.5v3.5h-4V32H31v-4Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/** Lab flask with liquid and bubbles. */
export function LabTestIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Gradient id="lab" />
      {/* Neck */}
      <Rect x="18" y="5" width="12" height="4" rx="2" fill="url(#lab)" />
      {/* Flask outline */}
      <Path
        d="M20 9h8v11.5l9.4 16.3A4 4 0 0 1 33.9 43H14.1a4 4 0 0 1-3.5-6.2L20 20.5V9Z"
        fill="url(#lab)"
        opacity={0.25}
      />
      {/* Liquid */}
      <Path
        d="M16.2 30h15.6l5.6 9.6A3 3 0 0 1 34.8 44H13.2a3 3 0 0 1-2.6-4.4L16.2 30Z"
        fill="url(#lab)"
      />
      {/* Glass edges */}
      <Path
        d="M20 9h8v11.5l9.4 16.3A4 4 0 0 1 33.9 43H14.1a4 4 0 0 1-3.5-6.2L20 20.5V9Z"
        stroke={GRADIENT_TO}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bubbles */}
      <Rect x="19" y="34" width="4" height="4" rx="2" fill="#FFFFFF" opacity={0.75} />
      <Rect x="26" y="37" width="3" height="3" rx="1.5" fill="#FFFFFF" opacity={0.6} />
    </Svg>
  );
}

/** Heart with a pulse line — health guidance. */
export function HealthTipsIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Gradient id="tips" />
      <Path
        d="M24 42S6 30.6 6 19.4A10.4 10.4 0 0 1 24 12a10.4 10.4 0 0 1 18 7.4C42 30.6 24 42 24 42Z"
        fill="url(#tips)"
      />
      {/* Pulse line */}
      <Path
        d="M11 24h7l3.5-7 5 13 3.5-6h7"
        stroke="#FFFFFF"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
