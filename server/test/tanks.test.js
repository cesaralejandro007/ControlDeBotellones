const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryReplSet } = require('mongodb-memory-server')
const app = require('../app')

let mongod
let adminToken

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  const uri = mongod.getUri()
  await mongoose.connect(uri)
  // create a shared admin for tests
  const admin = { name: 'Shared Admin', email: 'shared-admin@example.com', password: 'secret' }
  await request(app).post('/api/auth/register').send(admin).expect(200)
  const login = await request(app).post('/api/auth/login').send({ email: admin.email, password: admin.password }).expect(200)
  adminToken = login.body.token
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

test('tank flow: recarga -> entrega -> resumen', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }

  // create a house
  const houseRes = await request(app).post('/api/houses').set(auth).send({ code: 'P-TEST', number: 'Test', ownerName: 'Tester', address: 'Calle Falsa 123' }).expect(200)
  const houseId = houseRes.body._id

  // create tank via tank route (product + tank)
  const createRes = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Test Tank', capacity: 100, pricePerFill: 12 }).expect(200)
  const tankId = createRes.body.tank._id
  const productId = createRes.body.product._id

  // recharge tank 80L (via tanks recharge)
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 80 }).expect(200)

  // fill 1 bottle -> consumes 20L and creates a pending payment (pricePerFill=12)
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)

  // summary
  const sumRes = await request(app).get('/api/inventory/tanks/summary').set(auth).expect(200)
  const found = sumRes.body.find(t => t.name === 'Test Tank')
  expect(found).toBeDefined()
  expect(found.quantity).toBeCloseTo(60)

  // verify pending payment was created for the tank fill
  const paymentsRes = await request(app).get('/api/payments').set(auth).expect(200)
  const p = paymentsRes.body.find(pay => pay.description && pay.description.includes('llenado')) || paymentsRes.body.find(pay => pay.description && pay.description.includes('Deuda por llenado'))
  // It's a pending payment (confirmed false) and amount equals pricePerFill (12)
  expect(p).toBeDefined()
  expect(p.confirmed).toBe(false)
  expect(p.amount).toBeCloseTo(12)

  // Now create a delivery via the /api/deliveries endpoint and verify it consumes liters based on litersPerBottle
  const deliveryRes = await request(app).post('/api/deliveries').set(auth).send({ house: houseId, count: 2, usedPrepaid: false }).expect(200)
  // litersPerBottle was default (20) for this tank; liters used expected 40
  expect(deliveryRes.body.litersUsed).toBe(40)
  // payment created: pricePerFill=12 * 2 = 24
  const p2 = await request(app).get('/api/payments').set(auth).expect(200)
  const foundPending24 = p2.body.find(pay => !pay.confirmed && Math.abs(pay.amount - 24) < 0.001)
  expect(foundPending24).toBeDefined()
  // verify tank liters reduced by 40 more -> previous 60 -> now 20
  const tanksRes2 = await request(app).get('/api/inventory/tanks/summary').set(auth).expect(200)
  const foundTank2 = tanksRes2.body.find(t => t.name === 'Test Tank')
  expect(foundTank2.quantity).toBeCloseTo(20)
})

test('sale of physical botellones decrements inventory and does not consume tank liters', async () => {
  // create and login admin
  const auth = { Authorization: `Bearer ${adminToken}` }

  // create product of botellones (empties)
  const prodRes = await request(app).post('/api/inventory').set(auth).send({ name: 'Botellón vacío', category: 'Botellones', unit: 'unidad', quantity: 10, price: 5 }).expect(200)
  const prodId = prodRes.body._id

  // create tank product too
  const createRes = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Tank 2', capacity: 100, pricePerFill: 12 }).expect(200)
  const tankId = createRes.body.tank._id
  // recharge tank 50L
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 50 }).expect(200)

  // sell 2 botellones (physically empty ones for client purchase)
  await request(app).post('/api/sales').set(auth).send({ productId: prodId, quantity: 2, amount: 10, notes: 'Venta al público' }).expect(200)

  // check product qty is now 8
  const inv = await request(app).get('/api/inventory').set(auth).expect(200)
  const p = inv.body.find(it => it._id === prodId)
  expect(p).toBeDefined()
  expect(p.quantity).toBe(8)

  // ensure tank liters still 50 (not consumed by sale)
  const tanksRes = await request(app).get('/api/inventory/tanks/summary').set(auth).expect(200)
  const foundTank = tanksRes.body.find(t => t.id === tankId)
  expect(foundTank).toBeDefined()
  expect(foundTank.quantity).toBeCloseTo(50)
})
