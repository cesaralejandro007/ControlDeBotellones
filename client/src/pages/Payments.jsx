import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import Select from "react-select";
import bancosVzla from "../utils/banksVzla";
import { createRoot } from "react-dom/client";

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
    reference: "",
    bank: "",
    identification: "",
    phone: "",
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
    // 1. Casa
    if (!form.house) {
      return Swal.fire({
        title: "Campo requerido",
        text: "Debes seleccionar una casa",
        icon: "warning",
        confirmButtonColor: "#3085d6",
      });
    }

    // 2. Referencia
    if (!form.reference) {
      return Swal.fire({
        title: "Campo requerido",
        text: "Debes ingresar la referencia",
        icon: "warning",
        confirmButtonColor: "#3085d6",
      });
    }

    // 3. Banco
    if (!form.bank) {
      return Swal.fire({
        title: "Campo requerido",
        text: "Debes seleccionar un banco",
        icon: "warning",
        confirmButtonColor: "#3085d6",
      });
    }

    // 4. Cédula
    if (!form.identification) {
      return Swal.fire({
        title: "Campo requerido",
        text: "Debes ingresar la cédula",
        icon: "warning",
        confirmButtonColor: "#3085d6",
      });
    }

    // 5. Teléfono
    if (!form.phone) {
      return Swal.fire({
        title: "Campo requerido",
        text: "Debes ingresar el teléfono",
        icon: "warning",
        confirmButtonColor: "#3085d6",
      });
    }

    // 6. Monto
    if (!form.amount || form.amount <= 0) {
      return Swal.fire({
        title: "Monto inválido",
        text: "El monto debe ser mayor a cero",
        icon: "warning",
        confirmButtonColor: "#3085d6",
      });
    }

    try {
      await axios.post("http://localhost:4000/api/payments", form);
      setForm({
        house: "",
        amount: 0,
        prepaidBotellones: 0,
        extraFillAmount: 0,
        description: "",
        reference: "",
        bank: "",
        identification: "",
        phone: "",
      });
      const [pRes, hRes] = await Promise.all([
        axios.get("http://localhost:4000/api/payments"),
        axios.get("http://localhost:4000/api/houses"),
      ]);
      setPayments(pRes.data);
      setHouses(hRes.data);
      Swal.fire({
        title: "Pago registrado",
        text: "El pago ha sido registrado correctamente.",
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

  const toggleConfirm = async (id, current) => {
    if (current) {
      return Swal.fire({
        title: "Este pago ya está confirmado",
        text: "",
        icon: "info",
        confirmButtonColor: "#3085d6",
      });
    }

    let selectedBank = "";
    let root;

    const { value: formValues } = await Swal.fire({
      title: "Datos del pago",
      html: `
    <input id="ref" class="swal2-input" placeholder="Referencia">

    <div
      id="bank-select"
      class="swal2-input"
      style="padding:0; width:70%; margin:4px auto 8px auto;"
    ></div>

    <input id="identification" class="swal2-input" placeholder="Cédula / ID">
    <input id="phone" class="swal2-input" placeholder="Teléfono afiliado">
  `,
      focusConfirm: false,
      confirmButtonColor: "#3085d6",

      didOpen: () => {
        const container = document.getElementById("bank-select");
        root = createRoot(container);

        root.render(
          <Select
            options={bancosVzla}
            placeholder="Selecciona banco"
            isSearchable
            isClearable
            styles={{
              control: (base) => ({
                ...base,
                border: "1px solid #d9d9d9",
                boxShadow: "none",
                minHeight: "50px",
                height: "50px",
                borderRadius: "4px",
              }),
              valueContainer: (base) => ({
                ...base,
                justifyContent: "center",
                padding: "0 12px",
              }),
              placeholder: (base) => ({
                ...base,
                textAlign: "center",
                width: "100%",
                color: "#aaa",
              }),
              singleValue: (base) => ({
                ...base,
                textAlign: "center",
                width: "100%",
              }),
              indicatorsContainer: (base) => ({
                ...base,
                height: "50px",
              }),
              indicatorSeparator: () => ({
                display: "none",
              }),
              menu: (base) => ({
                ...base,
                zIndex: 9999,
              }),
            }}
            onChange={(selected) => {
              selectedBank = selected ? selected.label : "";
            }}
          />
        );
      },

      willClose: () => {
        if (root) root.unmount();
      },

      preConfirm: () => {
        const reference = document.getElementById("ref").value;
        const identification = document.getElementById("identification").value;
        const phone = document.getElementById("phone").value;

        if (!reference || !selectedBank || !identification || !phone) {
          Swal.showValidationMessage("Todos los campos son obligatorios");
          return false; // ⛔ evita cierre
        }

        return {
          reference,
          bank: selectedBank,
          identification,
          phone,
        };
      },
    });

    if (!formValues) return;

    try {
      await axios.put(
        `http://localhost:4000/api/payments/${id}/confirm`,
        formValues
      );

      const res = await axios.get("http://localhost:4000/api/payments");
      setPayments(res.data);

      Swal.fire({
        title: "Pago confirmado",
        text: "El pago ha sido confirmado correctamente.",
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
              <Select
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: "31px",
                    height: "31px",
                    fontSize: "0.875rem",
                  }),
                  valueContainer: (base) => ({
                    ...base,
                    padding: "0 8px",
                  }),
                  indicatorsContainer: (base) => ({
                    ...base,
                    height: "31px",
                  }),
                }}
                options={houses.map((h) => ({ value: h._id, label: h.code }))} // adaptamos el formato
                placeholder="Selecciona casa"
                isClearable
                isSearchable
                value={
                  houses
                    .map((h) => ({ value: h._id, label: h.code }))
                    .find((h) => h.value === form.house) || null
                }
                onChange={(selected) =>
                  setForm({
                    ...form,
                    house: selected ? selected.value : "",
                  })
                }
              />
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
            {/* FILA DATOS BANCARIOS */}
            <div className="row gx-3 gy-3 mt-3">
              <div className="col-md-3">
                <label className="form-label fw-semibold text-secondary">
                  Referencia
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.reference}
                  onChange={(e) =>
                    setForm({ ...form, reference: e.target.value })
                  }
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold text-secondary">
                  Banco
                </label>

                <Select
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "31px",
                      height: "31px",
                      fontSize: "0.875rem",
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      padding: "0 8px",
                    }),
                    indicatorsContainer: (base) => ({
                      ...base,
                      height: "31px",
                    }),
                  }}
                  options={bancosVzla}
                  placeholder="Selecciona banco"
                  isClearable
                  isSearchable
                  value={bancosVzla.find((b) => b.label === form.bank) || null}
                  onChange={(selected) =>
                    setForm({
                      ...form,
                      bank: selected ? selected.label : "",
                    })
                  }
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold text-secondary">
                  Cédula
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.identification}
                  onChange={(e) =>
                    setForm({ ...form, identification: e.target.value })
                  }
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold text-secondary">
                  Teléfono
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
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
