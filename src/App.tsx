import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

const apartmentTypes = ['1+0', '1+1', '1+2', '1+3'] as const
type ApartmentType = (typeof apartmentTypes)[number]

interface Apartment {
  id: string
  unit_number: string
  apartment_type: ApartmentType
}

interface Rate {
  apartment_type: ApartmentType
  dues: number
  hot_water_price: number
}

interface MeterReading {
  apartment_id: string
  reading_month: string
  index_value: number
}

interface ReadingDraft {
  previous: string
  current: string
}

const emptyRates = (): Record<ApartmentType, { dues: string; hotWater: string }> => ({
  '1+0': { dues: '0', hotWater: '0' },
  '1+1': { dues: '0', hotWater: '0' },
  '1+2': { dues: '0', hotWater: '0' },
  '1+3': { dues: '0', hotWater: '0' },
})

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, difference: number) {
  const date = new Date(`${month}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() + difference)
  return date.toISOString().slice(0, 7)
}

function monthDate(month: string) {
  return `${month}-01`
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00.000Z`))
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.'
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [rates, setRates] = useState(emptyRates)
  const [readingDrafts, setReadingDrafts] = useState<Record<string, ReadingDraft>>({})
  const [previousReadings, setPreviousReadings] = useState<Record<string, number>>({})
  const [currentReadings, setCurrentReadings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [savingRates, setSavingRates] = useState(false)
  const [savingApartment, setSavingApartment] = useState(false)
  const [savingReadings, setSavingReadings] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [apartmentType, setApartmentType] = useState<ApartmentType>('1+1')
  const dataRequestId = useRef(0)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
      setAuthMessage('')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!supabase || !session) return
    const requestId = ++dataRequestId.current
    try {
      const previousMonth = shiftMonth(month, -1)
      const [apartmentResult, rateResult, readingResult] = await Promise.all([
        supabase.from('apartments').select('id, unit_number, apartment_type').order('unit_number'),
        supabase.from('monthly_rates').select('apartment_type, dues, hot_water_price')
          .lte('rate_month', monthDate(month)).order('rate_month', { ascending: false }),
        supabase.from('meter_readings').select('apartment_id, reading_month, index_value')
          .gte('reading_month', monthDate(previousMonth))
          .lte('reading_month', monthDate(month)),
      ])

      if (apartmentResult.error) throw apartmentResult.error
      if (rateResult.error) throw rateResult.error
      if (readingResult.error) throw readingResult.error
      if (requestId !== dataRequestId.current) return

      const nextApartments = apartmentResult.data as Apartment[]
      const nextRates = emptyRates()
      const loadedTypes = new Set<ApartmentType>()
      for (const rate of rateResult.data as Rate[]) {
        if (loadedTypes.has(rate.apartment_type)) continue
        nextRates[rate.apartment_type] = {
          dues: String(rate.dues),
          hotWater: String(rate.hot_water_price),
        }
        loadedTypes.add(rate.apartment_type)
      }

      const previous: Record<string, number> = {}
      const current: Record<string, number> = {}
      for (const reading of readingResult.data as MeterReading[]) {
        if (reading.reading_month === monthDate(previousMonth)) {
          previous[reading.apartment_id] = reading.index_value
        }
        if (reading.reading_month === monthDate(month)) {
          current[reading.apartment_id] = reading.index_value
        }
      }

      setApartments(nextApartments)
      setRates(nextRates)
      setPreviousReadings(previous)
      setCurrentReadings(current)
      setReadingDrafts(Object.fromEntries(nextApartments.map((apartment) => [
        apartment.id,
        {
          previous: previous[apartment.id] === undefined ? '' : String(previous[apartment.id]),
          current: current[apartment.id] === undefined ? '' : String(current[apartment.id]),
        },
      ])))
      setError('')
    } catch (loadError) {
      if (requestId === dataRequestId.current) {
        setError(`Veriler yüklenemedi: ${errorMessage(loadError)}`)
      }
    } finally {
      if (requestId === dataRequestId.current) setLoading(false)
    }
  }, [month, session])

  useEffect(() => {
    // Month changes trigger a Supabase fetch; its response updates the dependent UI state.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadData()
  }, [loadData])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setAuthBusy(true)
    setAuthMessage('')
    setError('')
    try {
      const result = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      if (isSignup && !result.data.session) {
        setAuthMessage('Hesabınız oluşturuldu. Devam etmek için e-posta adresinizi doğrulayın.')
      }
    } catch (authError) {
      setError(errorMessage(authError))
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(`Oturum kapatılamadı: ${signOutError.message}`)
  }

  function handleMonthChange(value: string) {
    if (!value) return
    setLoading(true)
    setError('')
    setNotice('')
    setMonth(value)
  }

  async function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const rows = apartmentTypes.map((type) => ({
      rate_month: monthDate(month),
      apartment_type: type,
      dues: Number(rates[type].dues),
      hot_water_price: Number(rates[type].hotWater),
    }))
    if (rows.some((row) => !Number.isFinite(row.dues) || !Number.isFinite(row.hot_water_price)
      || row.dues < 0 || row.hot_water_price < 0)) {
      setError('Aidat ve sıcak su birim fiyatları sıfır veya daha büyük olmalıdır.')
      return
    }
    setSavingRates(true)
    setError('')
    setNotice('')
    const { error: saveError } = await supabase.from('monthly_rates')
      .upsert(rows, { onConflict: 'owner_id,rate_month,apartment_type' })
    setSavingRates(false)
    if (saveError) {
      setError(`Fiyatlar kaydedilemedi: ${saveError.message}`)
      return
    }
    setNotice(`${monthLabel(month)} fiyatları kaydedildi.`)
  }

  async function addApartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const normalizedUnitNumber = unitNumber.trim()
    if (!normalizedUnitNumber) {
      setError('Daire numarasını girin.')
      return
    }
    setSavingApartment(true)
    setError('')
    setNotice('')
    const { error: insertError } = await supabase.from('apartments').insert({
      unit_number: normalizedUnitNumber,
      apartment_type: apartmentType,
    })
    setSavingApartment(false)
    if (insertError) {
      setError(insertError.code === '23505'
        ? 'Bu daire numarası zaten kayıtlı.'
        : `Daire eklenemedi: ${insertError.message}`)
      return
    }
    setUnitNumber('')
    setNotice(`${normalizedUnitNumber} numaralı daire eklendi.`)
    await loadData()
  }

  function updateDraft(apartmentId: string, key: keyof ReadingDraft, value: string) {
    setReadingDrafts((drafts) => ({
      ...drafts,
      [apartmentId]: { ...drafts[apartmentId], [key]: value },
    }))
  }

  async function saveReading(apartment: Apartment) {
    if (!supabase) return
    const draft = readingDrafts[apartment.id]
    const previousValue = Number(draft?.previous)
    const currentValue = Number(draft?.current)
    if (draft?.previous.trim() === '' || draft?.current.trim() === ''
      || !Number.isFinite(previousValue) || !Number.isFinite(currentValue)
      || previousValue < 0 || currentValue < previousValue) {
      setError(`${apartment.unit_number} numaralı daire için geçerli iki endeks girin. Yeni endeks önceki endeksten küçük olamaz.`)
      return
    }

    setSavingReadings((saving) => ({ ...saving, [apartment.id]: true }))
    setError('')
    setNotice('')
    const previousMonth = shiftMonth(month, -1)
    const { error: saveError } = await supabase.from('meter_readings').upsert([
      {
        apartment_id: apartment.id,
        reading_month: monthDate(previousMonth),
        index_value: previousValue,
      },
      {
        apartment_id: apartment.id,
        reading_month: monthDate(month),
        index_value: currentValue,
      },
    ], { onConflict: 'apartment_id,reading_month' })
    setSavingReadings((saving) => ({ ...saving, [apartment.id]: false }))
    if (saveError) {
      setError(`Endeksler kaydedilemedi: ${saveError.message}`)
      return
    }
    setPreviousReadings((readings) => ({ ...readings, [apartment.id]: previousValue }))
    setCurrentReadings((readings) => ({ ...readings, [apartment.id]: currentValue }))
    setNotice(`${apartment.unit_number} numaralı dairenin endeksleri kaydedildi.`)
  }

  const totals = useMemo(() => apartments.reduce((result, apartment) => {
    const previous = previousReadings[apartment.id]
    const current = currentReadings[apartment.id]
    if (previous === undefined || current === undefined) return result
    const consumption = current - previous
    const rate = rates[apartment.apartment_type]
    result.consumption += consumption
    result.amount += Number(rate.dues) + consumption * Number(rate.hotWater)
    result.complete += 1
    return result
  }, { consumption: 0, amount: 0, complete: 0 }), [
    apartments, currentReadings, previousReadings, rates,
  ])

  if (!isSupabaseConfigured) {
    return (
      <main className="app-shell auth-shell">
        <Brand />
        <div className="message-panel">
          <span className="eyebrow">SUPABASE KURULUMU</span>
          <h1>Veritabanı bağlantısı gerekli</h1>
          <p>README yönergelerini izleyerek Supabase proje bilgilerinizi <code>.env.local</code> dosyasına ekleyin.</p>
        </div>
      </main>
    )
  }

  if (!authReady) {
    return <main className="app-shell auth-shell"><Brand /><div className="message-panel">Bağlantı kuruluyor…</div></main>
  }

  if (!session) {
    return (
      <main className="app-shell auth-shell">
        <Brand />
        <form className="auth-panel" onSubmit={handleAuth}>
          <span className="eyebrow">SAYAÇ TAKİP</span>
          <h1>{isSignup ? 'Hesap oluşturun' : 'Yönetici girişi'}</h1>
          <p>Daireleri, aylık fiyatları ve sayaç endekslerini yönetmek için giriş yapın.</p>
          <label>E-posta
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>Şifre
            <input type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="alert error-alert" role="alert">{error}</p>}
          {authMessage && <p className="alert success-alert" role="status">{authMessage}</p>}
          <button className="primary-button full-button" disabled={authBusy}>
            {authBusy ? 'İşleniyor…' : isSignup ? 'Hesap oluştur' : 'Giriş yap'}
          </button>
          <button className="text-button" type="button" onClick={() => { setIsSignup(!isSignup); setError(''); setAuthMessage('') }}>
            {isSignup ? 'Zaten hesabınız var mı? Giriş yapın' : 'İlk kez mi kullanıyorsunuz? Hesap oluşturun'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="app-shell dashboard-shell">
      <header className="topbar">
        <Brand />
        <div className="user-actions">
          <span className="user-email">{session.user.email}</span>
          <button className="text-button signout-button" type="button" onClick={handleSignOut}>Çıkış</button>
        </div>
      </header>

      <section className="dashboard-intro">
        <div>
          <span className="eyebrow">YÖNETİM PANELİ</span>
          <h1>Aylık sayaç ve aidat takibi</h1>
          <p>Daire tipine göre aidatları belirleyin, aylık endeksleri girin; tüketim ve tutarlar otomatik hesaplansın.</p>
        </div>
        <label className="month-picker">Dönem
          <input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} />
        </label>
      </section>

      {error && <div className="alert error-alert" role="alert">{error}</div>}
      {notice && <div className="alert success-alert" role="status">{notice}</div>}

      <section className="summary-grid" aria-label="Aylık özet">
        <SummaryCard label="Kayıtlı daire" value={String(apartments.length)} detail="Tüm daireler" />
        <SummaryCard label="Endeksi tamamlanan" value={`${totals.complete} / ${apartments.length}`} detail={monthLabel(month)} />
        <SummaryCard label="Toplam sıcak su" value={`${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(totals.consumption)} m³`} detail="Tamamlanan daireler" />
        <SummaryCard label="Tahmini toplam" value={formatMoney(totals.amount)} detail="Aidat + sıcak su" />
      </section>

      <div className="management-grid">
        <section className="panel rates-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">FİYATLANDIRMA</span><h2>Aylık fiyatlar</h2></div>
            <span className="panel-caption">{monthLabel(month)}</span>
          </div>
          <form onSubmit={saveRates}>
            <div className="rates-table">
              <div className="rate-row rate-header"><span>Daire tipi</span><span>Aylık aidat</span><span>Sıcak su / m³</span></div>
              {apartmentTypes.map((type) => (
                <div className="rate-row" key={type}>
                  <strong>{type}</strong>
                  <label className="money-input"><span>₺</span><input aria-label={`${type} aylık aidat`} type="number" min="0" step="0.01" required value={rates[type].dues} onChange={(event) => setRates((oldRates) => ({ ...oldRates, [type]: { ...oldRates[type], dues: event.target.value } }))} /></label>
                  <label className="money-input"><span>₺</span><input aria-label={`${type} sıcak su metreküp fiyatı`} type="number" min="0" step="0.01" required value={rates[type].hotWater} onChange={(event) => setRates((oldRates) => ({ ...oldRates, [type]: { ...oldRates[type], hotWater: event.target.value } }))} /></label>
                </div>
              ))}
            </div>
            <p className="field-hint">Fiyatlar seçili aya kaydedilir; önceki ayların hesapları değişmez.</p>
            <button className="primary-button" disabled={savingRates}>{savingRates ? 'Kaydediliyor…' : 'Fiyatları kaydet'}</button>
          </form>
        </section>

        <section className="panel apartment-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">DAİRELER</span><h2>Daire ekle</h2></div>
            <span className="count-badge">{apartments.length} daire</span>
          </div>
          <form className="apartment-form" onSubmit={addApartment}>
            <label>Daire no
              <input value={unitNumber} onChange={(event) => setUnitNumber(event.target.value)} placeholder="Örn. 12" required />
            </label>
            <label>Tip
              <select value={apartmentType} onChange={(event) => setApartmentType(event.target.value as ApartmentType)}>
                {apartmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <button className="primary-button" disabled={savingApartment}>{savingApartment ? 'Ekleniyor…' : 'Daire ekle'}</button>
          </form>
          <div className="apartment-list">
            {apartments.length === 0
              ? <p className="empty-copy">{loading ? 'Daireler yükleniyor…' : 'Henüz daire eklenmemiş.'}</p>
              : apartments.map((apartment) => (
                <div className="apartment-chip" key={apartment.id}>
                  <span className="unit-avatar">{apartment.apartment_type}</span>
                  <span>Daire {apartment.unit_number}</span>
                  <span className="type-pill">{apartment.apartment_type}</span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section className="panel readings-panel">
        <div className="panel-heading readings-heading">
          <div><span className="eyebrow">AYLIK GİRİŞ</span><h2>{monthLabel(month)} sayaç endeksleri</h2></div>
          <span className="panel-caption">Tüketim = yeni endeks − önceki endeks</span>
        </div>
        {apartments.length === 0 ? (
          <div className="empty-readings">{loading ? 'Veriler yükleniyor…' : 'Endeks girişi için önce daire ekleyin.'}</div>
        ) : (
          <div className="reading-list">
            {apartments.map((apartment) => {
              const draft = readingDrafts[apartment.id] ?? { previous: '', current: '' }
              const previousValue = Number(draft.previous)
              const currentValue = Number(draft.current)
              const hasValues = draft.previous.trim() !== '' && draft.current.trim() !== ''
              const consumption = hasValues && currentValue >= previousValue ? currentValue - previousValue : null
              const rate = rates[apartment.apartment_type]
              const amount = consumption === null ? null : Number(rate.dues) + consumption * Number(rate.hotWater)
              return (
                <article className="reading-card" key={apartment.id}>
                  <div className="reading-unit">
                    <span className="unit-avatar">{apartment.apartment_type}</span>
                    <span><strong>Daire {apartment.unit_number}</strong><small>{apartment.apartment_type} · {formatMoney(Number(rate.dues))} aidat</small></span>
                  </div>
                  <label>Önceki ay ({monthLabel(shiftMonth(month, -1))}) endeksi
                    <input type="number" min="0" step="0.001" inputMode="decimal" value={draft.previous} onChange={(event) => updateDraft(apartment.id, 'previous', event.target.value)} placeholder="Önceki endeks" />
                  </label>
                  <label>{monthLabel(month)} endeksi
                    <input type="number" min="0" step="0.001" inputMode="decimal" value={draft.current} onChange={(event) => updateDraft(apartment.id, 'current', event.target.value)} placeholder="Yeni endeks" />
                  </label>
                  <div className="calculation">
                    <span>{consumption === null ? 'Tüketim bekleniyor' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(consumption)} m³`}</span>
                    <strong>{amount === null ? '—' : formatMoney(amount)}</strong>
                  </div>
                  <button className="secondary-button" type="button" disabled={savingReadings[apartment.id]} onClick={() => void saveReading(apartment)}>
                    {savingReadings[apartment.id] ? 'Kaydediliyor…' : 'Endeksleri kaydet'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>
      <footer className="footer">Sayaç Takip <span>·</span> Aylık aidat ve sıcak su takibi</footer>
    </main>
  )
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Sayaç Takip ana sayfa">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4.5 18.5V14m5 4.5V9m5 9.5V5m5 13.5v-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span>Sayaç Takip</span>
    </a>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export default App
