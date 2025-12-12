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
  const admin = { name: 'Payments Admin', email: 'payments-admin@example.com', password: 'secret' }
  await request(app).post('/api/auth/register').send(admin).expect(200)
  const login = await request(app).post('/api/auth/login').send({ email: admin.email, password: admin.password }).expect(200)
  adminToken = login.body.token
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

test('prepaid balance must be confirmed before using', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }
  const house = await request(app).post('/api/houses').set(auth).send({ code: 'P-PP', number: '1', ownerName: 'X', address: 'A' }).expect(200)
  const houseId = house.body._id
  // create botellones product and tank product for delivery
  const bot = await request(app).post('/api/inventory').set(auth).send({ name: 'Bot', category: 'Botellones', unit: 'unidad', quantity: 5, price: 10 }).expect(200)
  const tank = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Tank P', capacity: 100, pricePerFill: 15 }).expect(200)
  const tankId = tank.body.tank._id
  // recharge
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 80 }).expect(200)

  // create an unconfirmed payment with prepaidBotellones
  const payUn = await request(app).post('/api/payments').set(auth).send({ house: houseId, amount: 0, prepaidBotellones: 1, confirmed: false }).expect(200)

  // attempt to use prepaid for delivery should fail because not confirmed
  await request(app).post('/api/deliveries').set(auth).send({ house: houseId, count: 1, usedPrepaid: true }).expect(400)
  // same test for tank fill endpoint also must fail
  const tankFillFail = await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: true })
  expect(tankFillFail.status).toBe(400)

  // confirm the payment
  const toggle = await request(app).put(`/api/payments/${payUn.body._id}/confirm`).set(auth).expect(200)
  expect(toggle.body.confirmed).toBe(true)

  // now use prepaid for tank fill should succeed (consume the prepaid)
  const tankFillOk = await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: true }).expect(200)
  expect(tankFillOk.body.movement).toBeDefined()
  // After the tank fill consumed the prepaid, another delivery with usedPrepaid should fail due to no balance
  await request(app).post('/api/deliveries').set(auth).send({ house: houseId, count: 1, usedPrepaid: true }).expect(400)
})

test('confirming a payment settles pending debts', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }
  const house = await request(app).post('/api/houses').set(auth).send({ code: 'P-CT', number: '2', ownerName: 'Y', address: 'B' }).expect(200)
  const houseId = house.body._id
  // create tank and recharge
  const tank = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Tank CT', capacity: 100, pricePerFill: 9 }).expect(200)
  const tankId = tank.body.tank._id
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 80 }).expect(200)

  // create a delivery -> pending payment
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)
  const paymentsBefore = await request(app).get('/api/payments').set(auth).expect(200)
  const pending = paymentsBefore.body.find(p => !p.confirmed && !p.settled)
  expect(pending).toBeDefined()

  // create a manual payment that should cover the pending debt (unconfirmed initially)
  const cover = await request(app).post('/api/payments').set(auth).send({ house: houseId, amount: pending.amount, prepaidBotellones: 0, confirmed: false }).expect(200)

  // confirm this payment (via endpoint) -> then explicitly apply it to pending debts
  const toggle = await request(app).put(`/api/payments/${cover.body._id}/confirm`).set(auth).expect(200)
  expect(toggle.body.confirmed).toBe(true)
  // apply it to oldest pending debts
  const applyRes = await request(app).post(`/api/payments/${cover.body._id}/apply`).set(auth).send({ applyToOldest: true })
    console.log('DEBUG applyRes', applyRes.status, applyRes.body)
  expect(applyRes.status).toBe(200)
  // pending debt should be gone
  const paymentsAfter = await request(app).get('/api/payments').set(auth).expect(200)
  const stillPending = paymentsAfter.body.find(p => !p.settled && p._id === pending._id)
  expect(stillPending).toBeUndefined()
  // and the original pending payment should now be marked as settled but not confirmed
  const settled = paymentsAfter.body.find(p => p._id === pending._id)
  expect(settled.settled).toBe(true)
  expect(settled.confirmed).toBe(false)
  expect(String(settled.settledBy)).toBe(String(cover.body._id))
})

test('payments via houses pay are applied to pending debts', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }
  const house = await request(app).post('/api/houses').set(auth).send({ code: 'P-HPAY', number: '3', ownerName: 'Z', address: 'C' }).expect(200)
  const houseId = house.body._id
  const tank = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Tank HP', capacity: 100, pricePerFill: 7 }).expect(200)
  const tankId = tank.body.tank._id
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 80 }).expect(200)

  // create a delivery -> pending payment
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 2, usedPrepaid: false }).expect(200)
  const paymentsBefore = await request(app).get('/api/payments').set(auth).expect(200)
  const pending = paymentsBefore.body.find(p => !p.confirmed && !p.settled)
  expect(pending).toBeDefined()

    // pay via house pay and apply to oldest pending using atomic targets option
    const pay = await request(app).post(`/api/houses/${houseId}/pay`).set(auth).send({ amount: pending.amount, description: 'Pago por deuda', targets: [{ id: pending._id, amount: pending.amount }] }).expect(200)
    // The pay endpoint already applied it; no need to call apply separately
  // verify pending payment is settled
  const paymentsAfter = await request(app).get('/api/payments').set(auth).expect(200)
  const stillPending = paymentsAfter.body.find(p => !p.settled && p._id === pending._id)
  expect(stillPending).toBeUndefined()
})

test('creating a payment (POST /api/payments) with targets applies to pending debts', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }
  const house = await request(app).post('/api/houses').set(auth).send({ code: 'P-PP2', number: '7', ownerName: 'D', address: 'G' }).expect(200)
  const houseId = house.body._id
  const tank = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Tank P2', capacity: 100, pricePerFill: 13 }).expect(200)
  const tankId = tank.body.tank._id
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 80 }).expect(200)

  // create a delivery -> pending payment
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)
  const paymentsBefore = await request(app).get('/api/payments').set(auth).expect(200)
  const pending = paymentsBefore.body.find(p => !p.confirmed && !p.settled)
  expect(pending).toBeDefined()

  // create payment POST with targets and confirmed true
  const create = await request(app).post('/api/payments').set(auth).send({ house: houseId, amount: pending.amount, prepaidBotellones: 0, confirmed: true, targets: [{ id: pending._id, amount: pending.amount }] }).expect(200)
  expect(create.body._id).toBeDefined()
  // check applied amount and that the pending is settled
  const paymentsAfter = await request(app).get('/api/payments').set(auth).expect(200)
  const stillPending = paymentsAfter.body.find(p => !p.settled && p._id === pending._id)
  expect(stillPending).toBeUndefined()
  const settled = paymentsAfter.body.find(p => p._id === pending._id)
  expect(settled.settled).toBe(true)
  expect(settled.settledBy).toBeDefined()
})

test('pay selected pending debts via house pay and apply', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }
  const house = await request(app).post('/api/houses').set(auth).send({ code: 'P-SEL', number: '4', ownerName: 'Sel', address: 'D' }).expect(200)
  const houseId = house.body._id
  const tank = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Tank SEL', capacity: 100, pricePerFill: 11 }).expect(200)
  const tankId = tank.body.tank._id
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 80 }).expect(200)

  // create two deliveries -> two pending payments
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)
  const paymentsBefore = await request(app).get('/api/payments').set(auth).expect(200)
  const pendings = paymentsBefore.body.filter(p => !p.confirmed && !p.settled && String(p.house && p.house._id ? p.house._id : p.house) === String(houseId))
  expect(pendings.length).toBeGreaterThanOrEqual(2)
  const [one, two] = pendings

  // pay only the first pending debt via house pay using atomic targets
  const pay = await request(app).post(`/api/houses/${houseId}/pay`).set(auth).send({ amount: one.amount, description: 'Pago parcial', targets: [{ id: one._id, amount: one.amount }] }).expect(200)
  // ensure appliedAmount on created payment equals applied amount
  expect(pay.body.payment.appliedAmount).toBeCloseTo(one.amount)

  const paymentsAfter = await request(app).get('/api/payments').set(auth).expect(200)
  const settled = paymentsAfter.body.find(p => p._id === one._id)
  const stillPending = paymentsAfter.body.find(p => p._id === two._id)
  expect(settled.settled).toBe(true)
  expect(stillPending.settled).toBe(false)
})

test('paying 3 pending debts should not create extra records', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }
  const house = await request(app).post('/api/houses').set(auth).send({ code: 'P-3X', number: '5', ownerName: 'Many', address: 'E' }).expect(200)
  const houseId = house.body._id
  const tank = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'Tank 3x', capacity: 300, pricePerFill: 6 }).expect(200)
  const tankId = tank.body.tank._id
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 200 }).expect(200)

  // create 3 deliveries -> 3 pending payments
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ house: houseId, count: 1, usedPrepaid: false }).expect(200)

  // verify created 3 pendings
  let payments = await request(app).get('/api/payments').set(auth).expect(200)
  const pendings = payments.body.filter(p => !p.confirmed && !p.settled && String(p.house && p.house._id ? p.house._id : p.house) === String(houseId))
  expect(pendings.length).toBe(3)

  // Pay all 3 via house pay with targets (sum of all pendings)
  const targets = pendings.map(p => ({ id: p._id, amount: p.amount }))
  const total = targets.reduce((s, t) => s + t.amount, 0)
  // Send two simultaneous identical requests to simulate double click
  const [pay1, pay2] = await Promise.all([
    request(app).post(`/api/houses/${houseId}/pay`).set(auth).send({ amount: total, description: 'Pago 3x', targets }),
    request(app).post(`/api/houses/${houseId}/pay`).set(auth).send({ amount: total, description: 'Pago 3x', targets })
  ])
  expect([pay1.status, pay2.status]).toEqual(expect.arrayContaining([200]))
  // Use the first response object for further assertions
  const pay = pay1.body.payment ? pay1 : pay2

  // After pay, expect there remain exactly 3 + 1 payments total (original 3 pendings now settled + new payment)
  payments = await request(app).get('/api/payments').set(auth).expect(200)
  const allForHouse = payments.body.filter(p => String(p.house && p.house._id ? p.house._id : p.house) === String(houseId))
  // Should be 4 entries (3 pendings + 1 created payment)
  expect(allForHouse.length).toBe(4)
  // All original pendings must be settled now
  const anyUnsettled = allForHouse.find(p => !p.settled && !p.confirmed)
  expect(anyUnsettled).toBeUndefined()
  // All original pendings settled by the pay record
  const createdPayId = pay.body.payment ? pay.body.payment._id : (pay1.body.payment ? pay1.body.payment._id : pay2.body.payment._id)
  const pendingsSettled = allForHouse.filter(p => p._id !== createdPayId && p.settled)
  expect(pendingsSettled.length).toBeGreaterThanOrEqual(3)
  pendingsSettled.forEach(s => expect(String(s.settledBy)).toBe(String(createdPayId)))
  // There should be no amount==0 but unsettled entries (they must be settled)
  const zeroUnsettled = allForHouse.find(p => (p.amount === 0) && !p.settled)
  expect(zeroUnsettled).toBeUndefined()
  // The created pay record must have appliedAmount equal to total
  expect(pay.body.payment.appliedAmount).toBeCloseTo(total)
})

test('canceling a payment cleans zero-dollar unsettled debts', async () => {
  const auth = { Authorization: `Bearer ${adminToken}` }
  const house = await request(app).post('/api/houses').set(auth).send({ code: 'P-CLEAN', number: '6', ownerName: 'Clean', address: 'F' }).expect(200)
  const houseId = house.body._id
  // create a dummy confirmed payment
  const confirmedPay = await request(app).post('/api/payments').set(auth).send({ house: houseId, amount: 10, confirmed: true }).expect(200)
  // insert a zero-amount pending debt (simulates invalid state)
  const zeroPending = await request(app).post('/api/payments').set(auth).send({ house: houseId, amount: 0, confirmed: false, settled: false }).expect(200)
  // Ensure it's present
  let payments = await request(app).get('/api/payments').set(auth).expect(200)
  const found = payments.body.find(p => p._id === zeroPending.body._id)
  expect(found).toBeDefined()
  // Cancel the confirmed payment (toggle to unconfirmed) should trigger cleanup
  const toggle = await request(app).put(`/api/payments/${confirmedPay.body._id}/confirm`).set(auth).expect(200)
  expect(toggle.body.confirmed).toBe(false)
  // zero pending should be marked settled (we mark rather than delete to preserve history)
  payments = await request(app).get('/api/payments').set(auth).expect(200)
  const still = payments.body.find(p => p._id === zeroPending.body._id)
  expect(still).toBeDefined()
  expect(still.settled).toBe(true)
})

