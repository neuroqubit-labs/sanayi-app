/**
 * Phone number helpers — E.164 (canonical, backend storage) ↔ display format.
 *
 * Backend `app/schemas/user.py` E.164 bekler (`+905551112233`).
 * UI'da okunabilir format gösteririz (`+90 555 111 22 33`).
 *
 * Pilot scope: sadece Türkiye (+90). İleride ülke kodu seçimi eklendiğinde
 * bu modül `parsePhoneNumberFromString` (libphonenumber-js) ile değiştirilebilir.
 */

const TR_COUNTRY_CODE = "+90";
const E164_REGEX = /^\+?[1-9]\d{7,14}$/;

export function isE164(value: string): boolean {
  return E164_REGEX.test(value.trim());
}

/**
 * Kullanıcı girdisini canonical E.164'e çevirir:
 *   "0532 000 00 00" → "+905320000000"
 *   "+90 532 000 00 00" → "+905320000000"
 *   "5320000000" → "+905320000000"
 *
 * Parse edilemeyen girdi için `null` döner — caller validation mesajını gösterir.
 * Pilot için Türkiye varsayımı; "+" ile başlayan farklı ülke kodu gelirse olduğu gibi bırakır.
 */
export function normalizePhoneTR(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Zaten başka ülke kodlu E.164 girildi; sadece boşlukları sil.
  if (trimmed.startsWith("+") && !trimmed.startsWith(TR_COUNTRY_CODE)) {
    const compact = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return isE164(compact) ? compact : null;
  }

  // Rakam dışını temizle.
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return null;

  let normalized: string;
  if (digitsOnly.startsWith("90")) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith("0")) {
    normalized = `${TR_COUNTRY_CODE}${digitsOnly.slice(1)}`;
  } else {
    normalized = `${TR_COUNTRY_CODE}${digitsOnly}`;
  }

  return isE164(normalized) ? normalized : null;
}

/**
 * E.164'ten okunabilir TR display formatına:
 *   "+905320000000" → "+90 532 000 00 00"
 *   "+12125551234" → "+1 212 555 1234" (ülke kodu ayrı, kalanı 3'erli)
 *
 * Parse edilemez input için olduğu gibi döner (caller'a zarar vermesin diye).
 */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  const trimmed = e164.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith(TR_COUNTRY_CODE)) {
    const rest = trimmed.slice(TR_COUNTRY_CODE.length);
    if (rest.length !== 10) return trimmed;
    return `${TR_COUNTRY_CODE} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`;
  }

  return trimmed;
}
