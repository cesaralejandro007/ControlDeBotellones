const axios = require('axios')
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL

async function notifySlack(message){
  if (!SLACK_WEBHOOK) return false
  try{
    await axios.post(SLACK_WEBHOOK, { text: message })
    return true
  }catch(e){ console.error('Slack notify failed', e.message); return false }
}

async function notifyTankLevel(product){
  try{
    if (!product || product.unit !== 'litro' || !product.capacity) return false
    const pct = Math.round((product.quantity / product.capacity) * 100)
    if (pct < 30){
      const msg = `⚠️ *Tanque bajo*: ${product.name} (${product.quantity}L / ${product.capacity}L — ${pct}%)`
      return await notifySlack(msg)
    }
    return false
  }catch(e){ console.error('notifyTankLevel error', e.message); return false }
}

module.exports = { notifySlack, notifyTankLevel }
