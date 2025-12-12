import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Swal from 'sweetalert2'
import { FaEdit, FaTrash } from 'react-icons/fa'
import { FaCashRegister } from 'react-icons/fa'

export default function Inventory(){
  const [items, setItems] = useState([])
  const [lowTanks, setLowTanks] = useState([])
  const [form, setForm] = useState({ name: '', type: 'botellon', category: 'Botellones', unit: 'unidad', quantity: 0, price: 0, capacity: 0 })
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(()=>{ if (!user) navigate('/login'); else fetch() },[user])
  const fetch = async ()=>{ try{ const res = await axios.get('http://localhost:4000/api/inventory'); setItems(res.data) }catch(e){ console.error(e) } }

  useEffect(()=>{
    const low = (items || []).filter(i => i.unit === 'litro' && i.capacity && ((i.quantity/i.capacity)*100 < 30))
    setLowTanks(low)
  }, [items])

  const submit = async ()=>{
    if (!form.name) return Swal.fire('Faltan datos','Nombre obligatorio','warning')
    if (form.category === 'Llenado Tanque' && (!form.capacity || form.capacity <= 0)) return Swal.fire('Faltan datos','Capacidad (litros) obligatoria para Llenado Tanque','warning')
    try{
      // enviar category y unit al backend
      await axios.post('http://localhost:4000/api/inventory', form)
      setForm({ name:'', type:'botellon', category: 'Botellones', unit: 'unidad', quantity:0, price:0, capacity:0 })
      fetch()
      Swal.fire('Creado','Producto añadido','success')
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
  }

  const editProduct = async (p) => {
    const { value: data } = await Swal.fire({
      title: 'Editar producto',
      html:
        `<input id="swal-name" class="swal2-input" placeholder="Nombre" value="${p.name}" />` +
        `<input id="swal-category" class="swal2-input" placeholder="Categoría" value="${p.category || ''}" />` +
        `<input id="swal-unit" class="swal2-input" placeholder="Unidad" value="${p.unit || ''}" />` +
        `<input id="swal-qty" class="swal2-input" type="number" placeholder="Cantidad" value="${p.quantity || 0}" />` +
        `<input id="swal-price" class="swal2-input" type="number" placeholder="Precio" value="${p.price || 0}" />` +
        `<input id="swal-capacity" class="swal2-input" type="number" placeholder="Capacidad (litros)" value="${p.capacity || 0}" />`,
      focusConfirm: false,
      preConfirm: () => ({
        name: document.getElementById('swal-name').value,
        category: document.getElementById('swal-category').value,
        unit: document.getElementById('swal-unit').value,
        quantity: parseFloat(document.getElementById('swal-qty').value) || 0,
        price: parseFloat(document.getElementById('swal-price').value) || 0,
        capacity: parseFloat(document.getElementById('swal-capacity').value) || 0
      })
    })
    if (data) {
      try{
        await axios.put(`http://localhost:4000/api/inventory/${p._id}`, data)
        fetch(); Swal.fire('Guardado','Producto actualizado','success')
      }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
    }
  }

  const deleteProduct = async (p) => {
    const res = await Swal.fire({ title: 'Confirmar', text: `Eliminar ${p.name}?`, icon: 'warning', showCancelButton: true })
    if (res.isConfirmed) {
      try{ await axios.delete(`http://localhost:4000/api/inventory/${p._id}`); fetch(); Swal.fire('Eliminado','Producto eliminado','success') }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
    }
  }

  const sellProduct = async (p) => {
    if (p.unit === 'litro') return Swal.fire('Atención','Las recargas/llenados se gestionan desde el panel de tanques','info')
    const { value: form } = await Swal.fire({
      title: `Vender ${p.name}`,
      html: `<input id="swal-qty" class="swal2-input" type="number" placeholder="Cantidad" value="1" />` +
            `<input id="swal-note" class="swal2-input" placeholder="Notas (opcional)" />`,
      focusConfirm: false,
      preConfirm: () => ({ quantity: parseInt(document.getElementById('swal-qty').value || 0), notes: document.getElementById('swal-note').value })
    })
    if (!form) return
    try{
      const amount = (p.price || 0) * form.quantity
      await axios.post('http://localhost:4000/api/sales', { productId: p._id, quantity: form.quantity, amount, notes: form.notes })
      Swal.fire('Venta registrada','Inventario actualizado','success')
      fetch()
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
  }

  return (
    <div className="container mt-3">
      <h2>Inventario</h2>
      {lowTanks.length > 0 && (<div className="alert alert-warning">Atención: tanque(s) con nivel bajo: {lowTanks.map(t=>t.name).join(', ')}</div>)}
      <div className="card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">Nombre</label>
            <input className="form-control" placeholder="Nombre" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Categoría</label>
            <select className="form-select" value={form.category} onChange={e=>{
              const cat = e.target.value
              // when selecting category, auto-set sensible unit/defaults
              if (cat === 'Llenado Tanque') setForm({...form, category: cat, unit: 'litro', type: 'tanque'})
              else if (cat === 'Botellones') setForm({...form, category: cat, unit: 'unidad', type: 'botellon'})
              else setForm({...form, category: cat})
            }}>
              <option>Llenado Tanque</option>
              <option>Botellones</option>
              <option>Artículos de limpieza</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Unidad</label>
            <select className="form-select" value={form.unit} onChange={e=>setForm({...form, unit:e.target.value})}>
              <option value="unidad">unidad</option>
              <option value="kg">kg</option>
              <option value="litro">litro</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Cantidad</label>
            <input className="form-control" type="number" placeholder={form.unit === 'litro' ? 'Litros' : 'Cantidad'} value={form.quantity} onChange={e=>setForm({...form, quantity:parseFloat(e.target.value)})} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Precio</label>
            <input className="form-control" type="number" placeholder="Precio" value={form.price} onChange={e=>setForm({...form, price:parseFloat(e.target.value)})} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Capacidad (litros)</label>
            <input className="form-control" type="number" placeholder="Capacidad" value={form.capacity} onChange={e=>setForm({...form, capacity:parseFloat(e.target.value)})} />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button className="btn btn-success w-100" onClick={submit}>Agregar</button>
          </div>
        </div>
      </div>

      <table className="table table-hover">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Stock</th>
            <th>Info</th>
            <th>Precio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map(i=> (
            <tr key={i._id}>
              <td>{i.name}</td>
              <td>{i.category || i.type}</td>
              <td>{i.quantity} {i.unit || ''}</td>
              <td>
                {i.unit === 'litro' ? (
                  <div>
                    <div>Botellones: <strong>{Math.floor(i.quantity/20)}</strong></div>
                    {i.capacity > 0 ? (
                      <div className="progress mt-1" style={{height: '14px'}}>
                        {(() => {
                          const pct = Math.min(100, Math.round((i.quantity / i.capacity) * 100))
                          const cls = pct >= 70 ? 'bg-success' : (pct >= 30 ? 'bg-warning' : 'bg-danger')
                            return (
                              <>
                                <div className={`progress-bar ${cls}`} role="progressbar" style={{width: pct + '%'}} aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">{pct}%</div>
                                <div className="mt-1">{pct < 30 ? <span className="badge bg-danger">Bajo</span> : (pct < 70 ? <span className="badge bg-warning text-dark">Medio</span> : <span className="badge bg-success">Ok</span>)}</div>
                              </>
                            )
                        })()}
                      </div>
                    ) : <small className="text-muted">Capacidad no definida</small>}
                    <div className="mt-1"><a href={`/tanks?productId=${i._id}`} className="btn btn-sm btn-link">Gestionar tanque</a></div>
                  </div>
                ) : ('')}
              </td>
              <td>${i.price}</td>
              <td>
                <button className="btn btn-sm btn-outline-success me-2" onClick={()=>sellProduct(i)}><FaCashRegister/></button>
                <button className="btn btn-sm btn-outline-primary me-2" onClick={()=>editProduct(i)}><FaEdit/></button>
                <button className="btn btn-sm btn-outline-danger" onClick={()=>deleteProduct(i)}><FaTrash/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
