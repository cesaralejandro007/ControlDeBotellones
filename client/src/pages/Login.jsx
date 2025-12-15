import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FaEnvelope, FaLock, FaSignInAlt } from 'react-icons/fa'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await axios.post(
        'http://localhost:4000/api/auth/login',
        { email, password }
      )

      login(res.data.user, res.data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales inválidas')
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
              🔐 Iniciar sesión
            </h3>

            {error && (
              <div className="alert alert-danger py-2 text-center">
                {error}
              </div>
            )}

            <form onSubmit={submit}>
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
                className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                disabled={loading}
              >
                {loading ? 'Ingresando...' : <>
                  <FaSignInAlt /> Entrar
                </>}
              </button>
            </form>

            <div className="text-center mt-4">
              <small>
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="fw-semibold">
                  Regístrate
                </Link>
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
