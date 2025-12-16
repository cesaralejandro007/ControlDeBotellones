import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaPlus, FaSearch } from "react-icons/fa";

export default function Houses() {
  const [houses, setHouses] = useState([]);
  const [form, setForm] = useState({ code: "", ownerName: "", phone: "" });
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
    else fetchHouses();
  }, [user]);

  const fetchHouses = async () => {
    try {
      const res = await axios.get("http://localhost:4000/api/houses");
      setHouses(res.data);
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err.response?.data?.error || err.message,
        icon: "error",
        confirmButtonColor: "#3085d6",
      });
    }
  };

  const submit = async () => {
    if (!form.code || !form.ownerName)
      return Swal.fire({
        title: "Faltan datos",
        text: "El código y el nombre son obligatorios",
        icon: "warning",
        confirmButtonColor: "#3085d6",
      });
    try {
      await axios.post("http://localhost:4000/api/houses", form);
      setForm({ code: "", ownerName: "", phone: "" });
      fetchHouses();
      Swal.fire({
        title: "Creado",
        text: "Casa creada correctamente",
        icon: "success",
        confirmButtonColor: "#3085d6",
      });
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err.response?.data?.error || err.message,
        icon: "error", 
        confirmButtonColor: "#3085d6",
      });
    }
  };

  const editHouse = async (h) => {
    const { value: data } = await Swal.fire({
      title: "Editar casa",
      html:
        `<input id="swal-code" class="swal2-input" placeholder="Código" value="${h.code}" />` +
        `<input id="swal-owner" class="swal2-input" placeholder="Propietario" value="${
          h.ownerName || ""
        }" />` +
        `<input id="swal-phone" class="swal2-input" placeholder="Teléfono" value="${
          h.phone || ""
        }" />`,
      focusConfirm: false,
      confirmButtonColor: "#3085d6",
      preConfirm: () => ({
        code: document.getElementById("swal-code").value,
        ownerName: document.getElementById("swal-owner").value,
        phone: document.getElementById("swal-phone").value,
      }),
    });
    if (data) {
      try {
        await axios.put(`http://localhost:4000/api/houses/${h._id}`, data);
        fetchHouses();
        Swal.fire({
          title: "Cambios guardados",
          text: "Se han guardado los cambios realizados.",
          icon: "success", 
          confirmButtonColor: "#3085d6",
        });
      } catch (err) {
        Swal.fire({
          title: "Error",
          text: err.response?.data?.error || err.message,
          icon: "error",
          confirmButtonColor: "#3085d6",
        });
      }
    }
  };

  const deleteHouse = async (h) => {
    const res = await Swal.fire({
      title: "Confirmar",
      text: `Eliminar ${h.code}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (res.isConfirmed) {
      try {
        await axios.delete(`http://localhost:4000/api/houses/${h._id}`);
        fetchHouses();
        Swal.fire({
          title: "Eliminado",
          text: "Casa eliminada correctamente",
          icon: "success",
          confirmButtonColor: "#3085d6",
        });
      } catch (err) {
        Swal.fire(
          {title: "Error",
          text: err.response?.data?.error || err.message,
          icon: "error",
          confirmButtonColor: "#3085d6",}
        );
      }
    }
  };

  const filteredHouses = houses.filter(
    (h) =>
      h.code.toLowerCase().includes(search.toLowerCase()) ||
      (h.ownerName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="container mt-4"
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Casas</h4>
      </div>

      {/* FORM CREAR */}
      <div
        className="card p-3 mb-4 shadow-sm border-0"
        style={{ backgroundColor: "#ffffff" }}
      >
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label text-muted">Código</label>
            <input
              id="create-form-code"
              className="form-control"
              placeholder="Ej: P-19"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label text-muted">Propietario</label>
            <input
              className="form-control"
              placeholder="Nombre"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label text-muted">Teléfono</label>
            <input
              className="form-control"
              placeholder="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button
              className="btn btn-primary w-100 shadow-sm"
              onClick={submit}
            >
              <FaPlus /> Crear casa
            </button>
          </div>
        </div>
      </div>

      {/* BUSCADOR */}

      {/* TABLA */}
      <div className="card shadow-sm mb-4 border-0">
  <div className="card-body p-3">

    {/* 🔍 BUSCADOR */}
    <div className="input-group mb-3">
      <span className="input-group-text bg-white border-end-0">
        <FaSearch className="text-muted" />
      </span>
      <input
        type="text"
        className="form-control border-start-0"
        placeholder="Buscar por código o propietario"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    {/* 📋 TABLA */}
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Código</th>
            <th>Propietario</th>
            <th>Teléfono</th>
            <th className="text-end">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {filteredHouses.length ? (
            filteredHouses.map((h) => (
              <tr key={h._id}>
                <td>
                  <Link
                    to={`/houses/${h._id}`}
                    className="fw-semibold text-dark"
                  >
                    {h.code}
                  </Link>
                </td>
                <td>{h.ownerName}</td>
                <td>{h.phone}</td>
                <td className="text-end">
                  <button
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={() => editHouse(h)}
                    title="Editar"
                  >
                    <FaEdit />
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => deleteHouse(h)}
                    title="Eliminar"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" className="text-center text-muted py-4">
                No se encontraron casas
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

  </div>
</div>

    </div>
  );
}
