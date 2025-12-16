import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Outlet } from "react-router-dom";
import Footer from "./Footer";

const Layout = ({ user, logout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout d-flex">
      {/* OVERLAY (solo mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar open={sidebarOpen} user={user} onClose={() => setSidebarOpen(false)} />

      <div className="main flex-grow-1">
        <Topbar
          user={user}
          logout={logout}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="content p-4">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
