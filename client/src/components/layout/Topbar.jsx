import React from "react";
import {
  FaBars,
  FaUserCircle,
  FaSignOutAlt,
} from "react-icons/fa";

const Topbar = ({ user, logout, onMenuClick }) => {
  return (
    <header className="topbar">
      {/* ☰ MENU MOBILE */}
      <button
        className="menu-btn"
        onClick={onMenuClick}
        aria-label="Abrir menú"
      >
        <FaBars />
      </button>

      {/* 👤 USUARIO */}
      <div className="topbar-user">
        <FaUserCircle className="user-icon" />
        <span className="user-name">{user.name}</span>
      </div>

      {/* 🚪 LOGOUT */}
      <button
        onClick={logout}
        className="btn-logout"
        title="Cerrar sesión"
      >
        <FaSignOutAlt />
        <span className="logout-text">Salir</span>
      </button>
    </header>
  );
};

export default Topbar;
