import React, { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import Highcharts from 'highcharts'
import Swal from 'sweetalert2'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function toMonthLabel(obj) {
  return `${obj._id.month}/${obj._id.year}`
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [months, setMonths] = useState(6)
  const [lowTanks, setLowTanks] = useState([])
  const [alertShown, setAlertShown] = useState(false)
  const paymentsRef = useRef(null)
  const deliveriesRef = useRef(null)
  const inventoryRef = useRef(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return navigate('/login')
    fetchData(months)
    fetchLowTanks()
  }, [user])

  const fetchLowTanks = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/inventory/tanks/summary?days=7')
      const low = res.data.filter(t => t.status === 'low')
      setLowTanks(low)

      if (low.length && !alertShown) {
        setAlertShown(true)
        const names = low.map(t => t.name).join(', ')
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: `Tanque(s) bajo: ${names}`,
          showConfirmButton: false,
          timer: 5000
        })
      }
    } catch (err) {
      console.error('Error fetching tanks', err)
      setLowTanks([])
    }
  }

  const fetchData = async (m = 6) => {
    try {
      const res = await axios.get(`http://localhost:4000/api/reports/summary?months=${m}`)
      setData(res.data)
    } catch (err) {
      console.error(err)
      setData({ paymentsByMonth: [], deliveriesByMonth: [], inventoryByCategory: [] })
    }
  }

  const renderChart = (ref, options) => {
    if (!ref.current) return null
    const chart = Highcharts.chart(ref.current, options)
    return () => chart.destroy()
  }

  const paymentsLabels = (data?.paymentsByMonth ?? []).map(toMonthLabel)
  const paymentsSeries = (data?.paymentsByMonth ?? []).map(p => p.total)
  const deliveriesLabels = (data?.deliveriesByMonth ?? []).map(toMonthLabel)
  const deliveriesSeries = (data?.deliveriesByMonth ?? []).map(d => d.total)
  const inventoryCategories = (data?.inventoryByCategory ?? []).map(i => i._id || 'Sin categoría')
  const inventoryValues = (data?.inventoryByCategory ?? []).map(i => i.totalQty)

const paymentsOptions = {
  title: { text: 'Pagos por mes' },
  xAxis: { categories: paymentsLabels },
  series: [
    {
      name: 'Total pagos',
      data: paymentsSeries.map(p => Number(p.toFixed(2))) // dos decimales
    }
  ],
  tooltip: {
    valueDecimals: 2,
    valuePrefix: '$'
  }
}

  const deliveriesOptions = { title: { text: 'Entregas por mes' }, xAxis: { categories: deliveriesLabels }, series: [{ name: 'Botellones entregados', data: deliveriesSeries }] }
  const inventoryOptions = { chart: { type: 'column' }, title: { text: 'Inventario por categoría' }, xAxis: { categories: inventoryCategories }, series: [{ name: 'Cantidad', data: inventoryValues }] }

  useEffect(() => {
    if (!data) return
    const destroyPayments = renderChart(paymentsRef, paymentsOptions)
    const destroyDeliveries = renderChart(deliveriesRef, deliveriesOptions)
    const destroyInventory = renderChart(inventoryRef, inventoryOptions)

    return () => {
      destroyPayments?.()
      destroyDeliveries?.()
      destroyInventory?.()
    }
  }, [data])

  if (!data) return <div className="text-center py-5">Cargando dashboard...</div>

  // Calcular totales para tarjetas
  const totalPayments = paymentsSeries.reduce((a, b) => a + b, 0)
  const totalDeliveries = deliveriesSeries.reduce((a, b) => a + b, 0)
  const totalLowTanks = lowTanks.length

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Bienvenido a Control Botellones</h3>
        <div className="d-flex align-items-center">
          <label className="me-2 fw-semibold">Meses</label>
          <select
            className="form-select"
            style={{ width: 120 }}
            value={months}
            onChange={e => {
              const val = parseInt(e.target.value)
              setMonths(val)
              fetchData(val)
            }}
          >
            <option value={3}>3</option>
            <option value={6}>6</option>
            <option value={12}>12</option>
          </select>
        </div>
      </div>

      {/* 🟦 Tarjetas resumen */}
<div className="row mb-4">
  <div className="col-md-4 mb-3">
    <div className="card h-100 shadow-sm border-0" style={{ background: '#007bff20' }}>
      <div className="card-body text-primary">
        <h5 className="card-title">Total Pagos</h5>
        <h2>{Number(totalPayments).toFixed(2)} $</h2>
      </div>
    </div>
  </div>

  <div className="col-md-4 mb-3">
    <div className="card h-100 shadow-sm border-0" style={{ background: '#17a2b820' }}>
      <div className="card-body text-info">
        <h5 className="card-title">Botellones Entregados</h5>
        <h2>{totalDeliveries}</h2>
      </div>
    </div>
  </div>

  <div className="col-md-4 mb-3">
    <div
      className="card h-100 shadow-sm border-0"
      style={{
        background: totalLowTanks ? '#dc354520' : '#28a74520',
        color: totalLowTanks ? '#dc3545' : '#28a745'
      }}
    >
      <div className="card-body">
        <h5 className="card-title">Tanques Bajo Nivel</h5>
        <h2>{totalLowTanks}</h2>
        {totalLowTanks > 0 && <p>{lowTanks.map(t => t.name).join(', ')}</p>}
      </div>
    </div>
  </div>
</div>


      {/* 🖼 Gráficos */}
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
