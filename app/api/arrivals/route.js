import { NextResponse } from 'next/server'

const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_KEY

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const airport = searchParams.get('airport') || 'PVR'
  const limit = searchParams.get('limit') || '20'

  try {
    const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&arr_iata=${airport}&limit=${limit}&flight_status=active`
    const res = await fetch(url, { next: { revalidate: 300 } })
    const data = await res.json()

    if (!data.data) {
      return NextResponse.json({ error: 'No data', raw: data }, { status: 500 })
    }

    const flights = data.data.map(f => ({
      flight: f.flight?.iata || 'N/A',
      airline: f.airline?.name || '',
      origin: f.departure?.iata || '',
      originName: f.departure?.airport || '',
      status: f.flight_status || 'unknown',
      scheduled: f.arrival?.scheduled || null,
      estimated: f.arrival?.estimated || null,
      terminal: f.arrival?.terminal || null,
      gate: f.arrival?.gate || null,
      delay: f.arrival?.delay || 0,
    }))

    return NextResponse.json({
      airport,
      count: flights.length,
      flights,
      updated: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
