const mongoose = require('mongoose')

/**
 * Check if the connected MongoDB deployment supports transactions (replica set or mongos)
 * Returns boolean
 */
async function supportsTransactions(){
  try {
    const admin = mongoose.connection.db.admin()
    // In modern MongoDB, 'hello' is recommended, fallback to 'isMaster'
    const res = await admin.command({ hello: 1 }).catch(() => admin.command({ isMaster: 1 }))
    // If setName present, it's a replica set or sharded cluster
    if (res && res.setName) return true
    // serverless / single node: no transactions
    return false
  } catch (err) {
    // If anything fails, be conservative and say no
    return false
  }
}

module.exports = { supportsTransactions }
