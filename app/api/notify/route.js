import { NextResponse } from 'next/server'

const FLIGHT_API_BASE = 'https://api.aviationstack.com/v1/flights'
const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_KEY
const EMAIL_SERVICE = 'https://email-service-pvrolomxs-projects.vercel.app/api/send'

export async function POST(request) {
  try {
    const body = await request.json()
    const { flight, guestName, property, email } = body

    if (!flight) {
      return NextResponse.json({ error: 'Missing flight parameter' }, { status: 400 })
    }

    const cleanFlight = flight.replace(/\s/g, '').toUpperCase()

    // Check flight status
    const res = await fetch(
      `${FLIGHT_API_BASE}?access_key=${AVIATIONSTACK_KEY}&flight_iata=${cleanFlight}&limit=1`
    )
    const data = await res.json()

    if (!data.data || !data.data[0]) {
      return NextResponse.json({ error: 'Flight not found', flight: cleanFlight }, { status: 404 })
    }

    const f = data.data[0]
    const status = f.flight_status || 'unknown'

    // If landed, send notification
    if (status === 'landed') {
      const emailBody = `
🛬 VUELO ATERRIZÓ — CASTLE SOLUTIONS

✈️ Vuelo: ${cleanFlight}
👤 Huésped: ${guestName || 'No especificado'}
🏠 Propiedad: ${property || 'No especificada'}

📍 Aeropuerto: ${f.arrival?.airport || 'PVR'}
⏰ Hora de aterrizaje: ${f.arrival?.actual || f.arrival?.estimated || 'N/A'}
🚪 Terminal: ${f.arrival?.terminal || 'N/A'}
🎒 Equipaje: ${f.arrival?.baggage || 'N/A'}

🔗 Rastreo: https://castle-flights.vercel.app?flight=${cleanFlight}

---
El huésped ya está en PVR. Coordina la recepción.
      `.trim()

      const notifyTo = email || 'reservations@castlesolutions.biz'

      try {
        await fetch(EMAIL_SERVICE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: notifyTo,
            subject: `🛬 Vuelo ${cleanFlight} aterrizó — ${guestName || 'Huésped'} llegó a PVR`,
            name: 'Castle Flights',
            message: emailBody,
          })
        })
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr.message)
      }

      return NextResponse.json({
        flight: cleanFlight,
        status: 'landed',
        notified: true,
        arrival: {
          airport: f.arrival?.airport,
          actual: f.arrival?.actual,
          terminal: f.arrival?.terminal,
          baggage: f.arrival?.baggage,
        }
      })
    }

    // Not landed yet
    return NextResponse.json({
      flight: cleanFlight,
      status,
      notified: false,
      message: `Flight status: ${status}. Notification will be sent when landed.`
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
