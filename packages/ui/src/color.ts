export function withAlphaHex(color: string, alpha: number) {
  const normalized = color.trim().replace(/^#/, "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return color;
  }

  const alphaValue = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${normalized}${alphaValue}`;
}
