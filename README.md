# Sayaç Takip

React, TypeScript, Vite ve Supabase kullanılarak geliştirilen sayaç takip uygulaması.

## Supabase kurulumu

1. Supabase'te bir proje oluşturun.
2. SQL Editor'de `supabase/migrations/202610190001_initial_schema.sql` dosyasını çalıştırın. Bu işlem daire, aylık fiyat ve sayaç endeksi tablolarını oluşturur; satır düzeyinde güvenlik politikaları verileri hesap sahibiyle sınırlar.
3. Supabase **Project Settings → API** bölümünden proje URL'sini ve public anon/publishable anahtarını alın.
4. Ortam dosyasını hazırlayın:

```bash
npm install
cp .env.example .env.local
```

`.env.local` içine Supabase proje URL'sini ve public anon/publishable anahtarını ekleyin:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Supabase Authentication ayarlarından e-posta ile kayıt/giriş özelliğini etkinleştirin. Uygulamada ilk kez **Hesap oluştur** ile hesap açın. E-posta doğrulaması açıksa doğrulamadan sonra giriş yapın.

## Uygulamayı çalıştırma

```bash
npm run dev
```

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — TypeScript kontrolü ve üretim derlemesi
- `npm run lint` — Oxlint

## Kullanım

- Daire numarası ve 1+0, 1+1, 1+2 veya 1+3 tipini seçerek daire ekleyin.
- Seçili ay için daire tipine göre aylık aidat ve sıcak su m³ birim fiyatını girip kaydedin. Yeni bir ayda fiyat alanları son kaydedilen değerlerle başlar; ay için kaydedilen fiyat geçmişteki tutarları değiştirmez.
- Her daireye önceki ayın ve seçili ayın endeksini girin. Endeksler aylık kayıt olarak saklanır; tüketim farkı ve aidat + sıcak su toplamı otomatik hesaplanır.
- İlk girişte önceki ay endeksi de istenir. Sonraki dönemlerde kayıtlı endeks önceki değer olarak yüklenir.

Supabase istemcisi `src/lib/supabase.ts` içindedir. Tarayıcıya yalnızca public anon/publishable anahtarını koyun; `service_role` anahtarını istemciye eklemeyin.
