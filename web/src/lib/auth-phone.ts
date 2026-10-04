// Accept national digits and common pasted Moldova formats; never duplicate +373.
export function normalizeMoldovaPhone(value: string): string | null {
  if (/[^\d+\s().-]/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00373')) digits = digits.slice(5);
  else if (digits.length === 11 && digits.startsWith('373')) digits = digits.slice(3);
  else if (digits.length === 9 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[1-9]\d{7}$/.test(digits) ? `+373${digits}` : null;
}
