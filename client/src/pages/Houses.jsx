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
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
    }
  };

  const submit = async () => {
    if (!form.code || !form.ownerName)
      return Swal.fire(
        "Faltan datos",
        "El código y el nombre son obligatorios",
        "warning"
      );
    try {
      await axios.post("http://localhost:4000/api/houses", form);
      setForm({ code: "", ownerName: "", phone: "" });
      fetchHouses();
      Swal.fire("Creado", "Casa creada correctamente", "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
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
        Swal.fire("Guardado", "Casa actualizada", "success");
      } catch (err) {
        Swal.fire("Error", err.response?.data?.error || err.message, "error");
      }
    }
  };

  const deleteHouse = async (h) => {
    const res = await Swal.fire({
      title: "Confirmar",
      text: `Eliminar ${h.code}?`,
      icon: "warning",
      showCancelButton: true,
    });
    if (res.isConfirmed) {
      try {
        await axios.delete(`http://localhost:4000/api/houses/${h._id}`);
        fetchHouses();
        Swal.fire("Eliminado", "Casa eliminada", "success");
      } catch (err) {
        Swal.fire("Error", err.response?.data?.error || err.message, "error");
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
      style={{ backgroundColor: "#f8f9fa", minHeight: "90vh" }}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="fw-bold text-secondary">Casas</h2>
        <button
          className="btn btn-primary shadow-sm"
          onClick={() => document.getElementById("create-form-code")?.focus()}
        >
          <FaPlus /> Nuevo
        </button>
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
              className="form-control border-secondary"
              placeholder="Ej: P-19"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label text-muted">Propietario</label>
            <input
              className="form-control border-secondary"
              placeholder="Nombre"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label text-muted">Teléfono</label>
            <input
              className="form-control border-secondary"
              placeholder="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button
              className="btn btn-success w-100 shadow-sm"
              onClick={submit}
            >
              Crear casa
            </button>
          </div>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="input-group mb-3">
        <span className="input-group-text bg-white border-secondary">
          <FaSearch />
        </span>
        <input
          type="text"
          className="form-control border-secondary"
          placeholder="Buscar por código o propietario"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLA */}
      <div className="table-responsive">
        <table
          className="table align-middle"
          style={{ backgroundColor: "#ffffff", borderRadius: "6px" }}
        >
          <thead style={{ backgroundColor: "#e9ecef", color: "#495057" }}>
            <tr>
              <th>Código</th>
              <th>Propietario</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredHouses.length ? (
              filteredHouses.map((h) => (
                <tr
                  key={h._id}
                  className="align-middle"
                  style={{ transition: "0.2s", cursor: "pointer" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f1f3f5")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#ffffff")
                  }
                >
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
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => editHouse(h)}
                    >
                      {" "}
                      <FaEdit />{" "}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteHouse(h)}
                    >
                      {" "}
                      <FaTrash />{" "}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center text-muted">
                  No se encontraron casas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
