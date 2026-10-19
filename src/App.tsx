import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

const apartmentTypes = ['1+0', '1+1', '2+1', '3+1'] as const
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

interface SharedDue {
  apartment_number: string | null
  monthly_due: number | null
  share_month: string
}

type AppRole = 'manager' | 'accountant' | 'concierge'

interface Access {
  owner_id: string
  role: AppRole
}

interface ManagedUser {
  user_id: string
  email: string
  role: AppRole | null
  last_sign_in_at: string | null
  created_at: string
}

const emptyRates = (): Record<ApartmentType, { dues: string; hotWater: string }> => ({
  '1+0': { dues: '0', hotWater: '0' },
  '1+1': { dues: '0', hotWater: '0' },
  '2+1': { dues: '0', hotWater: '0' },
  '3+1': { dues: '0', hotWater: '0' },
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

function formatTimestamp(value: string | null) {
  if (!value) return 'Henüz giriş yapmadı'
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.'
}

function roleLabel(role: AppRole) {
  if (role === 'manager') return 'Yönetici'
  if (role === 'accountant') return 'Muhasebeci'
  return 'Apartman görevlisi'
}

function App() {
  const [shareId] = useState(() => new URLSearchParams(window.location.search).get('share'))
  const [sharedDues, setSharedDues] = useState<SharedDue[]>([])
  const [sharedMonth, setSharedMonth] = useState('')
  const [shareLoading, setShareLoading] = useState(Boolean(shareId))
  const [shareError, setShareError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [accessLoading, setAccessLoading] = useState(false)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState('')
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [rates, setRates] = useState(emptyRates)
  const [bulkReadings, setBulkReadings] = useState<Record<number, ReadingDraft>>({})
  const [previousReadings, setPreviousReadings] = useState<Record<string, number>>({})
  const [currentReadings, setCurrentReadings] = useState<Record<string, number>>({})
  const [savingRates, setSavingRates] = useState(false)
  const [savingApartment, setSavingApartment] = useState(false)
  const [savingBulkApartments, setSavingBulkApartments] = useState(false)
  const [savingShare, setSavingShare] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [apartmentType, setApartmentType] = useState<ApartmentType>('1+1')
  const [bulkTypes, setBulkTypes] = useState<Record<number, ApartmentType | ''>>(
    () => Object.fromEntries(Array.from({ length: 46 }, (_, index) => [index + 1, ''])),
  )
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
      setAccessLoading(Boolean(data.session))
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAccess(null)
      setAccessLoading(Boolean(nextSession))
      setManagedUsers([])
      setAuthReady(true)
      setAuthMessage('')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) return

    let active = true
    Promise.resolve(supabase.rpc('get_my_access')).then(({ data, error: accessError }) => {
      if (!active) return
      if (accessError) {
        setError(`Rol bilgisi alınamadı: ${accessError.message}`)
      } else {
        const result = data as Access[] | null
        setAccess(result?.[0] ?? null)
        if (!result?.[0]) setError('Bu hesap için bina erişim rolü tanımlanmamış.')
      }
      setAccessLoading(false)
    }).catch((accessError: unknown) => {
      if (!active) return
      setError(`Rol bilgisi alınamadı: ${errorMessage(accessError)}`)
      setAccessLoading(false)
    })

    return () => {
      active = false
    }
  }, [session])

  const isManager = access?.role === 'manager'
  const isConcierge = access?.role === 'concierge'

  const loadManagedUsers = useCallback(async () => {
    if (!supabase || !isManager) return
    setUsersLoading(true)
    try {
      const { data, error: usersError } = await supabase.rpc('list_registered_users')
      if (usersError) throw usersError
      setManagedUsers(data as ManagedUser[])
    } catch (usersError) {
      setError(`Kullanıcı listesi alınamadı: ${errorMessage(usersError)}`)
    } finally {
      setUsersLoading(false)
    }
  }, [isManager])

  useEffect(() => {
    // Manager role changes trigger loading the authorized user directory.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadManagedUsers()
  }, [loadManagedUsers])

  async function changeUserRole(user: ManagedUser, role: Exclude<AppRole, 'manager'> | null) {
    if (!supabase || !isManager || user.role === 'manager') return
    setUpdatingUserId(user.user_id)
    setError('')
    setNotice('')
    try {
      if (role) {
        const { error: roleError } = await supabase.rpc('add_building_member', {
          p_email: user.email,
          p_role: role,
        })
        if (roleError) throw roleError
        setNotice(`${user.email} rolü ${roleLabel(role)} olarak güncellendi.`)
      } else {
        const { error: removeError } = await supabase.rpc('remove_building_member', {
          p_user_id: user.user_id,
        })
        if (removeError) throw removeError
        setNotice(`${user.email} rolü kaldırıldı.`)
      }
      await loadManagedUsers()
    } catch (roleError) {
      setError(`Kullanıcı rolü güncellenemedi: ${errorMessage(roleError)}`)
    } finally {
      setUpdatingUserId('')
    }
  }

  useEffect(() => {
    if (!shareId || !supabase) return
    let active = true
    Promise.resolve(supabase.rpc('get_shared_dues', { p_share_id: shareId }))
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setShareError(loadError.message)
        } else if (!data || data.length === 0) {
          setShareError('Bu paylaşım bulunamadı veya artık erişilebilir değil.')
        } else {
          const rows = data as SharedDue[]
          setSharedDues(rows.filter((row) => row.apartment_number !== null))
          setSharedMonth(rows[0].share_month.slice(0, 7))
        }
        setShareLoading(false)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setShareError(`Paylaşım yüklenemedi: ${errorMessage(loadError)}`)
        setShareLoading(false)
      })
    return () => {
      active = false
    }
  }, [shareId])

  const loadData = useCallback(async () => {
    if (!supabase || !session || !access) return
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

      const readingsByApartment = new Map<string, ReadingDraft>()
      for (const apartment of nextApartments) {
        const previousIndex = previous[apartment.id]
        const currentIndex = current[apartment.id]
        readingsByApartment.set(apartment.unit_number, {
          previous: previousIndex === undefined ? '' : String(previousIndex),
          current: currentIndex === undefined ? '' : String(currentIndex),
        })
      }

      setApartments(nextApartments)
      setRates(nextRates)
      setPreviousReadings(previous)
      setCurrentReadings(current)
      setBulkReadings(Object.fromEntries(Array.from({ length: 46 }, (_, index) => {
        const number = index + 1
        return [number, readingsByApartment.get(String(number)) ?? { previous: '', current: '' }]
      })))
      setError('')
    } catch (loadError) {
      if (requestId === dataRequestId.current) {
        setError(`Veriler yüklenemedi: ${errorMessage(loadError)}`)
      }
    }
  }, [access, month, session])

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
    setError('')
    setNotice('')
    setMonth(value)
  }

  async function persistRates(): Promise<boolean> {
    if (!supabase || !isManager || !access) {
      setError('Yalnızca yönetici aidat fiyatlarını değiştirebilir.')
      return false
    }
    const rows = apartmentTypes.map((type) => ({
      rate_month: monthDate(month),
      apartment_type: type,
      owner_id: access.owner_id,
      dues: Number(rates[type].dues),
      hot_water_price: Number(rates[type].hotWater),
    }))
    if (rows.some((row) => !Number.isFinite(row.dues) || !Number.isFinite(row.hot_water_price)
      || row.dues < 0 || row.hot_water_price < 0)) {
      setError('Aidat ve sıcak su birim fiyatları sıfır veya daha büyük olmalıdır.')
      return false
    }
    setSavingRates(true)
    setError('')
    setNotice('')
    try {
      const { error: saveError } = await supabase.from('monthly_rates')
        .upsert(rows, { onConflict: 'owner_id,rate_month,apartment_type' })
      if (saveError) {
        setError(`Fiyatlar kaydedilemedi: ${saveError.message}`)
        return false
      }
      setNotice(`${monthLabel(month)} fiyatları kaydedildi.`)
      return true
    } catch (saveError) {
      setError(`Fiyatlar kaydedilemedi: ${errorMessage(saveError)}`)
      return false
    } finally {
      setSavingRates(false)
    }
  }

  async function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await persistRates()
  }

  async function addApartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !isManager || !access) return
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
      owner_id: access.owner_id,
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

  async function saveBulkApartments(allowIncomplete = false): Promise<boolean> {
    if (!supabase || !access || (!isManager && !isConcierge)) return false
    const rows = Array.from({ length: 46 }, (_, index) => {
      const number = index + 1
      const existing = apartments.find((apartment) => apartment.unit_number === String(number))
      return {
        number,
        apartment_type: bulkTypes[number] || existing?.apartment_type || '',
        readings: bulkReadings[number] ?? { previous: '', current: '' },
      }
    })
    const unselected = rows.filter((row) => !row.apartment_type).map((row) => row.number)
    if (isManager && !allowIncomplete && unselected.length > 0) {
      setError(`Daire tipi seçilmemiş numaralar: ${unselected.join(', ')}.`)
      return false
    }

    for (const row of rows) {
      const { previous, current } = row.readings
      const hasPrevious = previous.trim() !== ''
      const hasCurrent = current.trim() !== ''
      if ((isManager && !allowIncomplete || isConcierge) && hasPrevious !== hasCurrent) {
        setError(`${row.number} numaralı daire için önceki ve son endeks birlikte girilmelidir.`)
        return false
      }
      if (hasPrevious && hasCurrent) {
        const previousValue = Number(previous)
        const currentValue = Number(current)
        if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)
          || previousValue < 0 || currentValue < previousValue) {
          setError(`${row.number} numaralı dairede endeksler geçerli olmalı; son endeks önceki endeksten küçük olamaz.`)
          return false
        }
      }
    }

    setSavingBulkApartments(true)
    setError('')
    setNotice('')
    try {
      const apartmentRows = isManager ? rows.filter((row) => row.apartment_type) : []
      const { data: savedApartments, error: apartmentError } = apartmentRows.length > 0
        ? await supabase
          .from('apartments')
          .upsert(apartmentRows.map((row) => ({
          unit_number: String(row.number),
          apartment_type: row.apartment_type as ApartmentType,
          owner_id: access.owner_id,
        })), { onConflict: 'owner_id,unit_number' })
        .select('id, unit_number')
        : { data: [], error: null }
      if (apartmentError) throw apartmentError

      const apartmentIds = new Map([
        ...apartments.map((apartment) => [apartment.unit_number, apartment.id] as const),
        ...savedApartments.map((apartment) => [apartment.unit_number, apartment.id] as const),
      ])
      const previousMonth = shiftMonth(month, -1)
      const meterRows = rows.flatMap((row) => {
        const { previous, current } = row.readings
        if (previous.trim() === '' || current.trim() === '') return []
        const apartmentId = apartmentIds.get(String(row.number))
        if (!apartmentId) throw new Error(`${row.number} numaralı daire kayıttan sonra bulunamadı.`)
        return [
          { apartment_id: apartmentId, owner_id: access.owner_id, reading_month: monthDate(previousMonth), index_value: Number(previous) },
          { apartment_id: apartmentId, owner_id: access.owner_id, reading_month: monthDate(month), index_value: Number(current) },
        ]
      })

      if (meterRows.length > 0) {
        const { error: readingsError } = await supabase.from('meter_readings')
          .upsert(meterRows, { onConflict: 'apartment_id,reading_month' })
        if (readingsError) {
          await loadData()
          throw new Error(`Daireler kaydedildi ancak sayaç endeksleri kaydedilemedi: ${readingsError.message}`)
        }
      }

      setNotice(isConcierge
        ? 'Girilen sayaç endeksleri kaydedildi.'
        : `Girilen daire bilgileri kaydedildi${meterRows.length > 0 ? ' ve endeksler saklandı' : ''}.`)
      await loadData()
      return true
    } catch (bulkError) {
      setError(`Toplu liste kaydedilemedi: ${errorMessage(bulkError)}`)
      return false
    } finally {
      setSavingBulkApartments(false)
    }
  }

  async function addBulkApartments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveBulkApartments()
  }

  async function createShare() {
    if (!supabase || !isManager) return
    const shareRows = Array.from({ length: 46 }, (_, index) => {
      const number = index + 1
      const existing = apartments.find((apartment) => apartment.unit_number === String(number))
      return {
        number,
        apartmentType: bulkTypes[number] || existing?.apartment_type || '',
        reading: bulkReadings[number] ?? { previous: '', current: '' },
      }
    })
    const incompleteApartments = shareRows.filter(({ apartmentType, reading }) => (
      !apartmentType || reading.previous.trim() === '' || reading.current.trim() === ''
    )).map(({ number }) => number)

    const invalidReading = shareRows.find(({ reading }) => (
      reading.previous.trim() !== ''
      && reading.current.trim() !== ''
      && (!Number.isFinite(Number(reading.previous))
        || !Number.isFinite(Number(reading.current))
        || Number(reading.previous) < 0
        || Number(reading.current) < Number(reading.previous))
    ))
    if (invalidReading) {
      setError(`${invalidReading.number} numaralı dairede endeksler geçerli olmalı; son endeks önceki endeksten küçük olamaz.`)
      return
    }

    const shareWindow = window.open('about:blank', '_blank')
    if (!shareWindow) {
      setError('Paylaşım sekmesi açılamadı. Tarayıcınızda açılır pencerelere izin verip tekrar deneyin.')
      return
    }
    shareWindow.opener = null

    setSavingShare(true)
    setError('')
    setNotice('')
    try {
      const ratesSaved = await persistRates()
      if (!ratesSaved) {
        shareWindow.close()
        return
      }
      const saved = await saveBulkApartments(true)
      if (!saved) {
        shareWindow.close()
        return
      }

      const { data: newShareId, error: createError } = await supabase
        .rpc('create_shared_dues', { p_month: monthDate(month) })
      if (createError) throw createError
      if (typeof newShareId !== 'string') {
        throw new Error('Paylaşım bağlantısı oluşturulamadı.')
      }

      const shareUrl = new URL(window.location.href)
      shareUrl.searchParams.set('share', newShareId)
      shareWindow.location.replace(shareUrl.toString())
      setNotice(incompleteApartments.length > 0
        ? `Paylaşım yeni sekmede açıldı. Bilgisi girilmediği için listeye eklenmeyen daireler: ${incompleteApartments.join(', ')}.`
        : 'Paylaşım yeni sekmede açıldı.')
    } catch (shareCreateError) {
      shareWindow.close()
      setError(`Paylaşım oluşturulamadı: ${errorMessage(shareCreateError)}`)
    } finally {
      setSavingShare(false)
    }
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

  if (shareId) {
    if (!isSupabaseConfigured) {
      return <main className="share-shell"><p>Paylaşım görüntülenemiyor.</p></main>
    }
    if (shareLoading) {
      return <main className="share-shell"><p>Paylaşım yükleniyor…</p></main>
    }
    if (shareError) {
      return <main className="share-shell"><p role="alert">{shareError}</p></main>
    }
    return (
      <main className="share-shell">
        <h1>{monthLabel(sharedMonth)} aidat borç listesi</h1>
        {sharedDues.length === 0
          ? <p>Bu ay için girilmiş borç kaydı bulunmuyor.</p>
          : (
            <table className="share-table">
              <thead>
                <tr><th scope="col">Daire no</th><th scope="col">Güncel ayın aidat borcu</th></tr>
              </thead>
              <tbody>
                {sharedDues.map((row) => (
                  <tr key={row.apartment_number}>
                    <th scope="row">{row.apartment_number}</th>
                    <td>{formatMoney(Number(row.monthly_due))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </main>
    )
  }

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
          <h1>{isSignup ? 'Hesap oluşturun' : 'Hesabınıza giriş yapın'}</h1>
          <p>Daire, aidat ve sayaç bilgilerinize erişmek için giriş yapın.</p>
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

  if (accessLoading) {
    return <main className="app-shell auth-shell"><Brand /><div className="message-panel">Kullanıcı rolü yükleniyor…</div></main>
  }

  if (!access) {
    return (
      <main className="app-shell auth-shell">
        <Brand />
        <div className="message-panel">
          <h1>Erişim tanımlanmadı</h1>
          <p>{error || 'Bu hesap için yönetici tarafından bir rol atanması gerekiyor. Yönetici erişimi doğrulanmış onuratabay@hotmail.com hesabına tanımlıdır.'}</p>
          <button className="secondary-button" type="button" onClick={() => void handleSignOut()}>Çıkış yap</button>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell dashboard-shell">
      <header className="topbar">
        <Brand />
        <div className="user-actions">
          <span className="user-email">{session.user.email}</span>
          <span className="role-badge">{roleLabel(access.role)}</span>
          <button className="text-button signout-button" type="button" onClick={handleSignOut}>Çıkış</button>
        </div>
      </header>

      {!isConcierge && (
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
      )}

      {error && <div className="alert error-alert" role="alert">{error}</div>}
      {notice && <div className="alert success-alert" role="status">{notice}</div>}

      {access.role !== 'concierge' && (
        <section className="summary-grid" aria-label="Aylık özet">
          <SummaryCard label="Kayıtlı daire" value={String(apartments.length)} detail="Tüm daireler" />
          <SummaryCard label="Endeksi tamamlanan" value={`${totals.complete} / ${apartments.length}`} detail={monthLabel(month)} />
          <SummaryCard label="Toplam sıcak su" value={`${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(totals.consumption)} m³`} detail="Tamamlanan daireler" />
          <SummaryCard label="Tahmini toplam" value={formatMoney(totals.amount)} detail="Aidat + sıcak su" />
        </section>
      )}

      <div className="management-grid">
        {access.role !== 'concierge' && (
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
                  <label className="money-input"><span>₺</span><input aria-label={`${type} aylık aidat`} type="number" min="0" step="0.01" required disabled={!isManager} value={rates[type].dues} onChange={(event) => setRates((oldRates) => ({ ...oldRates, [type]: { ...oldRates[type], dues: event.target.value } }))} /></label>
                  <label className="money-input"><span>₺</span><input aria-label={`${type} sıcak su metreküp fiyatı`} type="number" min="0" step="0.01" required disabled={!isManager} value={rates[type].hotWater} onChange={(event) => setRates((oldRates) => ({ ...oldRates, [type]: { ...oldRates[type], hotWater: event.target.value } }))} /></label>
                </div>
              ))}
            </div>
            <p className="field-hint">Fiyatlar seçili aya kaydedilir; önceki ayların hesapları değişmez.</p>
            {isManager && <button className="primary-button" disabled={savingRates}>{savingRates ? 'Kaydediliyor…' : 'Fiyatları kaydet'}</button>}
          </form>
        </section>
        )}

        {isManager && (
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
        </section>
        )}
      </div>

      {isManager && (
        <section className="panel team-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">YÖNETİCİ PANELİ</span><h2>Kullanıcılar ve roller</h2></div>
            <div className="directory-heading-actions">
              <span className="panel-caption">{managedUsers.length} kayıtlı kullanıcı</span>
              <button className="secondary-button" type="button" disabled={usersLoading} onClick={() => void loadManagedUsers()}>
                {usersLoading ? 'Yenileniyor…' : 'Listeyi yenile'}
              </button>
            </div>
          </div>
          <label className="user-search">Kullanıcı ara
            <input
              type="search"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="E-posta adresine göre ara"
            />
          </label>
          <div className="user-directory-scroll">
            <table className="user-directory">
              <thead>
                <tr>
                  <th scope="col">E-posta</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Son giriş</th>
                  <th scope="col">Kayıt tarihi</th>
                </tr>
              </thead>
              <tbody>
                {managedUsers
                  .filter((user) => user.email.toLocaleLowerCase('tr').includes(userSearch.trim().toLocaleLowerCase('tr')))
                  .map((user) => (
                    <tr key={user.user_id}>
                      <th scope="row">{user.email}</th>
                      <td>
                        {user.role === 'manager'
                          ? <span className="role-badge">Yönetici</span>
                          : (
                            <select
                              aria-label={`${user.email} rolü`}
                              disabled={updatingUserId === user.user_id}
                              value={user.role ?? ''}
                              onChange={(event) => {
                                const value = event.target.value
                                void changeUserRole(
                                  user,
                                  value === '' ? null : value as Exclude<AppRole, 'manager'>,
                                )
                              }}
                            >
                              <option value="">Rol atanmamış</option>
                              <option value="accountant">Muhasebeci — görüntüleme</option>
                              <option value="concierge">Apartman görevlisi — endeks girişi</option>
                            </select>
                          )}
                      </td>
                      <td>{formatTimestamp(user.last_sign_in_at)}</td>
                      <td>{formatTimestamp(user.created_at)}</td>
                    </tr>
                  ))}
                {!usersLoading && managedUsers.length === 0 && (
                  <tr><td colSpan={4} className="directory-empty">Kayıtlı kullanıcı bulunamadı.</td></tr>
                )}
                {!usersLoading && managedUsers.length > 0
                  && managedUsers.filter((user) => user.email.toLocaleLowerCase('tr').includes(userSearch.trim().toLocaleLowerCase('tr'))).length === 0 && (
                    <tr><td colSpan={4} className="directory-empty">Aramanızla eşleşen kullanıcı bulunamadı.</td></tr>
                  )}
              </tbody>
            </table>
            {usersLoading && <p className="directory-loading">Kullanıcılar yükleniyor…</p>}
          </div>
          <p className="field-hint">Yalnızca kayıtlı hesaplar listelenir. Son giriş bilgisi, hesabın Supabase Authentication üzerinden son başarılı oturum açma zamanıdır. Yönetici rolü değiştirilemez.</p>
        </section>
      )}

      <section className="panel bulk-apartments-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">DAİRE VE SAYAÇ TAKİBİ</span><h2>1–46 daire listesi</h2></div>
          {isConcierge
            ? (
              <label className="table-month-picker">Dönem
                <input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} />
              </label>
            )
            : <span className="panel-caption">Endeksleri bu ay için girin · Tüketim farkı otomatik hesaplanır</span>}
        </div>
        <form className="bulk-apartment-form" onSubmit={addBulkApartments}>
          <div className="bulk-table-scroll">
            <table className="bulk-apartment-table">
              <thead>
                <tr>
                  <th scope="col">Daire no</th>
                  <th scope="col">Daire tipi</th>
                  <th scope="col">Önceki endeks</th>
                  <th scope="col">Son endeks</th>
                  {access.role !== 'concierge' && <th scope="col">Toplam güncel aidat</th>}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 46 }, (_, index) => {
                  const number = index + 1
                  const existingApartment = apartments.find((apartment) => apartment.unit_number === String(number))
                  const selectedType = bulkTypes[number] || existingApartment?.apartment_type || ''
                  const reading = bulkReadings[number] ?? { previous: '', current: '' }
                  const rate = selectedType ? rates[selectedType as ApartmentType] : null
                  const hasReadings = reading.previous.trim() !== '' && reading.current.trim() !== ''
                  const previousIndex = Number(reading.previous)
                  const currentIndex = Number(reading.current)
                  const totalDue = rate && hasReadings && currentIndex >= previousIndex
                    ? Number(rate.dues) + (currentIndex - previousIndex) * Number(rate.hotWater)
                    : null
                  return (
                    <tr key={number}>
                      <th scope="row">{number}</th>
                      <td>
                        <select
                          aria-label={`${number} numaralı dairenin tipi`}
                          disabled={!isManager}
                          value={selectedType}
                          onChange={(event) => setBulkTypes((types) => ({
                            ...types,
                            [number]: event.target.value as ApartmentType,
                          }))}
                        >
                          <option value="">Daire tipi seçin</option>
                          {apartmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`${number} numaralı dairenin önceki endeksi`}
                          type="number"
                          min="0"
                          step="0.001"
                          inputMode="decimal"
                          placeholder="Endeks"
                          disabled={access.role === 'accountant'}
                          value={reading.previous}
                          onChange={(event) => setBulkReadings((readings) => ({
                            ...readings,
                            [number]: { ...reading, previous: event.target.value },
                          }))}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${number} numaralı dairenin son endeksi`}
                          type="number"
                          min="0"
                          step="0.001"
                          inputMode="decimal"
                          placeholder="Endeks"
                          disabled={access.role === 'accountant'}
                          value={reading.current}
                          onChange={(event) => setBulkReadings((readings) => ({
                            ...readings,
                            [number]: { ...reading, current: event.target.value },
                          }))}
                        />
                      </td>
                      {access.role !== 'concierge' && <td className="bulk-dues-value">{totalDue === null ? '—' : formatMoney(totalDue)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="bulk-table-footer">
            <span>{access.role === 'concierge' ? 'Yalnızca sayaç endeksleri düzenlenebilir.' : access.role === 'accountant' ? 'Görüntüleme yetkisi — kayıtlar değiştirilemez.' : 'Toplam borç = aidat + sıcak su. Paylaşım bağlantısını açan herkes sabit listeyi görebilir.'}</span>
            {isManager && (
              <div className="bulk-footer-actions">
                <button className="secondary-button" type="submit" disabled={savingRates || savingBulkApartments || savingShare}>
                  {savingBulkApartments ? 'Kaydediliyor…' : 'Daire ve endeksleri kaydet'}
                </button>
                <button className="primary-button" type="button" disabled={savingRates || savingBulkApartments || savingShare} onClick={() => void createShare()}>
                  {savingShare ? 'Paylaşım hazırlanıyor…' : 'Listeyi paylaş'}
                </button>
              </div>
            )}
            {isConcierge && (
              <button className="primary-button" type="submit" disabled={savingBulkApartments}>
                {savingBulkApartments ? 'Endeksler kaydediliyor…' : 'Endeksleri kaydet'}
              </button>
            )}
          </div>
        </form>
      </section>
      {!isConcierge && <footer className="footer">Sayaç Takip <span>·</span> Aylık aidat ve sıcak su takibi</footer>}
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
