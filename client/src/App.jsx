import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Houses from "./pages/Houses";
import Inventory from "./pages/Inventory";
import Payments from "./pages/Payments";
import Login from "./pages/Login";
import Register from "./pages/Register";
import HouseDetail from "./pages/HouseDetail";
import Movements from "./pages/Movements";
import Dashboard from "./pages/Dashboard";
import TankDashboard from "./pages/TankDashboard";
import TankManagement from "./pages/TankManagement";
import Users from "./pages/Users";

import Layout from "./components/layout/Layout";

export default function App() {
  const { user, logout } = useAuth();

  return (
    <Routes>
      {/* 🔐 SIN SESIÓN */}
      {!user && (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </>
      )}

      {/* 🔓 CON SESIÓN */}
      {user && (
        <Route element={<Layout user={user} logout={logout} />}>
          {/* ⭐ RUTA PRINCIPAL AHORA ES DASHBOARD */}
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="houses" element={<Houses />} />
          <Route path="houses/:id" element={<HouseDetail />} />
          <Route path="payments" element={<Payments />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="movements" element={<Movements />} />
          <Route path="tanks" element={<TankDashboard />} />
          <Route path="tanks/:id" element={<TankManagement />} />
          <Route path="users" element={<Users />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      )}
    </Routes>
  );
}
