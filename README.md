# Sayaç Takip

React, TypeScript, Vite ve Supabase kullanılarak geliştirilen sayaç takip uygulaması.

## Geliştirme ortamını başlatma

```bash
npm install
cp .env.example .env.local
```

`.env.local` dosyasına Supabase proje URL'inizi ve public anon/publishable anahtarınızı ekleyin:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Ardından geliştirme sunucusunu başlatın:

```bash
npm run dev
```

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — TypeScript kontrolü ve üretim derlemesi
- `npm run lint` — Oxlint

Supabase istemcisi `src/lib/supabase.ts` içinden dışa aktarılır. Gerçek sayaç verileri ve tablolar, uygulama gereksinimleri netleştikçe eklenecektir.
