// Smoke test for tank flow: create tank product, recharge, deliver, and check summary
// Usage: ADMIN_TOKEN=<token> node scripts/smoke_tanks.js
async function run(){
  try{
    const base = process.env.BASE_URL || 'http://localhost:4000'
    let adminToken = process.env.ADMIN_TOKEN
    // support login with ADMIN_EMAIL + ADMIN_PASSWORD if token not provided
    if (!adminToken && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      console.log('Logging in with ADMIN_EMAIL...')
      const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) })
      if (!r.ok) throw new Error('Login failed for ADMIN_EMAIL: ' + r.status)
      const d = await r.json()
      adminToken = d.token
      console.log('Obtained token via login')
    }
    if (!adminToken) throw new Error('ADMIN_TOKEN env var is required for this smoke test (or provide ADMIN_EMAIL and ADMIN_PASSWORD)')
    console.log('Base URL:', base)

    const headers = { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }

    // 1) create tank product
    let res = await fetch(base + '/api/inventory', { method: 'POST', headers, body: JSON.stringify({ name: 'Smoke Test Tank', category: 'Llenado Tanque', unit: 'litro', quantity: 0, capacity: 100 }) })
    if (!res.ok) throw new Error('/api/inventory POST failed ' + res.status)
    const tank = await res.json()
    console.log('Created tank', tank._id)

    // 2) recharge tank (inventory movement in)
    res = await fetch(base + '/api/inventory/movements', { method: 'POST', headers, body: JSON.stringify({ product: tank._id, type: 'in', quantity: 80, notes: 'Smoke test recarga' }) })
    if (!res.ok) throw new Error('/api/inventory/movements POST failed ' + res.status)
    const move = await res.json()
    console.log('Created movement', move._id)

    // 3) get a house to deliver to
    res = await fetch(base + '/api/houses')
    const houses = await res.json()
    if (!houses.length) throw new Error('No houses available to deliver')
    const houseId = houses[0]._id
    console.log('Using house', houseId)

    // 4) create delivery: deliver 1 botellon (20L)
    res = await fetch(base + '/api/deliveries', { method: 'POST', headers, body: JSON.stringify({ houseId, count: 1, usedPrepaid: false }) })
    if (!res.ok) {
      const txt = await res.text().catch(()=>null)
      throw new Error('/api/deliveries POST failed ' + res.status + ' ' + txt)
    }
    const delivery = await res.json()
    console.log('Created delivery', delivery._id)

    // 5) check tanks summary
    res = await fetch(base + '/api/inventory/tanks/summary')
    if (!res.ok) throw new Error('/api/inventory/tanks/summary failed ' + res.status)
    const summary = await res.json()
    const my = summary.find(s => s.name === 'Smoke Test Tank')
    if (!my) throw new Error('Smoke Test Tank not found in summary')
    console.log('Tank summary after delivery:', my.quantity, 'L (pct', my.pct + '%)')

    // expected: initial 0 + 80 - 20 = 60
    if (Math.abs((my.quantity || 0) - 60) > 0.001) throw new Error('Unexpected tank quantity after delivery: ' + my.quantity)

    // cleanup: delete tank
    res = await fetch(base + '/api/inventory/' + tank._id, { method: 'DELETE', headers })
    if (!res.ok) console.warn('Warning: failed to delete smoke tank', res.status)

    console.log('Smoke tanks test finished successfully')
  }catch(err){ console.error('Smoke tanks error', err) }
}

run()
