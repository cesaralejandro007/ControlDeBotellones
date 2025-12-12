import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Swal from 'sweetalert2'

export default function TankManagement(){
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tank, setTank] = useState(null)
  const [product, setProduct] = useState(null)
  const [price, setPrice] = useState(0)
  const [liters, setLiters] = useState(0)
  const [count, setCount] = useState(1)
  const [houses, setHouses] = useState([])
  const [houseId, setHouseId] = useState('')

  useEffect(()=>{ if (!user) navigate('/login'); else fetch(); fetchHouses() }, [user])

  const fetch = async ()=>{
    try{ const res = await axios.get(`http://localhost:4000/api/inventory/tanks/summary?days=30`); const t = res.data.find(x=>x.id === id); setTank(t); setPrice(t?.pricePerFill || 0); setProduct({ id: t?.productId, name: t?.name }) }catch(err){ console.error(err); setTank(null) }}
  const fetchHouses = async ()=>{ try{ const r = await axios.get('http://localhost:4000/api/houses'); setHouses(r.data) }catch(e){ setHouses([]) }}

  const savePrice = async ()=>{ try{ await axios.put(`http://localhost:4000/api/inventory/tanks/${id}`, { pricePerFill: parseFloat(price) }); fetch(); Swal.fire('Guardado','Precio actualizado','success') }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') } }

  const recharge = async ()=>{ try{ await axios.post(`http://localhost:4000/api/inventory/tanks/${id}/recharge`, { liters: parseFloat(liters) }); fetch(); Swal.fire('Recargado','Tanque recargado','success') }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') } }

  const fill = async ()=>{ try{ await axios.post(`http://localhost:4000/api/inventory/tanks/${id}/fill`, { count: parseInt(count), house: houseId || undefined, usedPrepaid: false }); fetch(); Swal.fire('Listo','Llenado realizado','success') }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') } }

  if (!tank) return <div className="text-center py-5">Cargando tanque...</div>

  return (
    <div className="container mt-3">
      <h2>Gestionar Tanque: {tank.name}</h2>
      <div className="card p-3 mb-3">
        <div><strong>Cantidad:</strong> {tank.quantity} L</div>
        <div><strong>Capacidad:</strong> {tank.capacity} L</div>
        <div><strong>Botellones aproximados:</strong> {tank.fillable}</div>
        <div className="row mt-3">
          <div className="col-md-4">
            <label className="form-label">Precio por llenado (por botellón)</label>
            <input type="number" className="form-control" value={price} onChange={e=>setPrice(e.target.value)} />
            <button className="btn btn-primary mt-2" onClick={savePrice}>Guardar precio</button>
          </div>
          <div className="col-md-4">
            <label className="form-label">Recargar litros</label>
            <input type="number" className="form-control" value={liters} onChange={e=>setLiters(e.target.value)} />
            <button className="btn btn-success mt-2" onClick={recharge}>Recargar</button>
          </div>
          <div className="col-md-4">
            <label className="form-label">Realizar llenado</label>
            <input type="number" className="form-control" value={count} onChange={e=>setCount(e.target.value)} />
            <label className="form-label mt-2">Casa (opcional)</label>
            <select className="form-select" value={houseId} onChange={e=>setHouseId(e.target.value)}>
              <option value="">- Seleccionar -</option>
              {houses.map(h=> (<option key={h._id} value={h._id}>{h.name || h.code}</option>))}
            </select>
            <button className="btn btn-warning mt-2" onClick={fill}>Llenar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
