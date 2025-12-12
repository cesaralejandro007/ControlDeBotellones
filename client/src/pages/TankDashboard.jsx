import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Highcharts from 'highcharts'
import { useAuth } from '../context/AuthContext'

export default function TankDashboard(){
  const [tanks, setTanks] = useState(null)
  const refs = useRef({})
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(()=>{ if (!user) return; fetchTanks() }, [user])

  const fetchTanks = async ()=>{
    try{
      const res = await axios.get('http://localhost:4000/api/inventory/tanks/summary?days=30')
      setTanks(res.data)
    }catch(err){ console.error('Error fetching tanks', err); setTanks([]) }
  }

  useEffect(()=>{
    if (!tanks) return
    // render small chart per tank
    const charts = []
    tanks.forEach(t => {
      const el = refs.current[t.id]
      if (!el) return
      const series = [{ name: t.name, data: t.history.map(h => h.qty) }]
      const opts = { title:{ text: t.name }, xAxis:{ categories: t.history.map(h => h.date) }, series }
      charts.push(Highcharts.chart(el, opts))
    })
    return ()=>{ charts.forEach(c => c && c.destroy()) }
  }, [tanks])

  useEffect(()=>{
    // if query param productId is present, find the corresponding tank and navigate to management
    const params = new URLSearchParams(location.search);
    const productId = params.get('productId')
    if (productId && tanks){
      const found = tanks.find(t => t.productId === productId)
      if (found) navigate(`/tanks/${found.id}`)
    }
  }, [location.search, tanks])

  if (!user) return <div className="text-center py-5">Accede para ver los tanques</div>
  if (!tanks) return <div className="text-center py-5">Cargando panel de tanques...</div>

  return (
    <div className="container mt-3">
      <h2>Panel de Tanques</h2>
      <p>Resumen de niveles y historial (últimos 30 días)</p>
      <div className="row">
        {tanks.map(t => (
          <div className="col-md-6 mb-3" key={t.id}>
            <div className="card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <h5 className="card-title mb-0">{t.name}</h5>
                    <small className="text-muted">{t.quantity} L / {t.capacity} L • {Math.floor((t.quantity||0)/(t.litersPerBottle||20))} bot.</small>
                  </div>
                  <div>
                    <span className={`badge ${t.status === 'low' ? 'bg-danger' : t.status === 'medium' ? 'bg-warning text-dark' : 'bg-success'}`}>{t.status}</span>
                    <div className="mt-2"><button className="btn btn-sm btn-link" onClick={()=>navigate(`/tanks/${t.id}`)}>Gestionar</button></div>
                  </div>
                </div>
                <div ref={el => refs.current[t.id] = el} style={{height:200}} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
