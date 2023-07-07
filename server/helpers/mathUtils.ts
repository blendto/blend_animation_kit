export const reduceFraction = (
  numerator: number,
  denominator: number
): { numerator: number; denominator: number } => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(numerator, denominator);

  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;

  return { numerator: reducedNumerator, denominator: reducedDenominator };
};
