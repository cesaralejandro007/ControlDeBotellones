import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Houses from './pages/Houses'
import Inventory from './pages/Inventory'
import Payments from './pages/Payments'
import Login from './pages/Login'
import HouseDetail from './pages/HouseDetail'
import Register from './pages/Register'
import Movements from './pages/Movements'
import { useAuth } from './context/AuthContext'
import { FaHome, FaMoneyBillWave, FaBoxOpen, FaBoxes } from 'react-icons/fa'
import { FaTachometerAlt, FaUsers } from 'react-icons/fa'
import Dashboard from './pages/Dashboard'
import TankDashboard from './pages/TankDashboard'
import TankManagement from './pages/TankManagement'
import Users from './pages/Users'

export default function App(){
  const { user, logout } = useAuth()
  return (
    <div className="app">
      <header className="bg-light border-bottom mb-3">
        <div className="container d-flex align-items-center justify-content-between py-2">
          <h1 className="h4 m-0">Control Botellones</h1>
          <nav>
            <Link className="me-3" to="/"><FaHome/> Casas</Link>
            <Link className="me-3" to="/payments"><FaMoneyBillWave/> Pagos</Link>
            <Link className="me-3" to="/inventory"><FaBoxOpen/> Inventario</Link>
            <Link className="me-3" to="/movements"><FaBoxes/> Movimientos</Link>
            <Link className="me-3" to="/dashboard"><FaTachometerAlt/> Dashboard</Link>
            {user && user.role === 'admin' && (<Link className="me-3" to="/users"><FaUsers/> Usuarios</Link>)}
            <Link className="me-3" to="/tanks">⛲ Tanques</Link>
            {user ? (<span className="ms-2">{user.name} <button className="btn btn-sm btn-link" onClick={logout}>Salir</button></span>) : (<span className="ms-2"><Link to="/login">Entrar</Link></span>)}
          </nav>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Houses/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/houses/:id" element={<HouseDetail/>} />
          <Route path="/movements" element={<Movements/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/tanks" element={<TankDashboard/>} />
          <Route path="/tanks/:id" element={<TankManagement/>} />
          <Route path="/users" element={<Users/>} />
          <Route path="/payments" element={<Payments/>} />
          <Route path="/inventory" element={<Inventory/>} />
        </Routes>
      </main>
    </div>
  )
}
