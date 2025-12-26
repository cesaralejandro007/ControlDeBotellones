import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts";
import Swal from "sweetalert2";

// Helper para obtener el token JWT SIEMPRE desde localStorage (independiente del contexto de usuario)
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TankDashboard() {
  const [tanks, setTanks] = useState(null);
  const [lowTanks, setLowTanks] = useState([])
  const [form, setForm] = useState({
    name: "",
    capacity: 0,
    pricePerFill: 0,
    litersPerBottle: 20,
  });
  const [editing, setEditing] = useState(null);
  const refs = useRef({});

  // Cargar tanques si hay token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetchTanks();
  }, []);
  

  const fetchTanks = async () => {
    try {
      const res = await axios.get(
        "http://localhost:4000/api/inventory/tanks/summary?days=30",
        {
          headers: getAuthHeaders(),
        }
      );
      setTanks(res.data || []);
    } catch (err) {
      setTanks([]);
    }
  };

  useEffect(() => {
    if (!tanks) return

    const low = tanks.filter(t => {
      if (!t.capacity || !t.quantity) return false
      const pct = (t.quantity / t.capacity) * 100
      return pct < 30
    })

    setLowTanks(low)
  }, [tanks])
    

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.capacity || form.capacity <= 0) {
      return Swal.fire(
        "Faltan datos",
        "Nombre y capacidad requeridos",
        "warning"
      );
    }
    try {
      if (editing) {
        await axios.put(
          `http://localhost:4000/api/inventory/tanks/${editing}`,
          form,
          { headers: getAuthHeaders() }
        );
      } else {
        await axios.post("http://localhost:4000/api/inventory/tanks", form, {
          headers: getAuthHeaders(),
        });
      }
      setForm({ name: "", capacity: 0, pricePerFill: 0, litersPerBottle: 20 });
      setEditing(null);
      fetchTanks();
      Swal.fire(
        "Listo",
        editing ? "Tanque actualizado" : "Tanque creado",
        "success"
      );
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
    }
  };

  const handleEdit = (tank) => {
    setForm({
      name: tank.name,
      capacity: tank.capacity,
      pricePerFill: tank.pricePerFill || 0,
      litersPerBottle: tank.litersPerBottle || 20,
    });
    setEditing(tank.id);
  };

  const handleActivate = async (tank) => {
    try {
      await axios.put(
        `http://localhost:4000/api/inventory/tanks/activate/${tank.productId}`,
        {},
        { headers: getAuthHeaders() }
      );
      fetchTanks();
      Swal.fire("Activado", "Tanque activado correctamente", "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
    }
  };

  const handleDelete = async (tank) => {
    if (tank.isActive) {
      return Swal.fire(
        "No permitido",
        "No puedes eliminar el tanque activo. Activa otro tanque primero.",
        "warning"
      );
    }
    const res = await Swal.fire({
      title: "¿Eliminar tanque?",
      text: `¿Eliminar o desactivar el tanque ${tank.name}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, continuar",
      cancelButtonColor: "#3085d6",
    });
    if (!res.isConfirmed) return;
    try {
      await axios.delete(
        `http://localhost:4000/api/inventory/tanks/${tank.id}`,
        { headers: getAuthHeaders() }
      );
      setTanks((prev) => prev.filter((t) => t.id !== tank.id));
      Swal.fire("Listo", "Tanque eliminado/desactivado", "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
    }
  };

  const handleRecharge = async (tank) => {
    const { value: liters } = await Swal.fire({
      title: `Recargar tanque ${tank.name}`,
      input: "number",
      inputLabel: "Litros a agregar",
      inputPlaceholder: "Cantidad de litros",
      showCancelButton: true,
      confirmButtonText: "Recargar",
      cancelButtonText: "Cancelar",
      inputAttributes: { min: 1 },
    });
    if (!liters || isNaN(liters) || liters <= 0) return;
    try {
      await axios.post(
        `http://localhost:4000/api/inventory/tanks/${tank.id}/recharge`,
        { liters: Number(liters) },
        { headers: getAuthHeaders() }
      );
      fetchTanks();
      Swal.fire("Recargado", "Tanque recargado correctamente", "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
    }
  };

  useEffect(() => {
  if (!tanks) return

  tanks.forEach((t) => {
    const el = refs.current[t.id]
    if (!el) return

    if (!t.history.length) {
      el.innerHTML = '<small class="text-muted">Sin recargas registradas</small>'
      return
    }

    const yearlyData = groupByYearAndMonth(t.history)

    Object.entries(yearlyData).forEach(([year, months]) => {
      const categories = Object.keys(months)
        .sort()
        .map(m => `${m}/${year}`)

      const data = Object.keys(months)
        .sort()
        .map(m => months[m])

      Highcharts.chart(el, {
        chart: { type: 'column' },
        title: { text: `Recargas ${t.name} - ${year}` },
        xAxis: {
          categories,
          title: { text: 'Mes' }
        },
        yAxis: {
          min: 0,
          title: { text: 'Litros recargados' }
        },
        tooltip: {
          formatter: function () {
            return `<b>${this.x}</b><br/>Total recargado: <b>${this.y} litros</b>`
          }
        },
        series: [{
          name: 'Recargas mensuales',
          data
        }],
        credits: { enabled: false }
      })
    })
  })
}, [tanks])

  function groupByYearAndMonth(history) {
    const map = {};

    history.forEach((h) => {
      const [year, month] = h.date.split("-");

      if (!map[year]) map[year] = {};

      map[year][month] = (map[year][month] || 0) + h.litersAdded;
    });

    return map;
  }

  const token = localStorage.getItem("token");
  if (!token)
    return <div className="text-center py-5">Accede para ver los tanques</div>;
  if (!tanks)
    return <div className="text-center py-5">Cargando panel de tanques...</div>;

  return (
    <div className="container mt-3">
      <h2>Panel de Tanques</h2>
      <p>Gestión completa de tanques de llenado</p>

      {/* ALERTA TANQUES BAJOS */}
      {lowTanks.length > 0 && (
        <div className="alert alert-warning d-flex align-items-center py-2">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <small>
            Tanques con nivel bajo:&nbsp;
            <strong>{lowTanks.map(t => t.name).join(", ")}</strong>
          </small>
        </div>
      )}

      {/* Formulario alta/edición */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <h6 className="text-muted mb-3">
            {editing ? "Editar tanque" : "Agregar tanque"}
          </h6>
          <form className="row g-3" onSubmit={handleSubmit}>
            <div className="col-md-4">
              <label className="form-label small text-muted">Nombre</label>
              <input
                className="form-control form-control-sm"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">
                Capacidad (L)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={form.capacity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacity: Number(e.target.value) }))
                }
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">
                Precio por llenado (botellón)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={form.pricePerFill}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pricePerFill: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">
                Litros por botellón
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={form.litersPerBottle}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    litersPerBottle: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-primary btn-sm w-100" type="submit">
                {editing ? "Actualizar" : "Agregar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Tabla de tanques */}
      <div className="row">
        {tanks
          .filter((t) => !t.deleted) // 👈 AQUÍ VA
          .map((t) => (
            <div className="col-md-6 mb-3" key={t.id}>
              <div className="card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <h5 className="card-title mb-0">{t.name}</h5>
                      <small className="text-muted">
                        {t.quantity} L / {t.capacity} L •{" "}
                        {Math.floor(
                          (t.quantity || 0) / (t.litersPerBottle || 20)
                        )}{" "}
                        bot.
                      </small>
                    </div>
                    <div>
                      <span
                        className={`badge ${
                          t.status === "low"
                            ? "bg-danger"
                            : t.status === "medium"
                            ? "bg-warning text-dark"
                            : "bg-success"
                        }`}
                      >
                        {t.status}
                      </span>
                      <div className="mt-2 d-flex flex-column gap-1">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleEdit(t)}
                        >
                          Editar
                        </button>
                        {t.isActive !== true && (
                          <button
                            className="btn btn-sm btn-outline-info"
                            onClick={() => handleActivate(t)}
                          >
                            Activar
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(t)}
                        >
                          Eliminar
                        </button>
                        <button
                          className="btn btn-sm btn-outline-success"
                          onClick={() => handleRecharge(t)}
                        >
                          Recargar
                        </button>
                      </div>
                    </div>
                  </div>
                  <div
                    ref={(el) => (refs.current[t.id] = el)}
                    style={{ height: 200 }}
                  />
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
