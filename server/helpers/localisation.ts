export const DEFAULT_LOCALE = "en_US";

export function extractLocale(
  localeStr: string,
  useFallback = true
): {
  language: string;
  country: string;
} {
  if (!useFallback && !localeStr) {
    return { language: null, country: null };
  }
  const locale = localeStr ?? DEFAULT_LOCALE;
  const [language, country] = locale.split(/[_-]/);
  return { language, country };
}
