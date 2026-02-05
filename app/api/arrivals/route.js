import { NextResponse } from 'next/server'

const FLIGHTAWARE_KEY = process.env.FLIGHTAWARE_KEY
const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_KEY

function normalizeStatus(status) {
  if (!status) return 'unknown'
  const s = status.toLowerCase()
  if (s.includes('delay') || s.includes('late')) return 'delayed'
  if (s.includes('active') || s.includes('en-route') || s.includes('en route') || s.includes('airborne')) return 'active'
  if (s.includes('land') || s.includes('arriv')) return 'landed'
  if (s.includes('sched')) return 'scheduled'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('divert')) return 'diverted'
  return s
}

async function fetchFlightAwareArrivals(airport) {
  try {
    const url = `https://aeroapi.flightaware.com/aeroapi/airports/${airport}/flights/arrivals`
    const res = await fetch(url, {
      headers: { 'x-apikey': FLIGHTAWARE_KEY },
      next: { revalidate: 120 },
    })
    const data = await res.json()
    if (!data.arrivals || !data.arrivals.length) return null

    const flights = data.arrivals.map(f => ({
      flight: f.ident || 'N/A',
      airline: f.operator || '',
      origin: f.origin?.code_iata || f.origin?.code || '',
      originName: f.origin?.name || '',
      status: normalizeStatus(f.status),
      scheduled: f.scheduled_in || null,
      estimated: f.estimated_in || null,
      actual: f.actual_in || null,
      terminal: f.terminal_destination || null,
      gate: f.gate_destination || null,
      delay: f.arrival_delay ? Math.round(f.arrival_delay / 60) : 0,
      baggage: f.baggage_claim || null,
    }))

    return {
      airport,
      source: 'flightaware',
      count: flights.length,
      flights,
      updated: new Date().toISOString(),
    }
  } catch (e) {
    console.error('FlightAware arrivals error:', e.message)
    return null
  }
}

async function fetchAviationStackArrivals(airport, limit) {
  try {
    const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&arr_iata=${airport}&limit=${limit}&flight_status=active`
    const res = await fetch(url, { next: { revalidate: 300 } })
    const data = await res.json()
    if (!data.data) return null

    const flights = data.data.map(f => ({
      flight: f.flight?.iata || 'N/A',
      airline: f.airline?.name || '',
      origin: f.departure?.iata || '',
      originName: f.departure?.airport || '',
      status: normalizeStatus(f.flight_status),
      scheduled: f.arrival?.scheduled || null,
      estimated: f.arrival?.estimated || null,
      actual: f.arrival?.actual || null,
      terminal: f.arrival?.terminal || null,
      gate: f.arrival?.gate || null,
      delay: f.arrival?.delay || 0,
      baggage: null,
    }))

    return {
      airport,
      source: 'aviationstack',
      count: flights.length,
      flights,
      updated: new Date().toISOString(),
    }
  } catch (e) {
    console.error('AviationStack arrivals error:', e.message)
    return null
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const airport = searchParams.get('airport') || 'PVR'
  const limit = searchParams.get('limit') || '20'

  // FlightAware primary, AviationStack fallback
  const result = await fetchFlightAwareArrivals(airport) || await fetchAviationStackArrivals(airport, limit)

  if (!result) {
    return NextResponse.json({ error: 'No arrival data available', airport }, { status: 500 })
  }

  return NextResponse.json(result)
}
