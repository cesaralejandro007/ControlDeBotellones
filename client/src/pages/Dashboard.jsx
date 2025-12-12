import React, { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import Highcharts from 'highcharts'
import Swal from 'sweetalert2'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function toMonthLabel(obj) {
  return `${obj._id.month}/${obj._id.year}`
}

export default function Dashboard(){
  const [data, setData] = useState(null)
  const [months, setMonths] = useState(6)
  const [lowTanks, setLowTanks] = useState([])
  const [alertShown, setAlertShown] = useState(false)
  const paymentsRef = useRef(null)
  const deliveriesRef = useRef(null)
  const inventoryRef = useRef(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(()=>{ if (!user) navigate('/login'); else fetch(months) }, [user])

  useEffect(()=>{ if (!user) return; fetchTanks() }, [user])

  const fetchTanks = async ()=>{
    try{
      const res = await axios.get('http://localhost:4000/api/inventory/tanks/summary?days=7')
      const low = res.data.filter(t => t.status === 'low')
      setLowTanks(low)
      if (low.length && !alertShown) {
        setAlertShown(true)
        const names = low.map(t => t.name).join(', ')
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: `Tanque(s) bajo: ${names}`, showConfirmButton: false, timer: 5000 })
      }
    }catch(err){ console.error('Error fetching tanks', err); setLowTanks([]) }
  }

  const fetch = async (m = 6)=>{
    try{
      const res = await axios.get(`http://localhost:4000/api/reports/summary?months=${m}`)
      setData(res.data)
    }catch(err){ console.error(err); setData({ paymentsByMonth:[], deliveriesByMonth:[], inventoryByCategory:[] }) }
  }

  // derive safe arrays from data so hooks remain stable across renders
  const paymentsCategories = (data?.paymentsByMonth ?? []).map(p => p.total)
  const paymentsLabels = (data?.paymentsByMonth ?? []).map(p => toMonthLabel(p))
  const deliveriesSeries = (data?.deliveriesByMonth ?? []).map(d => d.total)
  const deliveriesLabels = (data?.deliveriesByMonth ?? []).map(d => toMonthLabel(d))

  const invCategories = (data?.inventoryByCategory ?? []).map(i => i._id || 'Sin categoría')
  const invValues = (data?.inventoryByCategory ?? []).map(i => i.totalQty)

  const paymentsOptions = {
    title: { text: 'Pagos por mes' },
    xAxis: { categories: paymentsLabels },
    series: [{ name: 'Total pagos', data: paymentsCategories }]
  }

  const deliveriesOptions = {
    title: { text: 'Entregas por mes' },
    xAxis: { categories: deliveriesLabels },
    series: [{ name: 'Botellones entregados', data: deliveriesSeries }]
  }

  const inventoryOptions = {
    chart: { type: 'column' },
    title: { text: 'Inventario por categoría' },
    xAxis: { categories: invCategories },
    series: [{ name: 'Cantidad', data: invValues }]
  }

  useEffect(()=>{
    if (!data) return
    // render charts imperatively into refs
    const c1 = paymentsRef.current ? Highcharts.chart(paymentsRef.current, paymentsOptions) : null
    const c2 = deliveriesRef.current ? Highcharts.chart(deliveriesRef.current, deliveriesOptions) : null
    const c3 = inventoryRef.current ? Highcharts.chart(inventoryRef.current, inventoryOptions) : null
    return ()=>{ if (c1) c1.destroy(); if (c2) c2.destroy(); if (c3) c3.destroy() }
  }, [data])
  // render
  if (!data) return <div className="text-center py-5">Cargando dashboard...</div>

  return (
    <div className="container mt-3">
      {lowTanks.length > 0 && (
        <div className="alert alert-danger">Atención: tanque(s) en nivel bajo: {lowTanks.map(t=>t.name).join(', ')}</div>
      )}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Dashboard</h2>
        <div className="d-flex align-items-center">
          <label className="me-2">Meses</label>
          <select className="form-select me-2" style={{width:120}} value={months} onChange={e=>{ setMonths(parseInt(e.target.value)); fetch(parseInt(e.target.value)) }}>
            <option value={3}>3</option>
            <option value={6}>6</option>
            <option value={12}>12</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="col-md-6 mb-3"><div ref={paymentsRef} /></div>
        <div className="col-md-6 mb-3"><div ref={deliveriesRef} /></div>
      </div>
      <div className="row">
        <div className="col-md-12 mb-3"><div ref={inventoryRef} /></div>
      </div>
    </div>
  )
}
