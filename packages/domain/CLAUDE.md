# `@naro/domain` — Cross-App Kontrat Paketi

Müşteri app, servis app ve backend için **tek kaynak** Zod şemaları. Mobil-first geliştirme: ekran akışı oturunca şemalar ekrandan türetilir, sonra backend bu şemalara hizalanır.

## Stack
- TypeScript (strict)
- Zod
- pnpm workspace package

## Disiplin
- Yeni şema önce buraya. Mobil app/backend bağımsız tip türetmez.
- İsim sözlükten ([docs/naro-domain-glossary.md](../../docs/naro-domain-glossary.md)) gelir.
- Schema parity gerilimi → `schema-parity` agent ile çöz.

## Test Gate
```bash
pnpm --filter @naro/domain exec tsc --noEmit
```

Diğer paketler `@naro/domain` import ettiği için type breaking change downstream tetikler. Üst-paket consumer'larında `/fe-check` çalıştır.
