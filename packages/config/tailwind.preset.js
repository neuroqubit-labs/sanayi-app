/**
 * @naro/config/tailwind.preset
 *
 * Paylaşılan Tailwind preset'i. nativewind/preset'i içinde barındırır.
 * Renk (brand) token'ları app-özel — her app kendi tailwind.config.js'inde
 * theme.extend.colors.brand tanımlar (müşteri mavi, servis turuncu).
 *
 * Content path'leri bu preset'te DEĞİLDİR; glob resolution config dosyasına
 * göre çalışır, app'ın content path'ini app'ın kendi config'i bilir.
 */
module.exports = {
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "28px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        full: "9999px",
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "32px" }],
        "2xl": ["24px", { lineHeight: "36px" }],
        "3xl": ["32px", { lineHeight: "40px" }],
      },
    },
  },
};
