import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import Select from "react-select";
import bancosVzla from "../utils/banksVzla";
import { createRoot } from "react-dom/client";
import { FaInfoCircle } from "react-icons/fa";

export default function HouseDetail() {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [deliveryCount, setDeliveryCount] = useState(1);
  const [botellonStock, setBotellonStock] = useState(null);
  const [usePrepaid, setUsePrepaid] = useState(false);
  const [debtInfo, setDebtInfo] = useState(null);
  const [tankInfo, setTankInfo] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  const [searchPayment, setSearchPayment] = useState("");
  const [searchDelivery, setSearchDelivery] = useState("");

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetch = async () => {
    const res = await axios.get(
      `http://localhost:4000/api/houses/${id}/detail`
    );
    setDetail(res.data);
    // obtener stock de botellones (informativo; no bloquea entregas a casas) y precio de llenado
    try {
      const inv = await axios.get("http://localhost:4000/api/inventory");
      const bot = inv.data.find((i) => i.type === "botellon");
      setBotellonStock(bot ? bot.quantity : null);
      // get tank summary to read pricePerFill
      try {
        const active = await axios.get("http://localhost:4000/api/inventory/tanks/active");
        setTankInfo(active.data || null);
      } catch (e) {
        setTankInfo(null);
      }
    } catch (e) {
      setBotellonStock(null);
      setTankInfo(null);
    }
    // obtener deuda (monetaria)
    try {
      const d = await axios.get(`http://localhost:4000/api/houses/${id}/debt`);
      setDebtInfo(d.data);
    } catch (e) {
      setDebtInfo(null);
    }
  };

  useEffect(() => {
    if (!user) navigate("/login");
    else fetch();
  }, [id, user]);

const refreshActiveTank = async () => {
  try {
    const res = await axios.get(
      "http://localhost:4000/api/inventory/tanks/active"
    );
    setTankInfo(res.data || null);
    return res.data;
  } catch (e) {
    setTankInfo(null);
    return null;
  }
};

const addDelivery = async (usedPrepaid = false) => {
  try {
    const count = parseInt(deliveryCount) || 1;

    // 1️⃣ Obtener tanque activo actualizado
    let tank = await refreshActiveTank();


    // 2️⃣ Si no hay tanque activo
    if (!tank || !tank.id) {
      return Swal.fire({
        icon: "warning",
        title: "No hay tanque activo",
        text: "Debes registrar o activar un tanque antes de continuar",
      });
    }

    // 3️⃣ Calcular litros necesarios
    const litersNeeded = count * (tank.litersPerBottle || 20);

    // 4️⃣ Validar stock del tanque
    if (tank.quantity < litersNeeded) {
      return handleEmptyTank(tank, litersNeeded);
    }

    // 5️⃣ Registrar llenado normalmente
    await axios.post(
      `http://localhost:4000/api/inventory/tanks/${tank.id}/fill`,
      {
        house: id,
        count,
        usedPrepaid,
        pricePerFill: tank.pricePerFill,
      }
    );

    let texto =
      count === 1
        ? `Se entregó ${count} botellón`
        : `Se entregaron ${count} botellones`;

    await Promise.all([
      fetch(),            // casa, pagos, entregas
      refreshActiveTank() // tanque en tiempo real
    ]);

    Swal.fire({
      title: "Entrega registrada",
      text: texto,
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


  function updateTotal() {
    const total = Array.from(
      document.querySelectorAll("[data-checkbox-pay]:checked")
    ).reduce((sum, cb) => sum + parseFloat(cb.dataset.amount || 0), 0);

    document.getElementById("total_pay").innerText = total.toFixed(2);
  }

  const payDebt = async () => {
    // If there are no pending payments, open the quick pay dialog
    const pending = debtInfo?.pendingPayments || [];
    if (!pending.length) {
      const { value: formValues } = await Swal.fire({
        title: "Pagar deuda",
        html:
          '<input id="swal-amount" class="swal2-input" placeholder="Monto" type="number">' +
          '<input id="swal-prepaid" class="swal2-input" placeholder="Anticipo (botellones)" type="number">',
        focusConfirm: false,
        preConfirm: () => {
          const amount = parseFloat(
            document.getElementById("swal-amount").value || 0
          );
          const prepaid = parseInt(
            document.getElementById("swal-prepaid").value || 0
          );
          return { amount, prepaid };
        },
      });
      if (!formValues) return;
      try {
        const idempotencyKey =
          window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : Math.random().toString(36).slice(2);
        const res = await axios.post(
          `http://localhost:4000/api/houses/${id}/pay`,
          {
            amount: formValues.amount,
            prepaidBotellones: formValues.prepaid,
            idempotencyKey,
          }
        );
        Swal.fire({
          title: "Pago registrado",
          text: `Pago de $${formValues.amount.toFixed(
            2
          )} registrado correctamente.`,
          icon: "success",
          confirmButtonColor: "#3085d6",
        });
        await fetch();
      } catch (err) {
        Swal.fire({
          title: "Error",
          text: err.response?.data?.error || err.message,
          icon: "error",
          confirmButtonColor: "#3085d6",
        });
      }
      return;
    }

    // build HTML table of pending payments with checkboxes (selected by default) + select-all
    const rows = pending
      .map(
        (p) => `
      <tr>
        <td class="text-center"><input class="form-check-input" data-checkbox-pay id="pay_${
          p._id
        }" data-amount="${p.amount}" type="checkbox" checked></td>
        <td>${new Date(p.date).toLocaleString()}</td>
        <td>$${p.amount}</td>
        <td>${p.description || "Deuda"}</td>
      </tr>
    `
      )
      .join("");
    const tableHtml = `
    <div style="text-align:left">
      <table class="table table-sm table-striped">
        <thead>
          <tr>
            <th style="width: 40px">
              <input 
                id="select_all_pay" 
                class="form-check-input" 
                type="checkbox" 
                checked
              >
            </th>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Descripción</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="fw-bold">
        Total: $<span id="total_pay">0</span>
      </div>
    </div>`;

    const { value: selected } = await Swal.fire({
      title: "Seleccionar deudas a pagar",
      html: tableHtml,
      focusConfirm: false,
      showLoaderOnConfirm: true,
      allowOutsideClick: false,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",

      didOpen: () => {
        // Checkboxes individuales
        document
          .querySelectorAll("[data-checkbox-pay]")
          .forEach((cb) => cb.addEventListener("change", updateTotal));

        // Select all
        const selectAll = document.getElementById("select_all_pay");
        selectAll.addEventListener("change", function () {
          document
            .querySelectorAll("[data-checkbox-pay]")
            .forEach((cb) => (cb.checked = this.checked));
          updateTotal();
        });

        // Total inicial
        updateTotal();
      },

      preConfirm: () => {
        const selectedIds = pending
          .map((p) => ({
            id: p._id,
            amount: parseFloat(
              document.getElementById("pay_" + p._id).dataset.amount
            ),
          }))
          .filter((x) => document.getElementById("pay_" + x.id).checked);

        if (!selectedIds.length) {
          Swal.showValidationMessage("Selecciona al menos una deuda a pagar");
          return false;
        }

        const total = selectedIds.reduce((s, x) => s + (x.amount || 0), 0);

        return { selectedIds, total };
      },
    });

    if (!selected) return;

    let selectedBank = "";

    const { value: paymentData } = await Swal.fire({
      title: "Datos del pago",
      html: `
    <input id="ref" class="swal2-input" placeholder="Referencia">

    <div
      id="bank-select"
      class="swal2-input"
      style="padding:0; width:70%; margin:4px auto 8px auto;"
    ></div>

    <input id="id" class="swal2-input" placeholder="Cédula / ID">
    <input id="phone" class="swal2-input" placeholder="Teléfono afiliado">
  `,
      focusConfirm: false,
      confirmButtonColor: "#3085d6",
      didOpen: () => {
        const container = document.getElementById("bank-select");
        const root = createRoot(container);

        root.render(
          <Select
            options={bancosVzla}
            placeholder="Selecciona banco"
            isSearchable
            isClearable
            onChange={(selected) => {
              selectedBank = selected ? selected.label : "";
            }}
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
          />
        );
      },

      preConfirm: () => {
        const reference = document.getElementById("ref").value;
        const identification = document.getElementById("id").value;
        const phone = document.getElementById("phone").value;

        if (!reference || !selectedBank || !identification || !phone) {
          Swal.showValidationMessage("Todos los campos son obligatorios");
          return;
        }

        return {
          reference,
          bank: selectedBank,
          identification,
          phone,
        };
      },
    });

    if (!paymentData) return;
    if (isApplying) return;

    setIsApplying(true);

    try {
      // create a confirmed payment for the total and atomically apply to targets via house pay
      const idempotencyKey =
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const res = await axios.post(
        `http://localhost:4000/api/houses/${id}/pay`,
        {
          amount: selected.total,
          description: "Pago por liquidación de deudas",
          prepaidBotellones: 0,
          targets: selected.selectedIds,
          reference: paymentData.reference,
          bank: paymentData.bank,
          identification: paymentData.identification,
          phone: paymentData.phone,
          idempotencyKey,
        }
      );
      const paymentCreated = res.data.payment;
      Swal.fire({
        title: "Pago registrado",
        text: `Pago de $${selected.total.toFixed(2)} registrado correctamente.`,
        icon: "success",
        confirmButtonColor: "#3085d6",
      });
      await fetch();
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err.response?.data?.error || err.message,
        icon: "error",
        confirmButtonColor: "#3085d6",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const confirmPayment = async (paymentId) => {
    let selectedBank = "";

    const { value: paymentData } = await Swal.fire({
      title: "Confirmar pago",
      html: `
      <input id="ref" class="swal2-input" placeholder="Referencia">
      <div
        id="bank-select"
        class="swal2-input"
        style="
          padding:0;
          width:70%;
          margin-top:4px;
          margin-bottom:8px;
          margin-left:auto;
          margin-right:auto;
        "
      ></div>
      <input id="id" class="swal2-input" placeholder="Cédula / ID">
      <input id="phone" class="swal2-input" placeholder="Teléfono afiliado">
    `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      confirmButtonColor: "#3085d6",

      didOpen: () => {
        const container = document.getElementById("bank-select");
        const root = createRoot(container);

        root.render(
          <Select
            options={bancosVzla}
            placeholder="Selecciona banco"
            isSearchable
            isClearable
            onChange={(selected) => {
              selectedBank = selected ? selected.label : "";
            }}
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
                justifyContent: "center", // 👈 centra horizontal
                padding: "0 12px",
              }),

              placeholder: (base) => ({
                ...base,
                textAlign: "center", // 👈 centra texto
                width: "100%",
                color: "#aaa",
              }),

              singleValue: (base) => ({
                ...base,
                textAlign: "center", // 👈 centra banco seleccionado
                width: "100%",
              }),

              indicatorsContainer: (base) => ({
                ...base,
                height: "50px",
              }),

              indicatorSeparator: () => ({
                display: "none",
              }),
            }}
          />
        );
      },

      preConfirm: () => {
        const reference = document.getElementById("ref").value;
        const identification = document.getElementById("id").value;
        const phone = document.getElementById("phone").value;

        if (!reference || !selectedBank || !identification || !phone) {
          Swal.showValidationMessage("Todos los campos son obligatorios");
          return;
        }

        return {
          reference,
          bank: selectedBank,
          identification,
          phone,
        };
      },
    });

    if (!paymentData) return;

    try {
      await axios.put(
        `http://localhost:4000/api/payments/${paymentId}/confirm`,
        paymentData
      );

      Swal.fire({
        title: "Pago confirmado",
        text: "El pago ha sido confirmado correctamente.",
        icon: "success",
        confirmButtonColor: "#3085d6",
      });
      await fetch();
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err.response?.data?.error || err.message,
        icon: "error",
        confirmButtonColor: "#3085d6",
      });
    }
  };

  const showPaymentDetails = (payment) => {
    Swal.fire({
      title: "Detalles del pago",
      html: `
        <div style="text-align:left">
          <p><strong>Fecha:</strong> ${new Date(
            payment.date
          ).toLocaleString()}</p>
          <p><strong>Monto:</strong> $${Number(payment.amount).toFixed(2)}</p>
          <hr/>
          <p><strong>Referencia:</strong> ${payment.reference || "—"}</p>
          <p><strong>Banco:</strong> ${payment.bank || "—"}</p>
          <p><strong>Cédula:</strong> ${payment.identification || "—"}</p>
          <p><strong>Teléfono:</strong> ${payment.phone || "—"}</p>
          <hr/>
          <p><strong>Descripción:</strong> ${payment.description || "—"}</p>
        </div>
      `,
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#3085d6",
    });
  };

  const handleEmptyTank = async (tank, litersNeeded) => {
  // Traer todos los productos
  const res = await axios.get("http://localhost:4000/api/inventory");

  // Buscar otros tanques con stock suficiente
  const availableTanks = res.data.filter(
    (i) =>
      i.type === "tanque" &&
      !i.isActive &&
      i.quantity >= litersNeeded
  );

  // 🔁 Si hay otro tanque disponible
  if (availableTanks.length > 0) {
    const { value: selectedTank } = await Swal.fire({
      title: "Tanque sin stock",
      text: "Selecciona otro tanque disponible",
      input: "select",
      inputOptions: availableTanks.reduce((acc, t) => {
        acc[t._id] = `${t.name} (${t.quantity} L)`;
        return acc;
      }, {}),
      showCancelButton: true,
    });

    if (selectedTank) {
await axios.put(
  `http://localhost:4000/api/inventory/tanks/activate/${selectedTank}`
);

// 🔄 refrescar tanque activo inmediatamente
await refreshActiveTank();

Swal.fire(
  "Tanque activado",
  "Tanque cambiado correctamente",
  "success"
);

    }
  } else {
    // ❌ No hay tanques disponibles
    await Swal.fire({
      icon: "warning",
      title: "Tanque agotado",
      html: `
        <p>No hay tanques con suficiente stock.</p>
        <ul style="text-align:left">
          <li>Recarga el tanque actual</li>
          <li>O registra un nuevo tanque en Inventario</li>
        </ul>
      `,
    });
  }
};


  if (!detail)
    return <div className="text-center py-5">Cargando detalle...</div>;

  const { house, payments, deliveries, balance } = detail;

  const filteredPayments = payments
    .filter((p) => Math.round(Number(p.amount || 0) * 100) > 0)
    .filter((p) => {
      if (!searchPayment) return true;

      const text = searchPayment.toLowerCase();

      const date = new Date(p.date).toLocaleString().toLowerCase();
      const reference = (p.reference || "").toLowerCase();
      const amount = Number(p.amount).toFixed(2);
      const description = (p.description || "").toLowerCase();
      const status = p.confirmed || p.settled ? "confirmado" : "pendiente";

      return (
        date.includes(text) ||
        reference.includes(text) ||
        amount.includes(text) ||
        description.includes(text) ||
        status.includes(text)
      );
    });

  const filteredDeliveries = deliveries.filter((d) => {
    if (!searchDelivery) return true;

    const text = searchDelivery.toLowerCase();

    const date = new Date(d.date).toLocaleString().toLowerCase();
    const count = String(d.count);
    const used = d.usedPrepaid ? "si" : "no";
    const notes = (d.notes || "").toLowerCase();

    return (
      date.includes(text) ||
      count.includes(text) ||
      used.includes(text) ||
      notes.includes(text)
    );
  });

  return (
    <div
      className="gap-4 mx-5"
      style={{ minHeight: "90vh", backgroundColor: "#f8f9fa" }}
    >
      <div className="row g-3">
        {/* ----- LADO IZQUIERDO ----- */}
        <div className="col-md-4">
          {/* Datos generales */}
          <div className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h4 className="card-title text-primary">{house.code}</h4>
              <h5 className="card-subtitle mb-2 text-muted">
                {house.ownerName}
              </h5>
              <p className="mb-1">
                <strong>Teléfono:</strong> {house.phone || "—"}
              </p>
              <p className="mb-1">
                <strong>Email:</strong> {house.email || "—"}
              </p>
              <p className="mb-1">
                <strong>Dirección:</strong> {house.address || "—"}
              </p>
              {house.notes && (
                <p className="mt-2">
                  <strong>Notas:</strong> {house.notes}
                </p>
              )}
            </div>
          </div>

          {/* Balance de anticipos */}
          <div className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h6 className="text-secondary">Balance de anticipos</h6>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div>
                    Prepaid: <strong>{balance.prepaid}</strong>
                  </div>
                  <div>
                    Usados: <strong>{balance.used}</strong>
                  </div>
                </div>
                <div>
                  <div
                    className={`badge ${
                      balance.balance >= 0 ? "bg-primary" : "bg-danger"
                    }`}
                  >
                    Saldo: {balance.balance}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deuda estimada */}
          <div className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h6 className="text-secondary">Deuda estimada</h6>
              <p className="mb-1">
                Total entregado: {debtInfo?.totalDelivered ?? 0} botellones
              </p>
              <p className="mb-1">
                Pagos realizados: $
                {Number(debtInfo?.paymentsTotal || 0).toFixed(2)}
              </p>
              <div className="d-flex justify-content-between align-items-center mt-2">
                <div>
                  Deuda pendiente:{" "}
                  <strong>
                    ${Number(debtInfo?.pendingAmount || 0).toFixed(2)}
                  </strong>
                </div>
                <button
                  className="btn btn-sm btn-primary shadow-sm"
                  onClick={payDebt}
                  disabled={
                    !debtInfo ||
                    Math.round(Number(debtInfo.pendingAmount || 0) * 100) <=
                      0 ||
                    isApplying
                  }
                >
                  {isApplying ? "Procesando..." : "Pagar deuda"}
                </button>
              </div>
            </div>
          </div>

          {/* Botellones en tanque */}
          <div className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h6 className="text-secondary">Botellones en tanque</h6>
              {tankInfo ? (
                <>
                  <p className="mb-1">
                    Litros actuales: <strong>{tankInfo.quantity}</strong> /{" "}
                    {tankInfo.capacity || "—"} L
                  </p>
                  <p className="mb-1">
                    Botellones aproximados:{" "}
                    <strong>{Math.floor((tankInfo.quantity || 0) / 20)}</strong>
                  </p>
                  <p className="mb-1">
                    Precio llenado:{" "}
                    <strong>${tankInfo.pricePerFill ?? 0}</strong>
                  </p>
                  <div
                    className="progress"
                    style={{ height: "14px", borderRadius: "6px" }}
                  >
                    {(() => {
                      const pct = tankInfo.capacity
                        ? Math.min(
                            100,
                            Math.round(
                              (tankInfo.quantity / tankInfo.capacity) * 100
                            )
                          )
                        : 0;
                      const cls =
                        pct >= 70
                          ? "bg-success"
                          : pct >= 30
                          ? "bg-warning"
                          : "bg-danger";
                      return (
                        <div
                          className={`progress-bar ${cls}`}
                          role="progressbar"
                          style={{ width: pct + "%" }}
                          aria-valuenow={pct}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        >
                          {pct}%
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <p className="mb-0 text-muted">Tanque no registrado</p>
              )}
            </div>
          </div>

          {/* Stock botellones */}
          <div className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h6 className="text-secondary">Stock botellones</h6>
              <p className="mb-0">
                {botellonStock === null ? "No registrado" : botellonStock}
              </p>
            </div>
          </div>
        </div>

        {/* ----- LADO DERECHO ----- */}
        <div className="col-md-8">
          {/* Registrar entrega */}
          <div className="card mb-3 shadow-sm border-0">
            <div className="card-body">
              <h5 className="card-title">Registrar entrega</h5>
              <div className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label">Cantidad</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    value={deliveryCount}
                    onChange={(e) => setDeliveryCount(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Usar anticipo</label>
                  <select
                    className="form-select"
                    value={usePrepaid ? "si" : "no"}
                    onChange={(e) => setUsePrepaid(e.target.value === "si")}
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                <div className="col-md-4 d-flex">
                  <button
                    className="btn btn-primary me-2 shadow-sm"
                    onClick={() => addDelivery(usePrepaid)}
                    disabled={
                      usePrepaid &&
                      (balance?.balance || 0) < (parseInt(deliveryCount) || 0)
                    }
                  >
                    Registrar entrega
                  </button>
                </div>
              </div>
              {tankInfo && (
                <small className="text-muted mt-2 d-block">
                  Litros requeridos:{" "}
                  <strong>
                    {(deliveryCount || 0) * (tankInfo.litersPerBottle || 20)}
                  </strong>{" "}
                  L • Estimado a cobrar:{" "}
                  <strong>
                    $
                    {(
                      (deliveryCount || 0) * (tankInfo.pricePerFill || 0)
                    ).toFixed(2)}
                  </strong>
                </small>
              )}
              {usePrepaid &&
                (balance?.balance || 0) < (parseInt(deliveryCount) || 0) && (
                  <div className="text-danger mt-1">
                    Saldo de anticipos insuficiente
                  </div>
                )}
            </div>
          </div>

          {/* Pagos con scroll */}
          <div className="card mb-3 shadow-sm border-0">
            <div className="card-body">
              <h5>Pagos</h5>
              <div
                className="table-responsive"
                style={{ maxHeight: "250px", overflowY: "auto" }}
              >
                <div className="mb-2">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Buscar por fecha, referencia, monto, descripción o estado..."
                    value={searchPayment}
                    onChange={(e) => setSearchPayment(e.target.value)}
                  />
                </div>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light text-center">
                    <tr>
                      <th>Fecha</th>
                      <th>Referencia</th>
                      <th className="text-end">Monto</th>
                      <th>Adelantos</th>
                      <th className="text-start">Descripción</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayments.map((p) => {
                      const isConfirmed = p.confirmed || p.settled;

                      return (
                        <tr key={p._id}>
                          {/* Fecha */}
                          <td className="text-nowrap">
                            {new Date(p.date).toLocaleDateString()}
                            <br />
                            <small className="text-muted">
                              {new Date(p.date).toLocaleTimeString()}
                            </small>
                          </td>
                          <td
                            className="text-start"
                            style={{ maxWidth: "220px" }}
                          >
                            <span
                              className="text-truncate d-inline-block"
                              style={{ maxWidth: "100%" }}
                              title={p.reference || ""}
                            >
                              {p.reference || "—"}
                            </span>
                          </td>
                          {/* Monto */}
                          <td className="text-end fw-semibold">
                            ${Number(p.amount).toFixed(2)}
                          </td>

                          {/* Adelantos */}
                          <td className="text-center">
                            {p.prepaidBotellones > 0 ? (
                              <span className="badge bg-info text-dark">
                                {p.prepaidBotellones}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Descripción */}
                          <td
                            className="text-start"
                            style={{ maxWidth: "220px" }}
                          >
                            <span
                              className="text-truncate d-inline-block"
                              style={{ maxWidth: "100%" }}
                              title={p.description || ""}
                            >
                              {p.description || "—"}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="text-center">
                            {isConfirmed ? (
                              <span className="badge bg-success">
                                ✔ Confirmado
                              </span>
                            ) : (
                              <span className="badge bg-warning text-dark">
                                ⏳ Pendiente
                              </span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="text-center">
                            <div className="d-flex justify-content-center gap-1">
                              <button
                                className="btn btn-sm btn-outline-info me-1"
                                title="Ver detalles"
                                onClick={() => showPaymentDetails(p)}
                              >
                                <FaInfoCircle />
                              </button>


                              {!isConfirmed && user?.role === "admin" && (
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  title="Confirmar pago"
                                  onClick={() => confirmPayment(p._id)}
                                >
                                  ✔
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Entregas con scroll */}
          <div className="card mb-3 shadow-sm border-0">
            <div className="card-body">
              <h5>Entregas</h5>
              <div
                className="table-responsive"
                style={{ maxHeight: "250px", overflowY: "auto" }}
              >
                <div className="mb-2">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Buscar por fecha, cantidad, anticipo o notas..."
                    value={searchDelivery}
                    onChange={(e) => setSearchDelivery(e.target.value)}
                  />
                </div>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Cantidad</th>
                      <th>Usó anticipo</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeliveries.map((d) => (
                      <tr key={d._id}>
                        <td>{new Date(d.date).toLocaleString()}</td>
                        <td>{d.count}</td>
                        <td>
                          {d.usedPrepaid ? (
                            <span className="badge bg-info text-dark">Sí</span>
                          ) : (
                            "No"
                          )}
                        </td>
                        <td>{d.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
