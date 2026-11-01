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
8. Daire tipinin seçildiği anda kaydedilmesi ve apartman görevlisinin de daire tipini değiştirebilmesi için `supabase/migrations/202610240007_set_apartment_type.sql` dosyasını çalıştırın.
9. Daire tipi kontrol kurallarını 1+0, 1+1, 2+1 ve 3+1 olarak sabitlemek için `supabase/migrations/202610240008_fix_apartment_type_constraints.sql` dosyasını çalıştırın. Bu dosya tekrar çalıştırılabilir; `002` migration'ı atlanmış kurulumlarda kalan eski `1+2`/`1+3` kayıtlarını da dönüştürür.
10. Muhasebecinin yalnızca daire numaralarını ve aylık aidat tutarlarını görebilmesi için `supabase/migrations/202610240009_accountant_dues_only.sql` dosyasını çalıştırın. Bu işlem daire tipi, endeks ve fiyat tablolarının okunmasını yönetici ve apartman görevlisiyle sınırlar.
11. Apartman görevlisinin ve yöneticinin endeks ekranında binanın aylık su ve elektrik faturası tutarlarını girebilmesi için `supabase/migrations/202611010010_utility_bills.sql` dosyasını çalıştırın. Faturaları muhasebeci göremez.
12. Her dairenin aylık su ve elektrik faturasını 1–46 tablosuna girebilmek ve bu tutarları dairenin aylık aidatına eklemek için `supabase/migrations/202611010011_apartment_bills.sql` dosyasını çalıştırın. Bu işlem muhasebeci ekranındaki ve paylaşılan listedeki aidat hesabını da günceller.
13. Supabase **Project Settings → API** bölümünden proje URL'sini ve public anon/publishable anahtarını alın.
14. Ortam dosyasını hazırlayın:

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

Şifre sıfırlama e-postalarının uygulamaya dönebilmesi için Supabase **Authentication → URL Configuration → Redirect URLs** listesine uygulamanın adresini ekleyin. Geliştirme sunucusuna aynı ağdaki cihazlardan erişiyorsanız, kullandığınız LAN adresini ve portunu (ör. `http://192.168.1.75:5173`) da ekleyin.

Mevcut projede migration'ları daha önce çalıştırdıysanız ilk migration'ı tekrar çalıştırmayın; yalnızca henüz uygulanmamış dosyaları, sırasıyla çalıştırın. `006` migration'ı tamamlandıktan sonra yönetici panelindeki **Kullanıcılar ve roller** ekranı tüm kayıtlı hesapları, kayıt tarihlerini ve son giriş zamanlarını gösterir. Listeden muhasebeci veya apartman görevlisi rolü atayabilir ya da rolü kaldırabilirsiniz. Yönetici rolü değiştirilemez. Yeni rolü etkinleştirmek için kullanıcı oturumu kapatıp tekrar açmalıdır.

## Uygulamayı çalıştırma

```bash
npm run dev
```

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — TypeScript kontrolü ve üretim derlemesi
- `npm run lint` — Oxlint
- `npm run apk` — web uygulamasını derler, Android projesine aktarır ve proje kökünde `sayac-takip.apk` dosyasını üretir

## Android APK

Uygulama Capacitor ile Android'e paketlenir (`android/` klasörü). APK derlemek için JDK 21 ve Android SDK (platform 36, build-tools 35) gerekir:

```bash
brew install openjdk@21
brew install --cask android-commandlinetools
sdkmanager --sdk_root=/opt/homebrew/share/android-commandlinetools "platforms;android-36" "build-tools;35.0.0"
echo "sdk.dir=/opt/homebrew/share/android-commandlinetools" > android/local.properties
npm run apk
```

JDK 21 farklı bir konumdaysa `JAVA_HOME_21` ortam değişkeniyle belirtin. Üretilen APK debug anahtarıyla imzalıdır; telefona doğrudan kurulabilir ancak Play Store'a yüklenemez.

Android uygulaması web uygulamasının kopyasını taşımaz; açıldığında `https://sayac-takip.onuratabay.com` adresindeki web uygulamasını yükler (`capacitor.config.ts` → `server.url`). Böylece web ve Android her zaman aynı sürümü çalıştırır: web sitesi güncellendiğinde uygulama da bir sonraki açılışta güncellenir. APK'yı yalnızca `capacitor.config.ts` veya `android/` klasörü değiştiğinde `npm run apk` ile yeniden derleyin. İnternet bağlantısı yoksa uygulama `public/offline.html` sayfasını gösterir. **Listeyi paylaş** bağlantıları ve şifre sıfırlama dönüş bağlantısı da bu web adresini kullanır.

## Kullanım

- Daire numarası ve 1+0, 1+1, 2+1 veya 3+1 tipini seçerek daire ekleyin.
- Tam genişlikteki 1–46 daire tablosunda daire tipini seçin; tip seçildiği anda kaydedilir ve değiştirilene kadar sonraki aylarda da aynı kalır. Önceki endeksi ve seçili ayın son endeksini sayaçta okunduğu gibi girin; son 3 hane litredir (ör. `123456` = 123.456 m³; `123.456` ve `123,456` da kabul edilir). Örneğin `123456` → `123999` 543 litre, yani 0.543 m³ tüketimdir. Aynı satırdaki **Su faturası** ve **Elektrik faturası** alanlarına dairenin o ayki fatura tutarlarını `1250`, `1250,50` veya `1.250,50` biçiminde girin. **Endeks ve faturaları kaydet** ile saklayın. Ay sütunu (ör. "Ekim aidatı") `(son endeks − önceki endeks) × m³ birim fiyatı + aylık aidat + su faturası + elektrik faturası` toplamını gösterir; muhasebeci ekranı ve paylaşılan liste de aynı toplamı kullanır.
- Seçili ay için daire tipine göre aylık aidat ve sıcak su m³ birim fiyatını girip kaydedin. Yeni bir ayda fiyat alanları son kaydedilen değerlerle başlar; ay için kaydedilen fiyat geçmişteki tutarları değiştirmez.
- Önceki ve seçili ay endeksleri aylık kayıt olarak saklanır; tüketim farkı ile aidat + sıcak su + fatura toplamı otomatik hesaplanır. Son endeksi henüz girilmemiş, yalnızca önceki endeksi dolu satırlar kaydı engellemez; girilen satırlar kaydedilir.
- Endeks tablosunun üstündeki **Elektrik ve su** bölümüne binanın kendi (ortak) su ve elektrik faturası tutarlarını `1250`, `1250,50` veya `1.250,50` biçiminde girip **Faturaları kaydet** ile saklayın. Faturalar endekslerden bağımsız kaydedilir; eksik endeksler fatura kaydını engellemez. Boş bırakılan fatura "girilmedi" olarak saklanır; bina faturaları aidat hesabını değiştirmez.
- İlk girişte önceki ay endeksi de istenir. Sonraki dönemlerde kayıtlı endeks önceki değer olarak yüklenir.
- **Listeyi paylaş** fiyatları ve girilmiş endeksleri önce kaydeder, sonra yeni sekmede değişmeyen bir paylaşım anlık görüntüsü açar. Eksik tip veya endeks bilgisi olan daireler uyarıda listelenir ve paylaşımın dışında bırakılır. Paylaşım URL'sine sahip herkes daire numarası ve borç tutarlarını görüntüleyebilir; bu bağlantıyı yalnızca paylaşmak istediğiniz kişilerle iletin.
- Yönetici tüm verileri ve ekip rollerini yönetebilir. Apartman görevlisi daire tipini seçebilir, önceki ve son sayaç endekslerini, dairelerin ve binanın aylık su ve elektrik faturalarını girebilir; muhasebeci yalnızca seçtiği dönem için daire numaralarını ve aidat tutarlarını görebilir, hiçbir kaydı değiştiremez. Bu kısıtlamalar Supabase RLS ile de uygulanır.

Supabase istemcisi `src/lib/supabase.ts` içindedir. Tarayıcıya yalnızca public anon/publishable anahtarını koyun; `service_role` anahtarını istemciye eklemeyin.
