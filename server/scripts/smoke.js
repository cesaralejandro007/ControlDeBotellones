// Simple smoke test script using global fetch (Node 18+)
async function run(){
  try{
    const base = process.env.BASE_URL || 'http://localhost:4000'
    console.log('Base URL:', base)
    const r1 = await fetch(base + '/')
    console.log('/', r1.status)
    const r2 = await fetch(base + '/api/reports/summary')
    console.log('/api/reports/summary', r2.status)
    const r3 = await fetch(base + '/api/inventory')
    console.log('/api/inventory', r3.status)
    const r4 = await fetch(base + '/api/inventory/tanks/summary')
    console.log('/api/inventory/tanks/summary', r4.status)
    console.log('Smoke test finished')
  }catch(err){ console.error('Smoke error', err) }
}

run()
