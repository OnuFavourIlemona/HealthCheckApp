import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../../theme';

type Props = {
  day: string;
  month: string;
  year: string;
  onChangeDay: (v: string) => void;
  onChangeMonth: (v: string) => void;
  onChangeYear: (v: string) => void;
  ageHint?: string | null;
  editable?: boolean;
};

export function DateOfBirthField({
  day,
  month,
  year,
  onChangeDay,
  onChangeMonth,
  onChangeYear,
  ageHint,
  editable = true,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Date of birth</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.dayInput]}
          placeholder="DD"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="number-pad"
          maxLength={2}
          value={day}
          onChangeText={onChangeDay}
          editable={editable}
        />
        <TextInput
          style={[styles.input, styles.monthInput]}
          placeholder="MM"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="number-pad"
          maxLength={2}
          value={month}
          onChangeText={onChangeMonth}
          editable={editable}
        />
        <TextInput
          style={[styles.input, styles.yearInput]}
          placeholder="YYYY"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="number-pad"
          maxLength={4}
          value={year}
          onChangeText={onChangeYear}
          editable={editable}
        />
      </View>
      {ageHint ? <Text style={styles.hint}>{ageHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  dayInput: {
    flex: 1,
  },
  monthInput: {
    flex: 1,
  },
  yearInput: {
    flex: 1.4,
  },
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 6,
  },
});
