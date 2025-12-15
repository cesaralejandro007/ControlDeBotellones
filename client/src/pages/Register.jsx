import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { FaUser, FaEnvelope, FaLock, FaUserPlus } from 'react-icons/fa'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const navigate = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await axios.post('http://localhost:4000/api/auth/register', { name, email, password })
      setSuccess('Usuario creado correctamente. Ingresa tus credenciales.')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center">
      <div className="col-12 col-md-5 col-lg-4">
        <div className="card shadow-lg border-0">
          <div className="card-body p-4">
            <h3 className="text-center fw-bold mb-4">
              📝 Registro
            </h3>

            {error && (
              <div className="alert alert-danger py-2 text-center">{error}</div>
            )}
            {success && (
              <div className="alert alert-success py-2 text-center">{success}</div>
            )}

            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label">Nombre</label>
                <div className="input-group">
                  <span className="input-group-text">
                    <FaUser />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Correo electrónico</label>
                <div className="input-group">
                  <span className="input-group-text">
                    <FaEnvelope />
                  </span>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="usuario@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Contraseña</label>
                <div className="input-group">
                  <span className="input-group-text">
                    <FaLock />
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2"
                disabled={loading}
              >
                {loading ? 'Registrando...' : <>
                  <FaUserPlus /> Registrar
                </>}
              </button>
            </form>

            <div className="text-center mt-4">
              <small>
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="fw-semibold">
                  Inicia sesión
                </Link>
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
