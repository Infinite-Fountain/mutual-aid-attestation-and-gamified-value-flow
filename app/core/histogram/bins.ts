export const HISTOGRAM_BINS = [
  { label: '0-60', min: 0, max: 60 },
  { label: '61-65', min: 61, max: 65 },
  { label: '66-70', min: 66, max: 70 },
  { label: '71-75', min: 71, max: 75 },
  { label: '76-80', min: 76, max: 80 },
  { label: '81-85', min: 81, max: 85 },
  { label: '86-90', min: 86, max: 90 },
  { label: '91-95', min: 91, max: 95 },
  { label: '96-100', min: 96, max: 100 },
] as const

export function scoreToBinLabel(score: number): string {
  const bin = HISTOGRAM_BINS.find((b) => score >= b.min && score <= b.max)
  return bin?.label ?? '0-60'
}
