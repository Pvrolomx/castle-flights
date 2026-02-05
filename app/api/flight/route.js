import { NextResponse } from 'next/server'

const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_KEY
const FLIGHTAWARE_KEY = process.env.FLIGHTAWARE_KEY

function normalizeStatus(status, depDelay, arrDelay) {
  if (!status) return 'unknown'
  const s = status.toLowerCase()
  // Check delay first — some APIs say "scheduled" even when delayed
  if ((depDelay && depDelay > 15) || s.includes('delay') || s.includes('departing late') || s.includes('late')) return 'delayed'
  if (s.includes('sched')) return 'scheduled'
  if (s.includes('active') || s.includes('en-route') || s.includes('en route') || s.includes('airborne')) return 'active'
  if (s.includes('land')) return 'landed'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('divert')) return 'diverted'
  return s
}

function calcDelay(scheduled, estimated) {
  if (!scheduled || !estimated) return 0
  const schedTime = new Date(scheduled).getTime()
  const estTime = new Date(estimated).getTime()
  if (isNaN(schedTime) || isNaN(estTime)) return 0
  const diffMin = Math.round((estTime - schedTime) / 60000)
  return diffMin > 0 ? diffMin : 0
}

function calcProgress(dep, arr, status) {
  if (status === 'landed') return 100
  if (status === 'scheduled' || status === 'delayed') return 0
  if (status === 'cancelled') return 0
  if (!dep || !arr) return 50
  const now = Date.now()
  const depTime = new Date(dep).getTime()
  const arrTime = new Date(arr).getTime()
  if (isNaN(depTime) || isNaN(arrTime) || arrTime <= depTime) return 50
  const progress = ((now - depTime) / (arrTime - depTime)) * 100
  return Math.max(0, Math.min(99, Math.round(progress)))
}

function getTodayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const { start, end } = getTodayRange()
  // Allow window: yesterday 6pm to tomorrow 6am for timezone flexibility
  const flexStart = new Date(start.getTime() - 6 * 3600000)
  const flexEnd = new Date(end.getTime() + 6 * 3600000)
  return d >= flexStart && d <= flexEnd
}

async function fetchAviationStack(flightIata) {
  try {
    const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&flight_iata=${flightIata}&limit=5`
    const res = await fetch(url, { next: { revalidate: 60 } })
    const data = await res.json()
    if (!data.data || !data.data.length) return null
    
    // Prefer today's flight
    const todayFlight = data.data.find(f => isToday(f.departure?.scheduled)) || data.data[0]
    const f = todayFlight
    
    // Calculate delay from estimated vs scheduled if API doesn't report it
    const depDelay = f.departure?.delay || calcDelay(f.departure?.scheduled, f.departure?.estimated)
    const arrDelay = f.arrival?.delay || calcDelay(f.arrival?.scheduled, f.arrival?.estimated)
    
    const status = normalizeStatus(f.flight_status, depDelay, arrDelay)
    
    return {
      source: 'aviationstack',
      flight: f.flight?.iata || flightIata,
      airline: f.airline?.name || '',
      airlineLogo: null,
      status,
      departure: {
        airport: f.departure?.airport || '',
        iata: f.departure?.iata || '',
        scheduled: f.departure?.scheduled || null,
        estimated: f.departure?.estimated || f.departure?.scheduled || null,
        actual: f.departure?.actual || null,
        terminal: f.departure?.terminal || null,
        gate: f.departure?.gate || null,
        delay: depDelay,
      },
      arrival: {
        airport: f.arrival?.airport || '',
        iata: f.arrival?.iata || '',
        scheduled: f.arrival?.scheduled || null,
        estimated: f.arrival?.estimated || f.arrival?.scheduled || null,
        actual: f.arrival?.actual || null,
        terminal: f.arrival?.terminal || null,
        gate: f.arrival?.gate || null,
        delay: arrDelay,
        baggage: f.arrival?.baggage || null,
      },
      progress: calcProgress(
        f.departure?.actual || f.departure?.estimated || f.departure?.scheduled,
        f.arrival?.estimated || f.arrival?.scheduled,
        status
      ),
      live: f.live ? { lat: f.live.latitude, lng: f.live.longitude, alt: f.live.altitude, speed: f.live.speed_horizontal } : null,
      updated: new Date().toISOString(),
    }
  } catch (e) {
    console.error('AviationStack error:', e.message)
    return null
  }
}

async function fetchFlightAware(flightId) {
  try {
    const ident = flightId.replace(/\s/g, '').toUpperCase()
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${ident}`
    const res = await fetch(url, {
      headers: { 'x-apikey': FLIGHTAWARE_KEY },
      next: { revalidate: 60 },
    })
    const data = await res.json()
    if (!data.flights || !data.flights.length) return null
    
    // Find today's flight — prefer active/delayed over scheduled
    const todayFlights = data.flights.filter(f => isToday(f.scheduled_out || f.scheduled_off))
    const f = todayFlights.find(fl => {
      const s = (fl.status || '').toLowerCase()
      return s.includes('active') || s.includes('en route') || s.includes('delay') || s.includes('late')
    }) || todayFlights[0] || data.flights[0]
    
    const depDelayRaw = f.departure_delay ? Math.round(f.departure_delay / 60) : 0
    const depDelay = depDelayRaw || calcDelay(f.scheduled_out, f.estimated_out)
    const arrDelayRaw = f.arrival_delay ? Math.round(f.arrival_delay / 60) : 0
    const arrDelay = arrDelayRaw || calcDelay(f.scheduled_in, f.estimated_in)
    
    const status = normalizeStatus(f.status, depDelay, arrDelay)
    
    return {
      source: 'flightaware',
      flight: f.ident || flightId,
      airline: f.operator || '',
      airlineLogo: null,
      status,
      departure: {
        airport: f.origin?.name || '',
        iata: f.origin?.code_iata || f.origin?.code || '',
        scheduled: f.scheduled_out || null,
        estimated: f.estimated_out || f.scheduled_out || null,
        actual: f.actual_out || null,
        terminal: f.terminal_origin || null,
        gate: f.gate_origin || null,
        delay: depDelay,
      },
      arrival: {
        airport: f.destination?.name || '',
        iata: f.destination?.code_iata || f.destination?.code || '',
        scheduled: f.scheduled_in || null,
        estimated: f.estimated_in || f.scheduled_in || null,
        actual: f.actual_in || null,
        terminal: f.terminal_destination || null,
        gate: f.gate_destination || null,
        delay: arrDelay,
        baggage: f.baggage_claim || null,
      },
      progress: calcProgress(
        f.actual_off || f.actual_out || f.estimated_out || f.scheduled_out,
        f.estimated_in || f.scheduled_in,
        status
      ),
      live: f.last_position ? { lat: f.last_position.latitude, lng: f.last_position.longitude, alt: f.last_position.altitude, speed: f.last_position.groundspeed } : null,
      updated: new Date().toISOString(),
    }
  } catch (e) {
    console.error('FlightAware error:', e.message)
    return null
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const flight = searchParams.get('flight')
  const source = searchParams.get('source')

  if (!flight) {
    return NextResponse.json({ error: 'Missing flight parameter' }, { status: 400 })
  }

  const cleanFlight = flight.replace(/\s/g, '').toUpperCase()

  // If specific source requested, use that with fallback
  if (source === 'flightaware') {
    const result = await fetchFlightAware(cleanFlight) || await fetchAviationStack(cleanFlight)
    if (!result) return NextResponse.json({ error: 'Flight not found', flight: cleanFlight }, { status: 404 })
    return NextResponse.json(result)
  }
  if (source === 'aviationstack') {
    const result = await fetchAviationStack(cleanFlight) || await fetchFlightAware(cleanFlight)
    if (!result) return NextResponse.json({ error: 'Flight not found', flight: cleanFlight }, { status: 404 })
    return NextResponse.json(result)
  }

  // Default: query BOTH sources in parallel, pick the one with more info
  const [asResult, faResult] = await Promise.all([
    fetchAviationStack(cleanFlight),
    fetchFlightAware(cleanFlight),
  ])

  if (!asResult && !faResult) {
    return NextResponse.json({ error: 'Flight not found', flight: cleanFlight }, { status: 404 })
  }

  // Score each result — prefer the one with delay info, live data, actual times
  function score(r) {
    if (!r) return -1
    let s = 0
    if (r.status === 'delayed' || r.status === 'active') s += 10
    if (r.departure.delay > 0) s += 5
    if (r.departure.actual) s += 3
    if (r.departure.estimated && r.departure.estimated !== r.departure.scheduled) s += 3
    if (r.arrival.estimated && r.arrival.estimated !== r.arrival.scheduled) s += 3
    if (r.live) s += 5
    if (r.departure.gate) s += 1
    if (r.departure.terminal) s += 1
    if (r.arrival.terminal) s += 1
    if (r.arrival.baggage) s += 1
    return s
  }

  const result = score(faResult) >= score(asResult) ? faResult : asResult
  return NextResponse.json(result)
}
