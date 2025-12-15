import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";

export default function Payments() {
  // --- ESTADOS ---
  const [payments, setPayments] = useState([]);
  const [houses, setHouses] = useState([]);
  const [tankInfo, setTankInfo] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState("all"); // all | confirmed | pending
  const [filtroCasa, setFiltroCasa] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [form, setForm] = useState({
    house: "",
    amount: 0,
    prepaidBotellones: 0,
    extraFillAmount: 0,
    description: "",
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  // --- CONSTANTES ---
  const pricePerFill = tankInfo?.pricePerFill || 0;
  const pricePerBotellon = tankInfo?.product?.price || 0;

  const normalize = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  const updateMonto = (botellones, extraFill) =>
    normalize(botellones * pricePerBotellon + (extraFill || 0));

  // --- EFFECTS ---
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user]);

  useEffect(() => {
    const fetchAll = async () => {
      const [pRes, hRes] = await Promise.all([
        axios.get("http://localhost:4000/api/payments"),
        axios.get("http://localhost:4000/api/houses"),
      ]);
      setPayments(pRes.data);
      setHouses(hRes.data);
    };

    const loadTank = async () => {
      const res = await axios.get(
        "http://localhost:4000/api/inventory/tanks/summary"
      );
      setTankInfo(res.data?.[0] || null);
    };

    fetchAll();
    loadTank();
  }, []);

  useEffect(() => {
    // Actualiza el monto cuando cambian los precios
    setForm((f) => ({
      ...f,
      amount: updateMonto(f.prepaidBotellones, f.extraFillAmount),
    }));
  }, [pricePerFill, pricePerBotellon]);

  const pagosFiltrados = payments.filter((p) => {
    // Estado
    if (filtroEstado === "confirmed" && !p.confirmed) return false;
    if (filtroEstado === "pending" && p.confirmed) return false;

    // Casa
    if (filtroCasa && p.house?._id !== filtroCasa) return false;

    // Fecha desde
    if (filtroDesde) {
      const fechaPago = new Date(p.date);
      const desde = new Date(filtroDesde);
      if (fechaPago < desde) return false;
    }

    // Fecha hasta
    if (filtroHasta) {
      const fechaPago = new Date(p.date);
      const hasta = new Date(filtroHasta);
      hasta.setHours(23, 59, 59, 999);
      if (fechaPago > hasta) return false;
    }

    return true;
  });

  // --- FUNCIONES DE SUBMIT / CONFIRMACIÓN ---
  const submit = async () => {
    if (!form.house || !form.amount)
      return Swal.fire("Faltan datos", "Selecciona casa y cantidad", "warning");
    try {
      await axios.post("http://localhost:4000/api/payments", form);
      setForm({
        house: "",
        amount: 0,
        prepaidBotellones: 0,
        extraFillAmount: 0,
        description: "",
      });
      const [pRes, hRes] = await Promise.all([
        axios.get("http://localhost:4000/api/payments"),
        axios.get("http://localhost:4000/api/houses"),
      ]);
      setPayments(pRes.data);
      setHouses(hRes.data);
      Swal.fire("Registrado", "Pago registrado correctamente", "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
    }
  };

  const toggleConfirm = async (id, current) => {
    const result = await Swal.fire({
      title: current ? "Anular pago?" : "Restablecer pago?",
      showCancelButton: true,
      icon: "question",
    });
    if (!result.isConfirmed) return;
    try {
      await axios.put(`http://localhost:4000/api/payments/${id}/confirm`);
      const res = await axios.get("http://localhost:4000/api/payments");
      setPayments(res.data);
      Swal.fire("OK", "Estado actualizado", "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || err.message, "error");
    }
  };

  const addBotellon = () => {
    setForm((f) => {
      const nuevosBotellones = f.prepaidBotellones + 1;
      const monto = normalize(
        nuevosBotellones * (pricePerBotellon || 0) + (f.extraFillAmount || 0)
      );
      return { ...f, prepaidBotellones: nuevosBotellones, amount: monto };
    });
  };

  const removeBotellon = () => {
    setForm((f) => {
      const nuevosBotellones = Math.max(0, f.prepaidBotellones - 1);
      const monto = normalize(
        nuevosBotellones * (pricePerBotellon || 0) + (f.extraFillAmount || 0)
      );
      return { ...f, prepaidBotellones: nuevosBotellones, amount: monto };
    });
  };

  const usarLlenado = () => {
    setForm((f) => {
      const nuevoExtraFill = (f.extraFillAmount || 0) + (pricePerFill || 0);
      const monto = normalize(
        f.prepaidBotellones * (pricePerBotellon || 0) + nuevoExtraFill
      );
      return { ...f, extraFillAmount: nuevoExtraFill, amount: monto };
    });
  };

  // Permitir editar monto manualmente y recalcular botellones
  const handleAmountChange = (e) => {
    let newAmount = Number(e.target.value);
    if (newAmount < 0) newAmount = 0;
    const botellones = Math.floor(
      (newAmount - (form.extraFillAmount || 0)) / pricePerBotellon
    );
    setForm({ ...form, amount: newAmount, prepaidBotellones: botellones });
  };

  return (
    <div className="container mt-3">
      <h4 className="mb-3">Registro de Pagos</h4>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          {/* FILA 1 */}
          <div className="row mb-4 gx-3 gy-3 align-items-end">
            <div className="col-md-6 d-flex flex-column">
              <label className="form-label fw-semibold text-secondary">
                Casa
              </label>
              <select
                className="form-select form-select-sm"
                value={form.house}
                onChange={(e) => setForm({ ...form, house: e.target.value })}
              >
                <option value="">Selecciona casa</option>
                {houses.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6 d-flex flex-column">
              <label className="form-label fw-semibold text-secondary">
                Descripción
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* FILA 2 */}
          <div className="row gx-3 gy-3 align-items-center">
            {/* BOTELLONES */}
            <div className="col-md-4 d-flex flex-column">
              <label className="form-label fw-semibold text-secondary">
                Botellones adelantados
              </label>
              <div className="d-flex align-items-center gap-1">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={removeBotellon}
                >
                  −
                </button>
                <input
                  className="form-control form-control-sm text-center"
                  value={form.prepaidBotellones}
                  readOnly
                  style={{ width: "60px" }}
                />
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={addBotellon}
                >
                  +
                </button>
                <small className="text-muted ms-2">
                  ${pricePerBotellon} c/u
                </small>
              </div>
            </div>

            {/* MONTO */}
            <div className="col-md-4 d-flex flex-column">
              <label className="form-label fw-semibold text-secondary">
                Monto ($)
              </label>
              <div className="gap-2">
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={form.amount}
                  onChange={handleAmountChange}
                />
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={usarLlenado}
                >
                  Usar llenado (${pricePerFill})
                </button>
              </div>
            </div>

            {/* BOTÓN DE ACCIÓN */}
            <div className="col-md-4 d-flex justify-content-end">
              <button
                className="btn btn-primary btn-sm px-4 py-2"
                onClick={submit}
              >
                Registrar pago
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORIAL */}
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">Historial de pagos</h6>
          </div>
          <div className="row g-2 mb-3">
            {/* Estado */}
            <div className="col-md-3">
              <label className="form-label small text-muted">Estado</label>
              <select
                className="form-select form-select-sm"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="confirmed">Confirmados</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>

            {/* Casa */}
            <div className="col-md-3">
              <label className="form-label small text-muted">Casa</label>
              <select
                className="form-select form-select-sm"
                value={filtroCasa}
                onChange={(e) => setFiltroCasa(e.target.value)}
              >
                <option value="">Todas</option>
                {houses.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Desde */}
            <div className="col-md-3">
              <label className="form-label small text-muted">Desde</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
              />
            </div>

            {/* Hasta */}
            <div className="col-md-3">
              <label className="form-label small text-muted">Hasta</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Casa</th>
                  <th className="text-end">Monto</th>
                  <th className="text-center">Adelantados</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagosFiltrados.map((p) => (
                  <tr key={p._id}>
                    <td>{new Date(p.date).toLocaleString()}</td>
                    <td>{p.house?.code}</td>
                    <td className="text-end">${Number(p.amount).toFixed(2)}</td>
                    <td className="text-center">{p.prepaidBotellones}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.confirmed ? "bg-success" : "bg-warning"
                        }`}
                      >
                        {p.confirmed ? "Confirmado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => toggleConfirm(p._id, p.confirmed)}
                      >
                        {p.confirmed ? "Anular" : "Restablecer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
