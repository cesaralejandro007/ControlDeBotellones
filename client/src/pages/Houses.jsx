import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Swal from 'sweetalert2'
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa'

export default function Houses(){
  const [houses, setHouses] = useState([])
  const [form, setForm] = useState({ code: '', ownerName: '', phone: '' })
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { if (!user) { navigate('/login') } else { fetchHouses() } }, [user])

  const fetchHouses = async () => {
    const res = await axios.get('http://localhost:4000/api/houses')
    setHouses(res.data)
  }

  const submit = async () => {
    if (!form.code || !form.ownerName) return Swal.fire('Faltan datos', 'El código y el nombre son obligatorios', 'warning')
    try{
      await axios.post('http://localhost:4000/api/houses', form)
      setForm({ code: '', ownerName: '', phone: '' })
      fetchHouses()
      Swal.fire('Creado', 'Casa creada correctamente', 'success')
    }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
  }

  const editHouse = async (h) => {
    const { value: data } = await Swal.fire({
      title: 'Editar casa',
      html:
        `<input id="swal-code" class="swal2-input" placeholder="Código" value="${h.code}" />` +
        `<input id="swal-owner" class="swal2-input" placeholder="Propietario" value="${h.ownerName || ''}" />` +
        `<input id="swal-phone" class="swal2-input" placeholder="Teléfono" value="${h.phone || ''}" />`,
      focusConfirm: false,
      preConfirm: () => ({
        code: document.getElementById('swal-code').value,
        ownerName: document.getElementById('swal-owner').value,
        phone: document.getElementById('swal-phone').value
      })
    })
    if (data) {
      try{
        await axios.put(`http://localhost:4000/api/houses/${h._id}`, data)
        fetchHouses()
        Swal.fire('Guardado', 'Casa actualizada', 'success')
      }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
    }
  }

  const deleteHouse = async (h) => {
    const res = await Swal.fire({ title: 'Confirmar', text: `Eliminar ${h.code}?`, icon: 'warning', showCancelButton: true })
    if (res.isConfirmed) {
      try{ await axios.delete(`http://localhost:4000/api/houses/${h._id}`); fetchHouses(); Swal.fire('Eliminado','Casa eliminada','success') }catch(err){ Swal.fire('Error', err.response?.data?.error || err.message, 'error') }
    }
  }

  return (
    <div className="container mt-3">
      <div className="d-flex justify-content-between align-items-center">
        <h2>Casas</h2>
        <button className="btn btn-primary" onClick={()=>document.getElementById('create-form-code')?.focus()}><FaPlus/> Nuevo</button>
      </div>

      <div className="card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <label className="form-label">Código</label>
            <input id="create-form-code" className="form-control" placeholder="Ej: P-19" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Propietario</label>
            <input className="form-control" placeholder="Nombre" value={form.ownerName} onChange={e=>setForm({...form, ownerName:e.target.value})} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Teléfono</label>
            <input className="form-control" placeholder="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button className="btn btn-success w-100" onClick={submit}>Crear casa</button>
          </div>
        </div>
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>Código</th>
            <th>Propietario</th>
            <th>Teléfono</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {houses.map(h=> (
            <tr key={h._id}>
              <td><Link to={`/houses/${h._id}`}>{h.code}</Link></td>
              <td>{h.ownerName}</td>
              <td>{h.phone}</td>
              <td>
                <button className="btn btn-sm btn-outline-primary me-2" onClick={()=>editHouse(h)}><FaEdit/></button>
                <button className="btn btn-sm btn-outline-danger" onClick={()=>deleteHouse(h)}><FaTrash/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
