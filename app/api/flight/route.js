import { NextResponse } from 'next/server'

const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_KEY
const FLIGHTAWARE_KEY = process.env.FLIGHTAWARE_KEY

function normalizeStatus(status) {
  if (!status) return 'unknown'
  const s = status.toLowerCase()
  if (s.includes('sched')) return 'scheduled'
  if (s.includes('active') || s.includes('en-route') || s.includes('en route') || s.includes('airborne')) return 'active'
  if (s.includes('land')) return 'landed'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('divert')) return 'diverted'
  if (s.includes('delay')) return 'delayed'
  return s
}

function calcProgress(dep, arr, status) {
  if (status === 'landed') return 100
  if (status === 'scheduled') return 0
  if (status === 'cancelled') return 0
  if (!dep || !arr) return 50
  const now = Date.now()
  const depTime = new Date(dep).getTime()
  const arrTime = new Date(arr).getTime()
  if (isNaN(depTime) || isNaN(arrTime) || arrTime <= depTime) return 50
  const progress = ((now - depTime) / (arrTime - depTime)) * 100
  return Math.max(0, Math.min(99, Math.round(progress)))
}

async function fetchAviationStack(flightIata) {
  try {
    const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&flight_iata=${flightIata}&limit=1`
    const res = await fetch(url, { next: { revalidate: 120 } })
    const data = await res.json()
    if (!data.data || !data.data[0]) return null
    const f = data.data[0]
    const status = normalizeStatus(f.flight_status)
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
        estimated: f.departure?.estimated || null,
        actual: f.departure?.actual || null,
        terminal: f.departure?.terminal || null,
        gate: f.departure?.gate || null,
        delay: f.departure?.delay || 0,
      },
      arrival: {
        airport: f.arrival?.airport || '',
        iata: f.arrival?.iata || '',
        scheduled: f.arrival?.scheduled || null,
        estimated: f.arrival?.estimated || null,
        actual: f.arrival?.actual || null,
        terminal: f.arrival?.terminal || null,
        gate: f.arrival?.gate || null,
        delay: f.arrival?.delay || 0,
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
      next: { revalidate: 120 },
    })
    const data = await res.json()
    if (!data.flights || !data.flights[0]) return null
    const f = data.flights[0]
    const status = normalizeStatus(f.status)
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
        estimated: f.estimated_out || null,
        actual: f.actual_out || null,
        terminal: f.terminal_origin || null,
        gate: f.gate_origin || null,
        delay: f.departure_delay || 0,
      },
      arrival: {
        airport: f.destination?.name || '',
        iata: f.destination?.code_iata || f.destination?.code || '',
        scheduled: f.scheduled_in || null,
        estimated: f.estimated_in || null,
        actual: f.actual_in || null,
        terminal: f.terminal_destination || null,
        gate: f.gate_destination || null,
        delay: f.arrival_delay || 0,
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
  const source = searchParams.get('source') || 'aviationstack'

  if (!flight) {
    return NextResponse.json({ error: 'Missing flight parameter' }, { status: 400 })
  }

  const cleanFlight = flight.replace(/\s/g, '').toUpperCase()

  let result = null
  if (source === 'flightaware') {
    result = await fetchFlightAware(cleanFlight)
    if (!result) result = await fetchAviationStack(cleanFlight)
  } else {
    result = await fetchAviationStack(cleanFlight)
    if (!result) result = await fetchFlightAware(cleanFlight)
  }

  if (!result) {
    return NextResponse.json({ error: 'Flight not found', flight: cleanFlight }, { status: 404 })
  }

  return NextResponse.json(result)
}
