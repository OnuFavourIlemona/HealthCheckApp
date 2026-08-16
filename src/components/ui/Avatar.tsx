import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts } from '../../theme';

type Props = {
  email?: string | null;
  name?: string | null;
  /** An uploaded profile photo. Takes priority over Gravatar and initials. */
  avatarUrl?: string | null;
  size?: number;
  style?: ViewStyle;
  textColor?: string;
  backgroundColor?: string;
};

function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  // No name on file — fall back to the email's local part (before the @),
  // splitting on the separators people commonly use there, so this still
  // reads as initials rather than a fragment of the email itself.
  const localPart = email?.trim().split('@')[0];
  if (!localPart) return '?';
  return localPart
    .split(/[.\-_+]/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Shows the user's Gravatar photo when their email has one set up, falling
 * back to their initials otherwise (Gravatar returns a 404 for emails with
 * no photo when `d=404` is passed, which we use to detect the fallback case).
 */
export function Avatar({ email, name, avatarUrl, size = 40, style, textColor, backgroundColor }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhotoFailed(false);
    // An uploaded photo always wins over Gravatar.
    if (avatarUrl) {
      setPhotoUrl(avatarUrl);
      return;
    }
    if (!email) {
      setPhotoUrl(null);
      return;
    }
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, email.trim().toLowerCase()).then(
      (hash) => {
        if (!cancelled) {
          setPhotoUrl(`https://www.gravatar.com/avatar/${hash}?s=${size * 3}&d=404`);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [email, size, avatarUrl]);

  const initials = initialsOf(name, email);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor ?? colors.pillGreenBg,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38, color: textColor ?? colors.darkAccentGreen }]}>
        {initials}
      </Text>
      {photoUrl && !photoFailed ? (
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          onError={() => setPhotoFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: fonts.headingSemiBold,
  },
});
