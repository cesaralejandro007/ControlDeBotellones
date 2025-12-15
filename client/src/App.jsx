import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Houses from './pages/Houses'
import Inventory from './pages/Inventory'
import Payments from './pages/Payments'
import Login from './pages/Login'
import Register from './pages/Register'
import HouseDetail from './pages/HouseDetail'
import Movements from './pages/Movements'
import Dashboard from './pages/Dashboard'
import TankDashboard from './pages/TankDashboard'
import TankManagement from './pages/TankManagement'
import Users from './pages/Users'

import {
  FaHome,
  FaMoneyBillWave,
  FaBoxOpen,
  FaBoxes,
  FaTachometerAlt,
  FaUsers,
  FaWater
} from 'react-icons/fa'

export default function App() {
  const { user, logout } = useAuth()

  const linkClass = ({ isActive }) =>
    `nav-link d-flex align-items-center gap-1 ${isActive ? 'active fw-semibold' : ''}`

  return (
    <div className="app">
      {/* 🔹 NAVBAR */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light border-bottom shadow-sm">
        <div className="container">
          <NavLink className="navbar-brand fw-bold" to="/">
            💧 Control Botellones
          </NavLink>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNavbar"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="mainNavbar">
            {/* LEFT MENU */}
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <NavLink to="/" className={linkClass}>
                  <FaHome /> Casas
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink to="/payments" className={linkClass}>
                  <FaMoneyBillWave /> Pagos
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink to="/inventory" className={linkClass}>
                  <FaBoxOpen /> Inventario
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink to="/movements" className={linkClass}>
                  <FaBoxes /> Movimientos
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink to="/dashboard" className={linkClass}>
                  <FaTachometerAlt /> Dashboard
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink to="/tanks" className={linkClass}>
                  <FaWater /> Tanques
                </NavLink>
              </li>

              {user?.role === 'admin' && (
                <li className="nav-item">
                  <NavLink to="/users" className={linkClass}>
                    <FaUsers /> Usuarios
                  </NavLink>
                </li>
              )}
            </ul>

            {/* RIGHT MENU */}
            <ul className="navbar-nav ms-auto">
              {user ? (
                <li className="nav-item dropdown">
                  <span
                    className="nav-link dropdown-toggle"
                    role="button"
                    data-bs-toggle="dropdown"
                  >
                    👤 {user.name}
                  </span>
                  <ul className="dropdown-menu dropdown-menu-end">
                    <li>
                      <button className="dropdown-item text-danger" onClick={logout}>
                        Cerrar sesión
                      </button>
                    </li>
                  </ul>
                </li>
              ) : (
                <li className="nav-item">
                  <NavLink to="/login" className="btn btn-outline-primary btn-sm">
                    Entrar
                  </NavLink>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>

      {/* 🔹 CONTENT */}
      <main className="container py-4">
        <Routes>
          <Route path="/" element={<Houses />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/houses/:id" element={<HouseDetail />} />
          <Route path="/movements" element={<Movements />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tanks" element={<TankDashboard />} />
          <Route path="/tanks/:id" element={<TankManagement />} />
          <Route path="/users" element={<Users />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/inventory" element={<Inventory />} />
        </Routes>
      </main>
    </div>
  )
}
