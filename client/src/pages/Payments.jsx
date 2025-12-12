import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Swal from 'sweetalert2'

export default function Payments(){
  const [payments, setPayments] = useState([])
  const [houses, setHouses] = useState([])
  const [form, setForm] = useState({ house: '', amount: 0, prepaidBotellones: 0, description: '' })
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(()=>{ fetchAll() },[])
  useEffect(()=>{ if (!user) navigate('/login') }, [user])

  const fetchAll = async () =>{
    const [pRes, hRes] = await Promise.all([
      axios.get('http://localhost:4000/api/payments'),
      axios.get('http://localhost:4000/api/houses')
    ])
    setPayments(pRes.data)
    setHouses(hRes.data)
  }

  const submit = async () =>{
    if (!form.house || !form.amount) return Swal.fire('Faltan datos','Selecciona casa y cantidad','warning')
    try{
      await axios.post('http://localhost:4000/api/payments', form)
      setForm({ house:'', amount:0, prepaidBotellones:0, description:'' })
      fetchAll()
      Swal.fire('Registrado','Pago registrado correctamente','success')
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
  }

  const toggleConfirm = async (id, current) =>{
    const result = await Swal.fire({ title: current ? 'Anular pago?' : 'Restablecer pago?', showCancelButton: true, icon: 'question' })
    if (!result.isConfirmed) return
    try{
      await axios.put(`http://localhost:4000/api/payments/${id}/confirm`)
      fetchAll()
      Swal.fire('OK','Estado actualizado','success')
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
  }

  return (
    <div className="container mt-3">
      <h2>Pagos</h2>
      <div className="card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">Casa</label>
            <select className="form-select" value={form.house} onChange={e=>setForm({...form, house:e.target.value})}>
              <option value="">Selecciona casa</option>
              {houses.map(h=> <option key={h._id} value={h._id}>{h.code}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Monto</label>
            <input className="form-control" type="number" value={form.amount} onChange={e=>setForm({...form, amount:parseFloat(e.target.value)})} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Botellones adelantados</label>
            <input className="form-control" type="number" value={form.prepaidBotellones} onChange={e=>setForm({...form, prepaidBotellones:parseInt(e.target.value)})} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Descripción</label>
            <input className="form-control" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
          </div>
          <div className="col-md-1 d-flex align-items-end">
            <button className="btn btn-success w-100" onClick={submit}>Registrar</button>
          </div>
        </div>
      </div>

      <h3>Historial</h3>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Casa</th>
            <th>Monto</th>
            <th>Adelantados</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p=> (
            <tr key={p._id}>
              <td>{new Date(p.date).toLocaleString()}</td>
              <td>{p.house?.code}</td>
              <td>${p.amount}</td>
              <td>{p.prepaidBotellones}</td>
              <td>{p.confirmed? 'Confirmado':'Anulado'}</td>
              <td><button className="btn btn-sm btn-warning" onClick={()=>toggleConfirm(p._id, p.confirmed)}>{p.confirmed? 'Anular' : 'Restablecer'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
