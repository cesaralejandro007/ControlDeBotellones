import React from "react";
import {
  FaHome,
  FaMoneyBillWave,
  FaBoxOpen,
  FaBoxes,
  FaTachometerAlt,
  FaWater,
  FaUsers,
  FaTimes,
} from "react-icons/fa";
import { NavLink } from "react-router-dom";

const Sidebar = ({ user, open, onClose }) => {
  const linkClass = ({ isActive }) =>
    `sidebar-link ${isActive ? "active" : ""}`;

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      {/* HEADER */}
      <div className="sidebar-header">
        <span className="sidebar-logo">
          💧 Control Botellones
        </span>

        {/* ❌ BOTÓN CERRAR (solo mobile) */}
        <button className="sidebar-close" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <nav className="sidebar-nav">
      <NavLink to="/" className={linkClass} onClick={onClose}>
        <FaTachometerAlt className="me-2" /> Dashboard
      </NavLink>

        <NavLink to="/houses" className={linkClass} onClick={onClose}>
          <FaHome /> Casas
        </NavLink>

        <NavLink to="/payments" className={linkClass} onClick={onClose}>
          <FaMoneyBillWave /> Pagos
        </NavLink>

        <NavLink to="/inventory" className={linkClass} onClick={onClose}>
          <FaBoxOpen /> Inventario
        </NavLink>

        <NavLink to="/movements" className={linkClass} onClick={onClose}>
          <FaBoxes /> Movimientos
        </NavLink>

        <NavLink to="/tanks" className={linkClass} onClick={onClose}>
          <FaWater /> Tanques
        </NavLink>

        {user?.role === "admin" && (
          <NavLink to="/users" className={linkClass} onClick={onClose}>
            <FaUsers /> Usuarios
          </NavLink>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
