import { isSupabaseConfigured } from './lib/supabase'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Sayaç Takip ana sayfa">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4.5 18.5V14m5 4.5V9m5 9.5V5m5 13.5v-7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>Sayaç Takip</span>
        </a>
        <span className={`connection-pill ${isSupabaseConfigured ? 'is-connected' : ''}`}>
          <span className="connection-dot" />
          {isSupabaseConfigured ? 'Supabase hazır' : 'Kurulum bekleniyor'}
        </span>
      </header>

      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <span className="eyebrow">KONTROL PANELİ</span>
          <h1 id="welcome-title">Sayaçlarınız için<br />tek bir yer.</h1>
          <p>
            Sayaç takip uygulamanızın başlangıç noktası hazır. İhtiyaçlarınızı
            paylaştığınızda ekranları ve özellikleri birlikte şekillendirebiliriz.
          </p>
          {!isSupabaseConfigured && (
            <div className="setup-note">
              <span className="note-icon" aria-hidden="true">i</span>
              <span>
                Supabase bağlantısı için proje bilgilerini <code>.env.local</code>{' '}
                dosyasına ekleyin.
              </span>
            </div>
          )}
        </div>
        <div className="meter-illustration" aria-hidden="true">
          <div className="meter-glow" />
          <div className="meter-card">
            <div className="meter-card-top">
              <span className="meter-label">SAYAÇ</span>
              <span className="meter-menu">•••</span>
            </div>
            <div className="meter-display">
              <span>000</span>
              <span className="meter-decimal">.00</span>
            </div>
            <div className="meter-unit">ÖLÇÜM DEĞERİ</div>
            <div className="meter-chart">
              <span style={{ height: '35%' }} />
              <span style={{ height: '53%' }} />
              <span style={{ height: '44%' }} />
              <span style={{ height: '68%' }} />
              <span style={{ height: '58%' }} />
              <span style={{ height: '82%' }} />
              <span style={{ height: '73%' }} />
              <span style={{ height: '100%' }} />
            </div>
            <div className="chart-labels"><span>BAŞLANGIÇ</span><span>BUGÜN</span></div>
          </div>
          <span className="floating-spark spark-one">✳</span>
          <span className="floating-spark spark-two">✳</span>
        </div>
      </section>

      <section className="content-section" aria-labelledby="meters-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GENEL BAKIŞ</span>
            <h2 id="meters-title">Sayaçlarım</h2>
          </div>
          <span className="count-badge">0 sayaç</span>
        </div>
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5 19V12m7 7V5m7 14v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <h3>Takip edilecek sayaç yok</h3>
          <p>Uygulamanın detaylarını belirlediğimizde sayaçlarınız burada görünecek.</p>
        </div>
      </section>
      <footer className="footer">Sayaç Takip <span>·</span> Başlangıç sürümü</footer>
    </main>
  )
}

export default App
