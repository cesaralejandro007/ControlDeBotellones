import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function Register(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const submit = async () => {
    try{
      await axios.post('http://localhost:4000/api/auth/register', { name, email, password })
      alert('Usuario creado. Ingresa tus credenciales.')
      navigate('/login')
    }catch(err){ alert(err.response?.data?.error || err.message) }
  }

  return (
    <div>
      <h2>Registro</h2>
      <input placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={submit}>Registrar</button>
    </div>
  )
}
