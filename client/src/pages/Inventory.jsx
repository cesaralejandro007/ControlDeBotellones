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
    if (!form.name) return Swal.fire({
      title: 'Faltan datos',
      text: 'El nombre del producto es obligatorio',
      icon: 'warning',
      confirmButtonColor: '#3085d6'
    })
    if (form.category === 'Llenado Tanque' && (!form.capacity || form.capacity <= 0)) return Swal.fire({
      title: 'Faltan datos',
      text: 'La capacidad del tanque es obligatoria para la categoría Llenado Tanque',
      icon: 'warning',
      confirmButtonColor: '#3085d6'
    })
    try{
      // enviar category y unit al backend
      await axios.post('http://localhost:4000/api/inventory', form)
      setForm({ name:'', type:'botellon', category: 'Botellones', unit: 'unidad', quantity:0, price:0, capacity:0 })
      fetch()
      Swal.fire({
        title: 'Creado',
        text: 'Producto agregado al inventario',
        icon: 'success',
        confirmButtonColor: '#3085d6'
      })
    }catch(err){ Swal.fire({
      title: 'Error',
      text: err.response?.data?.error || err.message,
      icon: 'error',
      confirmButtonColor: '#3085d6'
    }) }
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
      confirmButtonColor: '#3085d6',
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
        fetch(); Swal.fire({
          title: 'Actualizado',
          text: 'Producto actualizado correctamente',
          icon: 'success',
          confirmButtonColor: '#3085d6'
        })
      }catch(err){ Swal.fire({
        title: 'Error',
        text: err.response?.data?.error || err.message,
        icon: 'error',
        confirmButtonColor: '#3085d6'
      })}
    }
  }

  const deleteProduct = async (p) => {
    const res = await Swal.fire({ title: 'Confirmar', text: `Eliminar ${p.name}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: "Sí, eliminar", cancelButtonColor: '#3085d6' })
    if (res.isConfirmed) {
      try{ await axios.delete(`http://localhost:4000/api/inventory/${p._id}`); fetch(); Swal.fire({
        title: 'Eliminado',
        text: 'Producto eliminado correctamente',
        icon: 'success',
        confirmButtonColor: '#3085d6'
      }) }catch(err){ Swal.fire({
        title: 'Error',
        text: err.response?.data?.error || err.message,
        icon: 'error',
        confirmButtonColor: '#3085d6'
      }) }
    }
  }

  const sellProduct = async (p) => {
    if (p.unit === 'litro') return Swal.fire({
      title: 'No permitido',
      text: 'Las ventas de llenado de tanques se registran automáticamente al actualizar el nivel del tanque.',
      icon: 'info',
      confirmButtonColor: '#3085d6'
    })
    const { value: form } = await Swal.fire({
      title: `Vender ${p.name}`,
      html: `<input id="swal-qty" class="swal2-input" type="number" placeholder="Cantidad" value="1" />` +
            `<input id="swal-note" class="swal2-input" placeholder="Notas (opcional)" />`,
      focusConfirm: false,
      confirmButtonColor: '#3085d6',
      preConfirm: () => ({ quantity: parseInt(document.getElementById('swal-qty').value || 0), notes: document.getElementById('swal-note').value })
    })
    if (!form) return
    try{
      const amount = (p.price || 0) * form.quantity
      await axios.post('http://localhost:4000/api/sales', { productId: p._id, quantity: form.quantity, amount, notes: form.notes })
      Swal.fire({
        title: 'Vendido',
        text: `Venta registrada por $${amount}`,
        icon: 'success',
        confirmButtonColor: '#3085d6'
      })
      fetch()
    }catch(err){ Swal.fire({
      title: 'Error',
      text: err.response?.data?.error || err.message,
      icon: 'error',
      confirmButtonColor: '#3085d6'
    }) }
  }

  return (
  <div className="container mt-4">

  {/* HEADER */}
  <div className="d-flex justify-content-between align-items-center mb-3">
    <h4 className="mb-0 fw-semibold">Inventario</h4>
  </div>

  {/* ALERTA TANQUES BAJOS */}
  {lowTanks.length > 0 && (
    <div className="alert alert-warning d-flex align-items-center py-2">
      <i className="bi bi-exclamation-triangle-fill me-2"></i>
      <small>
        Tanques con nivel bajo:&nbsp;
        <strong>{lowTanks.map(t => t.name).join(", ")}</strong>
      </small>
    </div>
  )}

  {/* FORMULARIO */}
  <div className="card shadow-sm border-0 mb-4">
    <div className="card-body">
      <h6 className="text-muted mb-3">Agregar / Actualizar producto</h6>

      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label small text-muted">Nombre</label>
          <input
            className="form-control form-control-sm"
            placeholder="Nombre del producto"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="col-md-3">
          <label className="form-label small text-muted">Categoría</label>
          <select
            className="form-select form-select-sm"
            value={form.category}
            onChange={e => {
              const cat = e.target.value;
              if (cat === "Llenado Tanque")
                setForm({ ...form, category: cat, unit: "litro", type: "tanque" });
              else if (cat === "Botellones")
                setForm({ ...form, category: cat, unit: "unidad", type: "botellon" });
              else setForm({ ...form, category: cat });
            }}
          >
            <option>Llenado Tanque</option>
            <option>Botellones</option>
            <option>Artículos de limpieza</option>
          </select>
        </div>

        <div className="col-md-2">
          <label className="form-label small text-muted">Unidad</label>
          <select
            className="form-select form-select-sm"
            value={form.unit}
            onChange={e => setForm({ ...form, unit: e.target.value })}
          >
            <option value="unidad">Unidad</option>
            <option value="kg">Kg</option>
            <option value="litro">Litro</option>
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label small text-muted">
            {form.unit === "litro" ? "Cantidad (litros)" : "Cantidad"}
          </label>
          <input
            type="number"
            className="form-control form-control-sm"
            value={form.quantity}
            onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
          />
        </div>

        <div className="col-md-3">
          <label className="form-label small text-muted">Precio</label>
          <input
            type="number"
            className="form-control form-control-sm"
            placeholder="$0.00"
            value={form.price}
            onChange={e => setForm({ ...form, price: Number(e.target.value) })}
          />
        </div>

        <div className="col-md-3">
          <label className="form-label small text-muted">Capacidad tanque (L)</label>
          <input
            type="number"
            className="form-control form-control-sm"
            value={form.capacity}
            onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
          />
        </div>

        <div className="col-md-3 d-flex align-items-end">
          <button className="btn btn-primary btn-sm w-100" onClick={submit}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  </div>

  {/* TABLA */}
  <div className="card shadow-sm border-0">
    <div className="card-body p-0">
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock</th>
              <th>Estado</th>
              <th className="text-end">Precio</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => {
              const pct = i.capacity
                ? Math.min(100, Math.round((i.quantity / i.capacity) * 100))
                : null;

              return (
                <tr key={i._id}>
                  <td className="fw-medium">{i.name}</td>
                  <td>
                    <span className="badge bg-secondary">
                      {i.category || i.type}
                    </span>
                  </td>
                  <td>
                    {i.quantity} {i.unit}
                  </td>
                  <td>
                    {pct !== null ? (
                      <span
                        className={`badge ${
                          pct >= 70
                            ? "bg-success"
                            : pct >= 30
                            ? "bg-warning text-dark"
                            : "bg-danger"
                        }`}
                      >
                        {pct}%
                      </span>
                    ) : (
                      <small className="text-muted">N/A</small>
                    )}
                  </td>
                  <td className="text-end">${i.price}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-success me-2"
                      onClick={() => sellProduct(i)}
                    >
                      <FaCashRegister />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => editProduct(i)}
                    >
                      <FaEdit />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteProduct(i)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
  )
}
