/** Translations left today (premium: unlimited); the counter resets each day. */
export function remainingTranslations(day: string, used: number, today: string, isPremium: boolean, dailyLimit: number): number {
  if (isPremium) return Infinity;
  return Math.max(0, dailyLimit - (day === today ? used : 0));
}
