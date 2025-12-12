import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import Swal from 'sweetalert2'

export default function HouseDetail(){
  const { id } = useParams()
  const [detail, setDetail] = useState(null)
  const [deliveryCount, setDeliveryCount] = useState(1)
  const [botellonStock, setBotellonStock] = useState(null)
  const [usePrepaid, setUsePrepaid] = useState(false)
  const [debtInfo, setDebtInfo] = useState(null)
  const [tankInfo, setTankInfo] = useState(null)
  const [isApplying, setIsApplying] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const fetch = async ()=>{
    const res = await axios.get(`http://localhost:4000/api/houses/${id}/detail`)
    setDetail(res.data)
    // obtener stock de botellones (informativo; no bloquea entregas a casas) y precio de llenado
    try{
      const inv = await axios.get('http://localhost:4000/api/inventory')
      const bot = inv.data.find(i=> i.type === 'botellon')
      setBotellonStock(bot ? bot.quantity : null)
      // get tank summary to read pricePerFill
      const tanks = await axios.get('http://localhost:4000/api/inventory/tanks/summary')
      const tank = tanks.data[0]
      setTankInfo(tank || null)
    }catch(e){ setBotellonStock(null); setTankInfo(null) }
    // obtener deuda (monetaria)
    try{
      const d = await axios.get(`http://localhost:4000/api/houses/${id}/debt`)
      setDebtInfo(d.data)
    }catch(e){ setDebtInfo(null) }
  }

  useEffect(()=>{ if (!user) navigate('/login'); else fetch() },[id, user])

  const addDelivery = async (usedPrepaid=false) =>{
    try{
      const count = parseInt(deliveryCount) || 1
      if (tankInfo && tankInfo.id) {
        // use tank module to fill directly
        await axios.post(`http://localhost:4000/api/inventory/tanks/${tankInfo.id}/fill`, { house: id, count, usedPrepaid })
      } else {
        await axios.post('http://localhost:4000/api/deliveries', { house: id, count, usedPrepaid })
      }
      await fetch()
      Swal.fire('Entrega registrada', '', 'success')
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
  }

  const payDebt = async ()=>{
    // If there are no pending payments, open the quick pay dialog
    const pending = debtInfo?.pendingPayments || []
    if (!pending.length) {
      const { value: formValues } = await Swal.fire({
        title: 'Pagar deuda',
        html:
          '<input id="swal-amount" class="swal2-input" placeholder="Monto" type="number">' +
          '<input id="swal-prepaid" class="swal2-input" placeholder="Anticipo (botellones)" type="number">',
        focusConfirm: false,
        preConfirm: () => {
          const amount = parseFloat(document.getElementById('swal-amount').value || 0)
          const prepaid = parseInt(document.getElementById('swal-prepaid').value || 0)
          return { amount, prepaid }
        }
      })
      if (!formValues) return
      try{
        const idempotencyKey = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Math.random().toString(36).slice(2)
        const res = await axios.post(`http://localhost:4000/api/houses/${id}/pay`, { amount: formValues.amount, prepaidBotellones: formValues.prepaid, idempotencyKey })
        Swal.fire('OK','Pago registrado','success')
        await fetch()
      }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
      return
    }

    // build HTML table of pending payments with checkboxes (selected by default) + select-all
    const rows = pending.map(p => `
      <tr>
        <td class="text-center"><input class="form-check-input" data-checkbox-pay id="pay_${p._id}" data-amount="${p.amount}" type="checkbox" checked></td>
        <td>${new Date(p.date).toLocaleString()}</td>
        <td>$${p.amount}</td>
        <td>${p.description || 'Deuda'}</td>
      </tr>
    `).join('')
    const tableHtml = `
      <div style="text-align:left">
        <table class="table table-sm table-striped">
          <thead>
            <tr>
              <th style="width: 40px"><input id="select_all_pay" class="form-check-input" type="checkbox" checked onchange="document.querySelectorAll('[data-checkbox-pay]').forEach(cb => cb.checked = this.checked)"></th>
              <th>Fecha</th>
              <th>Monto</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>`
    const { value: selected } = await Swal.fire({
      title: 'Seleccionar deudas a pagar',
      html: tableHtml,
      focusConfirm: false,
      showLoaderOnConfirm: true,
      allowOutsideClick: false,
      showCancelButton: true,
      preConfirm: () => {
        const selectedIds = pending.map(p => ({ id: p._id, amount: parseFloat(document.getElementById('pay_' + p._id).dataset.amount) })).filter(x => document.getElementById('pay_' + x.id).checked)
        const total = selectedIds.reduce((s, x) => s + (x.amount || 0), 0)
        return { selectedIds, total }
      }
    })
    if (!selected) return
    if (!selected.selectedIds.length) return Swal.fire('Aviso','No seleccionaste deudas','info')
    if (isApplying) return
    setIsApplying(true)
    try{
    // create a confirmed payment for the total and atomically apply to targets via house pay
    const idempotencyKey = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Math.random().toString(36).slice(2)
    const res = await axios.post(`http://localhost:4000/api/houses/${id}/pay`, { amount: selected.total, description: 'Pago por liquidación de deudas', prepaidBotellones: 0, targets: selected.selectedIds, idempotencyKey })
      const paymentCreated = res.data.payment
      Swal.fire('OK','Pago registrado y aplicado','success')
      await fetch()
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') } finally { setIsApplying(false) }
  }

  const confirmPayment = async (paymentId) => {
    try{
      await axios.put(`http://localhost:4000/api/payments/${paymentId}/confirm`)
      Swal.fire('OK','Pago actualizado','success')
      await fetch()
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
  }

  if (!detail) return <div className="text-center py-5">Cargando detalle...</div>

  const { house, payments, deliveries, balance } = detail

  return (
    <div className="container mt-3">
      <div className="row g-3">
        <div className="col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h4 className="card-title text-primary">{house.code}</h4>
              <h5 className="card-subtitle mb-2 text-muted">{house.ownerName}</h5>
              <p className="mb-1"><strong>Teléfono:</strong> {house.phone || '—'}</p>
              <p className="mb-1"><strong>Email:</strong> {house.email || '—'}</p>
              <p className="mb-1"><strong>Dirección:</strong> {house.address || '—'}</p>
              {house.notes && <p className="mt-2"><strong>Notas:</strong> {house.notes}</p>}
            </div>
          </div>

          <div className="card mt-3 shadow-sm border-0">
            <div className="card-body">
              <h6 className="text-secondary">Balance de anticipos</h6>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div>Prepaid: <strong>{balance.prepaid}</strong></div>
                  <div>Usados: <strong>{balance.used}</strong></div>
                </div>
                <div>
                  <div className={"badge bg-" + (balance.balance >= 0 ? 'primary' : 'danger')}>Saldo: {balance.balance}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card mt-3 shadow-sm border-0">
            <div className="card-body">
              <h6 className="text-secondary">Deuda estimada</h6>
              <p className="mb-1">Precio botellón: ${debtInfo?.pricePerBotellon ?? 0}</p>
              <p className="mb-1">Total entregado: {debtInfo?.totalDelivered ?? 0} botellones</p>
              <p className="mb-1">Pagos realizados: ${debtInfo?.paymentsTotal ?? 0}</p>
                          <div className="d-flex justify-content-between align-items-center">
                            <div>Deuda pendiente: <strong>${Number(debtInfo?.pendingAmount || 0).toFixed(2)}</strong></div>
                            <div>
                              <button className="btn btn-sm btn-primary" onClick={payDebt} disabled={!debtInfo || (debtInfo.pendingAmount<=0) || isApplying}>{isApplying ? 'Procesando...' : 'Pagar deuda'}</button>
                            </div>
                          </div>
            </div>
          </div>

          <div className="card mt-3 shadow-sm border-0">
            <div className="card-body">
              <h6 className="text-secondary">Botellones en tanque</h6>
              {tankInfo ? (
                <div>
                  <p className="mb-1">Litros actuales: <strong>{tankInfo.quantity}</strong> / {tankInfo.capacity || '—'} L</p>
                  <p className="mb-1">Botellones aproximados: <strong>{Math.floor((tankInfo.quantity||0)/20)}</strong></p>
                  <p className="mb-1">Precio llenado: <strong>${tankInfo.pricePerFill ?? 0}</strong></p>
                  <div className="progress" style={{height: '14px'}}>
                    {(() => {
                      const pct = tankInfo.capacity ? Math.min(100, Math.round((tankInfo.quantity / tankInfo.capacity) * 100)) : 0
                      const cls = pct >= 70 ? 'bg-success' : (pct >= 30 ? 'bg-warning' : 'bg-danger')
                      return <div className={`progress-bar ${cls}`} role="progressbar" style={{width: pct + '%'}} aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">{pct}%</div>
                    })()}
                  </div>
                </div>
              ) : (
                <p className="mb-0 text-muted">Tanque no registrado</p>
              )}
            </div>
          </div>

          <div className="card mt-3 shadow-sm border-0">
            <div className="card-body">
              <h6 className="text-secondary">Stock botellones</h6>
              <p className="mb-0">{botellonStock === null ? 'No registrado' : botellonStock}</p>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card mb-3 shadow-sm border-0">
            <div className="card-body">
              <h5 className="card-title">Registrar entrega</h5>
              <div className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label">Cantidad</label>
                  <input className="form-control" type="number" min="1" value={deliveryCount} onChange={e=>setDeliveryCount(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Usar anticipo</label>
                  <select className="form-select" value={usePrepaid ? 'si' : 'no'} onChange={e=>setUsePrepaid(e.target.value === 'si')}>
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                <div className="col-md-4 d-flex">
                  <button className="btn btn-primary me-2" onClick={()=>addDelivery(usePrepaid)} disabled={usePrepaid && ((balance?.balance || 0) < (parseInt(deliveryCount) || 0))}>Registrar entrega</button>
                </div>
              </div>
              <div className="mt-2">
                {tankInfo && (
                  <small className="text-muted">Litros requeridos: <strong>{(deliveryCount || 0) * (tankInfo.litersPerBottle || 20)}</strong> L • Estimado a cobrar: <strong>${((deliveryCount || 0) * (tankInfo.pricePerFill || 0)).toFixed(2)}</strong></small>
                )}
                {usePrepaid && ((balance?.balance || 0) < (parseInt(deliveryCount) || 0)) && (
                  <div className="text-danger mt-1">Saldo de anticipos insuficiente para usar anticipo en esta entrega</div>
                )}
              </div>
            </div>
          </div>

          <div className="card mb-3 shadow-sm border-0">
            <div className="card-body">
              <h5>Pagos</h5>
              <div className="table-responsive">
                <table className="table table-sm table-striped">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Adelantados</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.filter(p => !(p.amount === 0 && p.settled)).map(p=> (
                      <tr key={p._id}>
                        <td>{new Date(p.date).toLocaleString()}</td>
                        <td>${Number(p.amount || 0).toFixed(2)}</td>
                        <td>{p.prepaidBotellones}</td>
                        <td>{p.description || '-'}</td>
                        <td>
                          {(p.confirmed || p.settled) ? (
                            <span className="badge bg-success">Confirmado</span>
                          ) : (
                            <span className="badge bg-warning">Pendiente</span>
                          )}
                        </td>
                        <td>
                          {!p.confirmed && !p.settled && user?.role === 'admin' && (
                            <button className="btn btn-sm btn-outline-success" onClick={()=>confirmPayment(p._id)}>Confirmar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card mb-3 shadow-sm border-0">
            <div className="card-body">
              <h5>Entregas</h5>
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cantidad</th>
                      <th>Usó anticipo</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map(d=> (
                      <tr key={d._id}>
                        <td>{new Date(d.date).toLocaleString()}</td>
                        <td>{d.count}</td>
                        <td>{d.usedPrepaid ? <span className="badge bg-info text-dark">Sí</span> : 'No'}</td>
                        <td>{d.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
