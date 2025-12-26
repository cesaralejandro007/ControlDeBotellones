import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
    else fetch(1);
  }, [user]);

  const fetch = async (p = 1, q = "") => {
    try {
      const qs =
        `page=${p}&limit=${limit}` +
        (q ? `&search=${encodeURIComponent(q)}` : "");
      const res = await axios.get(`http://localhost:4000/api/users?${qs}`);
      setUsers(res.data.users);
      setPage(res.data.page);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No autorizado o error", "error");
    }
  };

  const changeRole = async (id, role) => {
    const result = await Swal.fire({
      title: "Confirmar",
      text: `Cambiar rol a ${role}?`,
      icon: "question",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;
    try {
      await axios.put(`http://localhost:4000/api/users/${id}/role`, { role });
      Swal.fire("OK", "Rol actualizado", "success");
      fetch(page, search);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo cambiar rol", "error");
    }
  };

  const deleteUser = async (id) => {
    const result = await Swal.fire({
      title: "Eliminar usuario",
      text: "Esta acción es irreversible",
      icon: "warning",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;
    try {
      await axios.delete(`http://localhost:4000/api/users/${id}`);
      Swal.fire("Eliminado", "Usuario eliminado", "success");
      fetch(1, search);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo eliminar", "error");
    }
  };

  return (
    <div className="container mt-3">
      <h2>Usuarios</h2>
      <div className="mb-3 d-flex">
        <input
          className="form-control me-2"
          placeholder="Buscar por nombre o email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") fetch(1, search);
          }}
        />
        <button className="btn btn-primary" onClick={() => fetch(1, search)}>
          Buscar
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                <button
                  className="btn btn-sm btn-outline-primary me-2"
                  onClick={() =>
                    changeRole(u._id, u.role === "admin" ? "user" : "admin")
                  }
                >
                  {u.role === "admin" ? "Degenerar" : "Promover"}
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => deleteUser(u._id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="d-flex justify-content-between align-items-center">
        <div>
          Mostrando página {page} — {Math.min(limit, users.length)} de {total}{" "}
          usuarios
        </div>
        <div>
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            disabled={page <= 1}
            onClick={() => fetch(page - 1, search)}
          >
            Anterior
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={page * limit >= total}
            onClick={() => fetch(page + 1, search)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
