import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts } from '../../theme';

type Props = {
  label: string;
  helperText?: string;
} & TextInputProps;

export function FormField({ label, helperText, style, secureTextEntry, ...inputProps }: Props) {
  const [revealed, setRevealed] = useState(false);
  const isPasswordField = secureTextEntry !== undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isPasswordField && styles.inputWithIcon, style]}
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry={isPasswordField ? secureTextEntry && !revealed : secureTextEntry}
          {...inputProps}
        />
        {isPasswordField ? (
          <Pressable
            style={styles.eyeButton}
            onPress={() => setRevealed((prev) => !prev)}
            hitSlop={8}
          >
            <Ionicons
              name={revealed ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {helperText ? (
        <View style={styles.helperRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.helperOrange} />
          <Text style={styles.helperText}>{helperText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  // Real values from Figma inspector: label is Poppins Medium 14 (140% line
  // height); the input box uses 16/12 padding and an 8pt corner radius.
  label: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    gap: 6,
  },
  helperText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.helperOrange,
    lineHeight: 17,
  },
});
