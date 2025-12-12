const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryReplSet } = require('mongodb-memory-server')
const app = require('../app')

jest.mock('../utils/notify')
const notify = require('../utils/notify')

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  const uri = mongod.getUri()
  await mongoose.connect(uri)
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

test('notifyTankLevel called when tank drops below threshold', async () => {
  // create admin and login
  const admin = { name: 'NAdmin', email: 'nadmin@example.com', password: 'secret' }
  await request(app).post('/api/auth/register').send(admin).expect(200)
  const loginRes = await request(app).post('/api/auth/login').send({ email: admin.email, password: admin.password }).expect(200)
  const token = loginRes.body.token
  const auth = { Authorization: `Bearer ${token}` }

  // create tank
  const createRes = await request(app).post('/api/inventory/tanks').set(auth).send({ name: 'N Tank', capacity: 100, pricePerFill: 10 }).expect(200)
  const tankId = createRes.body.tank._id

  // recharge tank with 80L
  await request(app).post(`/api/inventory/tanks/${tankId}/recharge`).set(auth).send({ liters: 80 }).expect(200)

  // clear any previous calls (notify might be called on recharge even if not low)
  notify.notifyTankLevel.mockClear()

  // perform fill of 4 bottles -> consumes 80L? No, fight: We'll fill 3 bottles (~60L) leaving 20L -> 20/100 = 20% => should trigger
  await request(app).post(`/api/inventory/tanks/${tankId}/fill`).set(auth).send({ count: 3, house: null, usedPrepaid: false }).expect(200)

  // notifyTankLevel should have been called at least once
  expect(notify.notifyTankLevel).toHaveBeenCalled()
})
