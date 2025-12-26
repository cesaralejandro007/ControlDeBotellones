import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Swal from 'sweetalert2'
import { FaEdit, FaTrash } from 'react-icons/fa'
import { FaCashRegister } from 'react-icons/fa'

export default function Inventory(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name: '', type: 'botellon', category: 'Botellones', unit: 'unidad', quantity: 0, minStock: 0, price: 0 })
  const [lowStockItems, setLowStockItems] = useState([])
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(()=>{ if (!user) navigate('/login'); else fetch() },[user])
  const fetch = async ()=>{ try{ const res = await axios.get('http://localhost:4000/api/inventory'); setItems(res.data) }catch(e){ console.error(e) } }
  useEffect(() => {
    const low = items.filter(i => {
      if (!i.minStock || i.minStock <= 0) return false

      const pct = i.quantity / i.minStock
      return pct <= 0.3   // 👈 30%
    })

    setLowStockItems(low)
  }, [items])


  const submit = async ()=>{
    if (!form.name) return Swal.fire({
      title: "Faltan datos",
      text: "El nombre del producto es obligatorio",
      icon: "warning",
      confirmButtonColor: "#3085d6",
    });
    try{
      // enviar category y unit al backend
      await axios.post('http://localhost:4000/api/inventory', form)
      setForm({ name:'', type:'botellon', category: 'Botellones', unit: 'unidad', quantity:0, minStock: 0, price:0 })
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
        `<input id="swal-minStock" class="swal2-input" type="number" placeholder="Stock mínimo" value="${p.minStock || 0}" />` +
        `<input id="swal-price" class="swal2-input" type="number" placeholder="Precio" value="${p.price || 0}" />`,
      focusConfirm: false,
      confirmButtonColor: '#3085d6',
      preConfirm: () => ({
        name: document.getElementById('swal-name').value,
        category: document.getElementById('swal-category').value,
        unit: document.getElementById('swal-unit').value,
        quantity: parseFloat(document.getElementById('swal-qty').value) || 0,
        minStock: parseFloat(document.getElementById('swal-minStock').value) || 0, // 👈 AQUÍ
        price: parseFloat(document.getElementById('swal-price').value) || 0
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


  const res = await Swal.fire({
    title: 'Confirmar',
    text: `¿Eliminar / desactivar ${p.name}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: "Sí, continuar",
    cancelButtonColor: '#3085d6'
  });

  if (!res.isConfirmed) return;

  try {
    const response = await axios.delete(`http://localhost:4000/api/inventory/${p._id}`);

    if (response.data.disabled) {
      Swal.fire({
        title: 'Desactivado',
        text: 'Tanque desactivado correctamente',
        icon: 'success',
      });
    } else {
      Swal.fire({
        title: 'Eliminado',
        text: 'Producto eliminado correctamente',
        icon: 'success',
      });
    }

    fetch();

  } catch (err) {
    Swal.fire({
      title: 'Error',
      text: err.response?.data?.error || err.message,
      icon: 'error'
    });
  }
}


  const sellProduct = async (p) => {
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
  {/* ALERTA STOCK BAJO */}
  {lowStockItems.length > 0 && (
    <div className="alert alert-warning d-flex align-items-center py-2">
      <i className="bi bi-exclamation-triangle-fill me-2"></i>
      <small>
        Productos con stock bajo:&nbsp;
        <strong>
          {lowStockItems.map(p => {
            const pct = Math.round((p.quantity / p.minStock) * 100)
            return `${p.name} (${pct}%)`
          }).join(', ')}
        </strong>
      </small>
    </div>
  )}
  {/* FORMULARIO SOLO PARA PRODUCTOS NORMALES */}
<div className="card shadow-sm border-0 mb-4">
  <div className="card-body">
    <h6 className="fw-semibold mb-3">
      {form._id ? 'Actualizar producto' : 'Agregar producto'}
    </h6>

    <div className="row g-3">
      {/* Nombre */}
      <div className="col-md-4">
        <label className="form-label small text-muted">
          Nombre del producto
        </label>
        <input
          className="form-control form-control-sm"
          placeholder="Ej: Botellón vacío"
          value={form.name}
          onChange={e =>
            setForm({ ...form, name: e.target.value })
          }
        />
      </div>

      {/* Categoría */}
      <div className="col-md-3">
        <label className="form-label small text-muted">
          Categoría
        </label>
        <select
          className="form-select form-select-sm"
          value={form.category}
          onChange={e =>
            setForm({ ...form, category: e.target.value })
          }
        >
          <option value="">Seleccionar</option>
          <option>Botellones</option>
          <option>Dispensadores</option>
          <option>Artículos de limpieza</option>
          <option>Repuestos</option>
          <option>Otros</option>
        </select>
      </div>

      {/* Unidad */}
      <div className="col-md-2">
        <label className="form-label small text-muted">
          Unidad
        </label>
        <select
          className="form-select form-select-sm"
          value={form.unit}
          onChange={e =>
            setForm({ ...form, unit: e.target.value })
          }
        >
          <option value="unidad">Unidad</option>
          <option value="kg">Kg</option>
          <option value="litro">Litro</option>
        </select>
      </div>

      {/* Precio */}
      <div className="col-md-3">
        <label className="form-label small text-muted">
          Precio unitario
        </label>
        <input
          type="number"
          className="form-control form-control-sm"
          placeholder="$0.00"
          value={form.price}
          onChange={e =>
            setForm({ ...form, price: Number(e.target.value) })
          }
        />
      </div>

      {/* Cantidad */}
      <div className="col-md-3">
        <label className="form-label small text-muted">
          Cantidad actual
        </label>
        <input
          type="number"
          className="form-control form-control-sm"
          value={form.quantity}
          onChange={e =>
            setForm({ ...form, quantity: Number(e.target.value) })
          }
        />
      </div>

      {/* Stock mínimo */}
      <div className="col-md-3">
        <label className="form-label small text-muted">
          Stock mínimo
        </label>
        <input
          type="number"
          className="form-control form-control-sm"
          placeholder="Alerta cuando baje de..."
          value={form.minStock || ''}
          onChange={e =>
            setForm({ ...form, minStock: Number(e.target.value) })
          }
        />
      </div>

      {/* Botón */}
      <div className="col-md-3 d-flex align-items-end">
        <button
          className="btn btn-primary btn-sm w-100"
          onClick={submit}
        >
          {form._id ? 'Actualizar' : 'Guardar'}
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
              <th>Estado del inventario</th>
              <th className="text-end">Precio unitario</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.filter(i => i.type !== 'tanque' && i.category !== 'Llenado Tanque').map(i => {
              return (
                <tr key={i._id}
                className={
                  i.minStock > 0 && (i.quantity / i.minStock) <= 0.3
                    ? 'table-warning'
                    : ''
                }>
                  <td className="fw-medium">{i.name}</td>
                  <td><span className="badge bg-secondary">{i.category || i.type}</span></td>
                  <td>{i.quantity} {i.unit}</td>
<td>
  {(() => {
    const min = i.minStock || 0
    if (!min) return <span className="text-muted">N/A</span>

    const pct = Math.min(100, Math.round((i.quantity / min) * 100))
    const cls =
      pct >= 70 ? 'bg-success' :
      pct >= 30 ? 'bg-warning' :
      'bg-danger'

    return (
      <div className="d-flex align-items-center gap-2">
        <div className="progress flex-grow-1" style={{ height: '10px' }}>
          <div
            className={`progress-bar ${cls}`}
            style={{ width: pct + '%' }}
          />
        </div>
        <small className="fw-semibold">{pct}%</small>
      </div>
    )
  })()}
</td>

                  <td className="text-end">${i.price}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-success me-2" onClick={() => sellProduct(i)}><FaCashRegister /></button>
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => editProduct(i)}><FaEdit /></button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteProduct(i)}><FaTrash /></button>
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
