'use client'

import { useState, useEffect, useCallback } from 'react'

const TEXTS = {
  en: {
    title: 'Flight Tracker',
    subtitle: 'Real-time guest arrival tracking',
    search: 'Track Flight',
    placeholder: 'Flight number (e.g. AA1234)',
    tracking: 'Searching...',
    notFound: 'Flight not found. Check the number and try again.',
    status: { scheduled: 'Scheduled', active: 'In Flight', landed: 'Landed', cancelled: 'Cancelled', diverted: 'Diverted', delayed: 'Delayed', unknown: 'Unknown' },
    departure: 'Departure',
    arrival: 'Arrival',
    scheduled: 'Scheduled',
    estimated: 'Estimated',
    actual: 'Actual',
    terminal: 'Terminal',
    gate: 'Gate',
    baggage: 'Baggage',
    delay: 'Delay',
    minutes: 'min',
    source: 'Source',
    lastUpdate: 'Last update',
    autoRefresh: 'Auto-refresh',
    liveArrivals: 'PVR Live Arrivals',
    liveDesc: 'Flights arriving to Puerto Vallarta now',
    loadArrivals: 'Load PVR Arrivals',
    loading: 'Loading...',
    noArrivals: 'No active arrivals right now',
    from: 'from',
    eta: 'ETA',
    delayMin: 'min delay',
    onTime: 'On time',
    poweredBy: 'Powered by',
    madeWith: 'Made with',
    by: 'by',
    tabs: { track: '✈️ Track Flight', arrivals: '🛬 PVR Arrivals' },
  },
  es: {
    title: 'Rastreo de Vuelos',
    subtitle: 'Seguimiento de llegadas de huéspedes en tiempo real',
    search: 'Rastrear Vuelo',
    placeholder: 'Número de vuelo (ej. AA1234)',
    tracking: 'Buscando...',
    notFound: 'Vuelo no encontrado. Verifica el número e intenta de nuevo.',
    status: { scheduled: 'Programado', active: 'En Vuelo', landed: 'Aterrizó', cancelled: 'Cancelado', diverted: 'Desviado', delayed: 'Retrasado', unknown: 'Desconocido' },
    departure: 'Salida',
    arrival: 'Llegada',
    scheduled: 'Programado',
    estimated: 'Estimado',
    actual: 'Real',
    terminal: 'Terminal',
    gate: 'Puerta',
    baggage: 'Equipaje',
    delay: 'Retraso',
    minutes: 'min',
    source: 'Fuente',
    lastUpdate: 'Última actualización',
    autoRefresh: 'Auto-actualizar',
    liveArrivals: 'Llegadas PVR en Vivo',
    liveDesc: 'Vuelos llegando a Puerto Vallarta ahora',
    loadArrivals: 'Cargar Llegadas PVR',
    loading: 'Cargando...',
    noArrivals: 'No hay llegadas activas ahora',
    from: 'desde',
    eta: 'ETA',
    delayMin: 'min retraso',
    onTime: 'A tiempo',
    poweredBy: 'Impulsado por',
    madeWith: 'Hecho con',
    by: 'por',
    tabs: { track: '✈️ Rastrear Vuelo', arrivals: '🛬 Llegadas PVR' },
  }
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function timeUntil(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  const diff = d.getTime() - Date.now()
  if (diff < 0) return null
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function StatusBadge({ status, t }) {
  const label = t.status[status] || status
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium status-${status}`}>
      {status === 'active' && <span className="pulse-dot w-2 h-2 rounded-full bg-green-500 inline-block" />}
      {status === 'landed' && <span>🛬</span>}
      {status === 'scheduled' && <span>🕐</span>}
      {status === 'cancelled' && <span>❌</span>}
      {status === 'delayed' && <span>⚠️</span>}
      {status === 'diverted' && <span>↪️</span>}
      {label}
    </span>
  )
}

function ProgressBar({ progress, depIata, arrIata, status }) {
  return (
    <div className="my-6">
      <div className="flex justify-between text-sm mb-2">
        <span className="font-semibold text-castle-dark">{depIata}</span>
        <span className="font-semibold text-castle-dark">{arrIata}</span>
      </div>
      <div className="plane-track h-1.5 rounded-full" style={{ '--progress': `${progress}%` }}>
        {status === 'active' && (
          <div className="plane-icon text-xl" style={{ '--progress': `${progress}%`, left: `${progress}%` }}>✈️</div>
        )}
        {status === 'landed' && (
          <div className="plane-icon text-xl" style={{ '--progress': '100%', left: '100%' }}>🛬</div>
        )}
      </div>
      {status === 'active' && <p className="text-center text-xs text-gray-500 mt-2">{progress}% of route</p>}
    </div>
  )
}

function FlightCard({ flight, t }) {
  const eta = flight.arrival.estimated || flight.arrival.scheduled
  const remaining = timeUntil(eta)

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden fade-in border border-gray-100">
      {/* Header */}
      <div className="bg-castle-dark text-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-castle-gold text-sm font-medium">{flight.airline}</p>
            <h2 className="text-2xl font-bold font-serif tracking-wide">{flight.flight}</h2>
          </div>
          <StatusBadge status={flight.status} t={t} />
        </div>
        {remaining && flight.status === 'active' && (
          <div className="mt-3 bg-white/10 rounded-xl p-3 text-center">
            <p className="text-castle-gold text-xs uppercase tracking-wider">Arriving in</p>
            <p className="text-3xl font-bold font-serif">{remaining}</p>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="px-5 pt-2">
        <ProgressBar
          progress={flight.progress}
          depIata={flight.departure.iata}
          arrIata={flight.arrival.iata}
          status={flight.status}
        />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-100">
        {/* Departure */}
        <div className="bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t.departure}</p>
          <p className="font-semibold text-lg">{flight.departure.iata}</p>
          <p className="text-sm text-gray-600 mb-3">{flight.departure.airport}</p>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.scheduled}</span>
              <span>{formatTime(flight.departure.scheduled)}</span>
            </div>
            {flight.departure.actual && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.actual}</span>
                <span className="font-medium text-green-600">{formatTime(flight.departure.actual)}</span>
              </div>
            )}
            {flight.departure.terminal && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.terminal}</span>
                <span>{flight.departure.terminal}</span>
              </div>
            )}
            {flight.departure.gate && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.gate}</span>
                <span>{flight.departure.gate}</span>
              </div>
            )}
            {flight.departure.delay > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>{t.delay}</span>
                <span>{flight.departure.delay} {t.minutes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Arrival */}
        <div className="bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t.arrival}</p>
          <p className="font-semibold text-lg">{flight.arrival.iata}</p>
          <p className="text-sm text-gray-600 mb-3">{flight.arrival.airport}</p>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.scheduled}</span>
              <span>{formatTime(flight.arrival.scheduled)}</span>
            </div>
            {flight.arrival.estimated && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.estimated}</span>
                <span className="font-medium text-blue-600">{formatTime(flight.arrival.estimated)}</span>
              </div>
            )}
            {flight.arrival.actual && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.actual}</span>
                <span className="font-medium text-green-600">{formatTime(flight.arrival.actual)}</span>
              </div>
            )}
            {flight.arrival.terminal && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.terminal}</span>
                <span>{flight.arrival.terminal}</span>
              </div>
            )}
            {flight.arrival.gate && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.gate}</span>
                <span>{flight.arrival.gate}</span>
              </div>
            )}
            {flight.arrival.baggage && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.baggage}</span>
                <span>{flight.arrival.baggage}</span>
              </div>
            )}
            {flight.arrival.delay > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>{t.delay}</span>
                <span>{flight.arrival.delay} {t.minutes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
        <span>{t.source}: {flight.source}</span>
        <span>{formatDate(flight.arrival.scheduled)}</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [lang, setLang] = useState('es')
  const [tab, setTab] = useState('track')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [flight, setFlight] = useState(null)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [arrivals, setArrivals] = useState(null)
  const [arrivalsLoading, setArrivalsLoading] = useState(false)
  const [source, setSource] = useState('aviationstack')

  const t = TEXTS[lang]

  const searchFlight = useCallback(async (flightNum) => {
    const q = (flightNum || query).trim().replace(/\s/g, '').toUpperCase()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/flight?flight=${q}&source=${source}`)
      if (!res.ok) {
        setFlight(null)
        setError(t.notFound)
      } else {
        const data = await res.json()
        setFlight(data)
        setError(null)
      }
    } catch {
      setError(t.notFound)
    }
    setLoading(false)
  }, [query, source, t.notFound])

  useEffect(() => {
    if (!autoRefresh || !flight) return
    const interval = setInterval(() => searchFlight(flight.flight), 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, flight, searchFlight])

  const loadArrivals = async () => {
    setArrivalsLoading(true)
    try {
      const res = await fetch('/api/arrivals?airport=PVR&limit=15')
      const data = await res.json()
      setArrivals(data)
    } catch {
      setArrivals({ flights: [] })
    }
    setArrivalsLoading(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    searchFlight()
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-castle-dark text-white">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Castle Solutions" className="h-10 w-10 rounded-lg" />
              <div>
                <h1 className="text-xl font-bold font-serif tracking-wide">Castle Flights</h1>
                <p className="text-xs text-gray-400">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
                className="text-lg hover:scale-110 transition-transform"
              >
                {lang === 'es' ? '🇲🇽' : '🇺🇸'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-castle-dark border-t border-white/10">
        <div className="max-w-2xl mx-auto px-4 flex">
          {['track', 'arrivals'].map(id => (
            <button
              key={id}
              onClick={() => { setTab(id); if (id === 'arrivals' && !arrivals) loadArrivals() }}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
                tab === id ? 'border-castle-gold text-castle-gold' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.tabs[id]}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Track Flight Tab */}
        {tab === 'track' && (
          <div>
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t.placeholder}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-lg focus:outline-none focus:ring-2 focus:ring-castle-gold focus:border-transparent font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-6 py-3 bg-castle-gold text-white rounded-xl font-medium hover:bg-castle-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '...' : '🔍'}
                </button>
              </div>

              {/* Source toggle */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="source" value="aviationstack" checked={source === 'aviationstack'} onChange={() => setSource('aviationstack')} className="accent-castle-gold" />
                    AviationStack
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="source" value="flightaware" checked={source === 'flightaware'} onChange={() => setSource('flightaware')} className="accent-castle-gold" />
                    FlightAware
                  </label>
                </div>
                {flight && (
                  <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-castle-gold" />
                    {t.autoRefresh}
                  </label>
                )}
              </div>
            </form>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-xl p-4 mb-6 text-center fade-in">{error}</div>
            )}

            {flight && <FlightCard flight={flight} t={t} />}

            {!flight && !error && !loading && (
              <div className="text-center py-16 fade-in">
                <p className="text-6xl mb-4">🛫</p>
                <p className="text-gray-500">{t.placeholder}</p>
              </div>
            )}
          </div>
        )}

        {/* Arrivals Tab */}
        {tab === 'arrivals' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif font-semibold text-castle-dark">{t.liveArrivals}</h2>
              <p className="text-sm text-gray-500">{t.liveDesc}</p>
            </div>

            {arrivalsLoading && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3 animate-bounce">🛬</p>
                <p className="text-gray-500">{t.loading}</p>
              </div>
            )}

            {arrivals && arrivals.flights && arrivals.flights.length === 0 && (
              <div className="text-center py-12 text-gray-500">{t.noArrivals}</div>
            )}

            {arrivals && arrivals.flights && arrivals.flights.length > 0 && (
              <div className="space-y-3">
                {arrivals.flights.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(f.flight); setTab('track'); searchFlight(f.flight) }}
                    className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left fade-in border border-gray-100"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold font-mono text-castle-dark">{f.flight}</p>
                        <p className="text-sm text-gray-500">{f.airline} · {t.from} {f.origin}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatTime(f.estimated || f.scheduled)}</p>
                        {f.delay > 0 ? (
                          <p className="text-xs text-orange-600">+{f.delay} {t.delayMin}</p>
                        ) : (
                          <p className="text-xs text-green-600">{t.onTime}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!arrivals && !arrivalsLoading && (
              <div className="text-center py-12">
                <button
                  onClick={loadArrivals}
                  className="px-6 py-3 bg-castle-gold text-white rounded-xl font-medium hover:bg-castle-gold/90 transition-colors"
                >
                  {t.loadArrivals}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 text-center">
        <img src="/logo.png" alt="Castle Solutions" className="h-8 mx-auto mb-3 opacity-40" />
        <p className="text-xs text-gray-400">{t.poweredBy} AviationStack + FlightAware</p>
        <p className="text-xs text-gray-400 mt-1">
          {t.madeWith} ❤️ {t.by} <span className="text-castle-gold font-medium">duendes.app</span> — 2026
        </p>
      </footer>
    </div>
  )
}
