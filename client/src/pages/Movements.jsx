import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    product: "",
    type: "in",
    quantity: 0,
    notes: "",
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetch = async () => {
    const [mRes, pRes] = await Promise.all([
      axios.get("http://localhost:4000/api/inventory/movements"),
      axios.get("http://localhost:4000/api/inventory"),
    ]);
    setMovements(mRes.data);
    setProducts(pRes.data);
    setSelectedProduct(null);
  };

  useEffect(() => {
    if (!user) navigate("/login");
    else fetch();
  }, [user]);

  const submit = async () => {
    try {
      // If selected product is a tank (litro), quantity is in liters
      await axios.post("http://localhost:4000/api/inventory/movements", form);
      setForm({ product: "", type: "in", quantity: 0, notes: "" });
      fetch();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="container mt-3">
      <h4>Movimientos de Inventario</h4>
      <div className="mb-3">
        <select
          className="form-select"
          value={form.product}
          onChange={(e) => {
            setForm({ ...form, product: e.target.value });
            const p = products.find((x) => x._id === e.target.value);
            setSelectedProduct(p || null);
          }}
        >
          <option value="">Selecciona producto</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} (stock: {p.quantity})
            </option>
          ))}
        </select>
        <div className="input-group mt-2">
          <select
            className="form-select"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="in">Entrada</option>
            <option value="out">Salida</option>
          </select>
          <input
            className="form-control"
            type="number"
            value={form.quantity}
            onChange={(e) =>
              setForm({ ...form, quantity: parseInt(e.target.value) })
            }
            placeholder={
              selectedProduct?.unit === "litro" ? "Litros" : "Cantidad"
            }
          />
          <input
            className="form-control"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas"
          />
          <button className="btn btn-primary" onClick={submit}>
            Registrar
          </button>
        </div>
      </div>

      <h5>Últimos movimientos</h5>

      <ul className="list-group">
        {movements.map((m) => (
          <li
            key={m._id}
            className={`list-group-item d-flex justify-content-between align-items-center ${
              m.product?.unit === "litro" ? "list-group-item-info" : ""
            }`}
          >
            {new Date(m.createdAt).toLocaleString()} — <b>{m.product?.name}</b>
            {m.product?.unit === "litro" && (
              <span className="badge bg-primary ms-2">Tanque</span>
            )}
            — {m.user?.name || ""} — {m.notes}
          </li>
        ))}
      </ul>
    </div>
  );
}
