# Sayaç Takip

React, TypeScript, Vite ve Supabase kullanılarak geliştirilen sayaç takip uygulaması.

## Supabase kurulumu

1. Supabase'te bir proje oluşturun.
2. SQL Editor'de `supabase/migrations/202610190001_initial_schema.sql` dosyasını çalıştırın. Bu işlem daire, aylık fiyat ve sayaç endeksi tablolarını oluşturur; satır düzeyinde güvenlik politikaları verileri hesap sahibiyle sınırlar.
3. Mevcut kurulumda daire tiplerini güncellemek için `supabase/migrations/202610190002_update_apartment_types.sql` dosyasını çalıştırın. Bu işlem eski `1+2` ve `1+3` tiplerini sırasıyla `2+1` ve `3+1` olarak günceller. Yeni kurulumda ilk migration dosyasını kullanmanız yeterlidir.
4. Herkese açık, salt okunur borç listesi paylaşımı için `supabase/migrations/202610190003_public_dues_sharing.sql` dosyasını da çalıştırın.
5. Kısmi girişle paylaşım için `supabase/migrations/202610190004_allow_partial_dues_sharing.sql` dosyasını çalıştırın. Eksik daireler uyarıda belirtilir; tamamlanmış kayıtlar paylaşılır.
6. Yönetici, muhasebeci ve apartman görevlisi rolleri ile veritabanı yetkileri için `supabase/migrations/202610190005_user_roles.sql` dosyasını çalıştırın.
7. Yönetici ekranında tüm kayıtlı hesapları, son giriş zamanlarını görüntülemek ve hesaplara rol atamak için `supabase/migrations/202610190006_admin_user_directory.sql` dosyasını çalıştırın.
8. Supabase **Project Settings → API** bölümünden proje URL'sini ve public anon/publishable anahtarını alın.
9. Ortam dosyasını hazırlayın:

```bash
npm install
cp .env.example .env.local
```

`.env.local` içine Supabase proje URL'sini ve public anon/publishable anahtarını ekleyin:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Supabase Authentication ayarlarından e-posta ile kayıt/giriş özelliğini etkinleştirin. Yönetici hesabı `onuratabay@hotmail.com` adresidir ve e-posta adresinin doğrulanmış olması gerekir. Muhasebeci ve apartman görevlileri uygulamada hesap oluşturduktan sonra yönetici tarafından atanır.

Mevcut projede migration'ları daha önce çalıştırdıysanız ilk migration'ı tekrar çalıştırmayın; yalnızca henüz uygulanmamış dosyaları, sırasıyla çalıştırın. `006` migration'ı tamamlandıktan sonra yönetici panelindeki **Kullanıcılar ve roller** ekranı tüm kayıtlı hesapları, kayıt tarihlerini ve son giriş zamanlarını gösterir. Listeden muhasebeci veya apartman görevlisi rolü atayabilir ya da rolü kaldırabilirsiniz. Yönetici rolü değiştirilemez. Yeni rolü etkinleştirmek için kullanıcı oturumu kapatıp tekrar açmalıdır.

## Uygulamayı çalıştırma

```bash
npm run dev
```

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — TypeScript kontrolü ve üretim derlemesi
- `npm run lint` — Oxlint

## Kullanım

- Daire numarası ve 1+0, 1+1, 2+1 veya 3+1 tipini seçerek daire ekleyin.
- Tam genişlikteki 1–46 daire tablosunda daire tipini, önceki endeksi ve seçili ayın son endeksini girin. Aidat tutarı seçilen daire tipinin güncel aylık fiyatından gösterilir. **Daire ve endeksleri kaydet** ile listeyi ve endeksleri saklayın.
- Seçili ay için daire tipine göre aylık aidat ve sıcak su m³ birim fiyatını girip kaydedin. Yeni bir ayda fiyat alanları son kaydedilen değerlerle başlar; ay için kaydedilen fiyat geçmişteki tutarları değiştirmez.
- Önceki ve seçili ay endeksleri aylık kayıt olarak saklanır; tüketim farkı ile aidat + sıcak su toplamı otomatik hesaplanır.
- İlk girişte önceki ay endeksi de istenir. Sonraki dönemlerde kayıtlı endeks önceki değer olarak yüklenir.
- **Listeyi paylaş** fiyatları ve girilmiş endeksleri önce kaydeder, sonra yeni sekmede değişmeyen bir paylaşım anlık görüntüsü açar. Eksik tip veya endeks bilgisi olan daireler uyarıda listelenir ve paylaşımın dışında bırakılır. Paylaşım URL'sine sahip herkes daire numarası ve borç tutarlarını görüntüleyebilir; bu bağlantıyı yalnızca paylaşmak istediğiniz kişilerle iletin.
- Yönetici tüm verileri ve ekip rollerini yönetebilir. Apartman görevlisi yalnızca önceki ve son sayaç endekslerini girebilir; muhasebeci kayıtları görüntüleyebilir. Bu kısıtlamalar Supabase RLS ile de uygulanır.

Supabase istemcisi `src/lib/supabase.ts` içindedir. Tarayıcıya yalnızca public anon/publishable anahtarını koyun; `service_role` anahtarını istemciye eklemeyin.
