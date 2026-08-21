"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Payment = {
  id: number;
  installmentNo: number;
  amount: number;
  currency: string;
  dueDate: string;
  paidAt: string | null;
  status: "pending" | "paid" | "overdue";
};

type Student = {
  id: number;
  fullName: string;
  documentId: string;
  address: string;
  country: string;
  email: string;
  phone: string;
  plan: number;
  installmentAmount: number;
  currency: string;
  network: string;
  wallet: string;
  accessStatus: "active" | "paused";
  contractStatus: "pending" | "signed" | "not_required";
  signedPdfUrl: string;
  pandadocDocumentId: string;
  pandadocStatus: string;
  pandadocSentAt: string;
  pandadocUpdatedAt: string;
  notes: string;
  payments: Payment[];
};

type PrivateConfig = {
  provider: { name: string };
  drive: { root: string; pending: string; signed: string };
  pandadoc: { configured: boolean; connected: boolean };
};

const emptyForm = {
  fullName: "",
  documentId: "",
  address: "",
  country: "",
  email: "",
  phone: "",
  plan: 3,
  installmentAmount: 510,
  currency: "USDT",
  network: "",
  wallet: "",
  contractRequired: true,
  notes: "",
  dueDates: ["", "", "", ""],
};

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function pandaDocLabel(status: string) {
  return ({
    "document.uploaded": "Preparando",
    "document.draft": "Borrador",
    "document.sent": "Enviado",
    "document.viewed": "Visto por el alumno",
    "document.completed": "Firmado",
    "document.declined": "Rechazado",
    "document.voided": "Caducado",
    "document.error": "Error",
  } as Record<string, string>)[status] || (status ? status.replace("document.", "") : "No enviado");
}

export function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [privateConfig, setPrivateConfig] = useState<PrivateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeView, setActiveView] = useState<"panel" | "students" | "payments" | "contracts">("panel");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pandadocBusy, setPandadocBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");

  const loadStudents = useCallback(async (selectedId?: number) => {
    setError("");
    try {
      const [response, configResponse] = await Promise.all([
        fetch("/api/students", { cache: "no-store" }),
        fetch("/api/config", { cache: "no-store" }),
      ]);
      const payload = await response.json() as { students?: Student[]; error?: string };
      const configPayload = await configResponse.json() as PrivateConfig & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar la información.");
      if (!configResponse.ok) throw new Error(configPayload.error || "No se pudo cargar la configuración privada.");
      setStudents(payload.students || []);
      setPrivateConfig(configPayload);
      if (selectedId) setSelected((payload.students || []).find((item) => item.id === selectedId) || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadStudents(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadStudents]);

  const filtered = useMemo(() => students.filter((student) => {
    const matchesText = `${student.fullName} ${student.email} ${student.documentId}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "overdue" ? student.payments.some((payment) => payment.status === "overdue") : student.contractStatus === filter);
    return matchesText && matchesFilter;
  }), [students, query, filter]);

  const stats = useMemo(() => {
    const openPayments = students.flatMap((student) => student.payments).filter((payment) => payment.status !== "paid");
    const paidPayments = students.flatMap((student) => student.payments).filter((payment) => payment.status === "paid");
    const receivable = openPayments.reduce<Record<string, number>>((totals, payment) => {
      totals[payment.currency] = (totals[payment.currency] || 0) + payment.amount;
      return totals;
    }, {});
    const collected = paidPayments.reduce<Record<string, number>>((totals, payment) => {
      totals[payment.currency] = (totals[payment.currency] || 0) + payment.amount;
      return totals;
    }, {});
    return {
      active: students.filter((student) => student.accessStatus === "active").length,
      receivable,
      collected,
      overdue: openPayments.filter((payment) => payment.status === "overdue").length,
      signed: students.filter((student) => student.contractStatus === "signed").length,
      pendingContracts: students.filter((student) => student.contractStatus === "pending").length,
    };
  }, [students]);

  async function createStudent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dueDates: form.dueDates.slice(0, form.plan) }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo crear el alumno.");
      setForm(emptyForm);
      setShowForm(false);
      await loadStudents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el alumno.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePayment(payment: Payment) {
    await fetch(`/api/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: payment.status === "paid" ? "pending" : "paid" }),
    });
    await loadStudents(selected?.id);
  }

  async function saveSignedPdf() {
    if (!selected) return;
    setSaving(true);
    const response = await fetch(`/api/students/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedPdfUrl: pdfUrl, contractStatus: pdfUrl ? "signed" : "pending" }),
    });
    setSaving(false);
    if (response.ok) {
      setPdfUrl("");
      await loadStudents(selected.id);
    }
  }

  async function sendPandaDocContract() {
    if (!selected) return;
    setPandadocBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/students/${selected.id}/pandadoc`, { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo enviar el contrato.");
      await loadStudents(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el contrato.");
    } finally {
      setPandadocBusy(false);
    }
  }

  async function refreshPandaDocStatus() {
    if (!selected?.pandadocDocumentId) return;
    setPandadocBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/students/${selected.id}/pandadoc`, { cache: "no-store" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo actualizar el estado de firma.");
      await loadStudents(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el estado de firma.");
    } finally {
      setPandadocBusy(false);
    }
  }

  function openStudent(student: Student) {
    setSelected(student);
    setPdfUrl(student.signedPdfUrl || "");
  }

  const viewCopy = {
    panel: ["Control de contratos", "Alumnos, cobros y accesos en un solo lugar."],
    students: ["Alumnos", "Fichas, planes y estado de acceso."],
    payments: ["Pagos", "Cuotas cobradas, pendientes y vencidas."],
    contracts: ["Contratos", "Seguimiento de firmas y documentos."],
  }[activeView];
  const paymentRows = students
    .flatMap((student) => student.payments.map((payment) => ({ student, payment })))
    .sort((left, right) => left.payment.dueDate.localeCompare(right.payment.dueDate));

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span>T</span></div><div><strong>TRADINVERSO</strong><span>Gestión privada</span></div></div>
        <nav aria-label="Navegación principal">
          <button className={`nav-item ${activeView === "panel" ? "active" : ""}`} type="button" onClick={() => setActiveView("panel")}><span>▦</span>Panel</button>
          <button className={`nav-item ${activeView === "students" ? "active" : ""}`} type="button" onClick={() => setActiveView("students")}><span>◎</span>Alumnos</button>
          <button className={`nav-item ${activeView === "payments" ? "active" : ""}`} type="button" onClick={() => setActiveView("payments")}><span>◇</span>Pagos</button>
          <button className={`nav-item ${activeView === "contracts" ? "active" : ""}`} type="button" onClick={() => setActiveView("contracts")}><span>▤</span>Contratos</button>
        </nav>
        <a className="drive-card" href={privateConfig?.drive.root || "#"} target="_blank" rel="noreferrer"><span className="drive-icon">D</span><span><strong>Google Drive</strong><small>Carpeta conectada</small></span><b>↗</b></a>
        <div className="profile"><div className="avatar">{initials(privateConfig?.provider.name || "Administrador")}</div><span><strong>{privateConfig?.provider.name || "Administrador"}</strong><small>Administrador</small></span></div>
      </aside>

      <section className="workspace" id="panel">
        <header className="topbar">
          <div><p className="eyebrow">GESTIÓN INTERNA</p><h1>{viewCopy[0]}</h1><p>{viewCopy[1]}</p></div>
          <div className="topbar-actions"><form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Cerrar sesión</button></form><button className="primary-button" type="button" onClick={() => setShowForm(true)}><span>＋</span>Nuevo alumno</button></div>
        </header>

        {error && <div className="alert" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="stats" aria-label="Resumen">
          <article className="stat-card"><span className="stat-icon blue">◎</span><div><p>Alumnos activos</p><strong>{stats.active}</strong><small>{students.length} registrados</small></div></article>
          <article className="stat-card"><span className="stat-icon gold">◇</span><div><p>Por cobrar</p><strong>{Object.keys(stats.receivable).length ? Object.entries(stats.receivable).map(([currency, amount]) => `${amount.toLocaleString("es-ES")} ${currency}`).join(" · ") : "0"}</strong><small>Importes pendientes</small></div></article>
          <article className="stat-card"><span className="stat-icon green">✓</span><div><p>Cobrado</p><strong>{Object.keys(stats.collected).length ? Object.entries(stats.collected).map(([currency, amount]) => `${amount.toLocaleString("es-ES")} ${currency}`).join(" · ") : "0"}</strong><small>Pagos recibidos</small></div></article>
          <article className="stat-card"><span className="stat-icon red">!</span><div><p>Pagos vencidos</p><strong>{stats.overdue}</strong><small>{stats.overdue ? "Requieren seguimiento" : "Todo al día"}</small></div></article>
          <article className="stat-card"><span className="stat-icon violet">▤</span><div><p>Contratos firmados</p><strong>{stats.signed}</strong><small>{stats.pendingContracts} pendientes</small></div></article>
        </section>

        {(activeView === "panel" || activeView === "students") && <section className={`content-grid ${activeView === "students" ? "single" : ""}`}>
          <article className="panel students-panel" id="alumnos">
            <div className="panel-heading panel-heading-stack">
              <div><h2>Seguimiento de alumnos</h2><p>Próximos pagos y estado de acceso</p></div>
              <div className="table-tools">
                <input aria-label="Buscar alumno" placeholder="Buscar alumno…" value={query} onChange={(event) => setQuery(event.target.value)} />
                <select aria-label="Filtrar alumnos" value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">Todos</option><option value="pending">Pendientes de firma</option><option value="signed">Firmados</option><option value="overdue">Con pagos vencidos</option>
                </select>
              </div>
            </div>
            <div className="student-table" role="table" aria-label="Alumnos">
              <div className="table-row table-head" role="row"><span>ALUMNO</span><span>PLAN</span><span>PROGRESO</span><span>PRÓXIMO PAGO</span><span>ACCESO</span></div>
              {loading && <div className="empty-state"><strong>Cargando alumnos…</strong></div>}
              {!loading && filtered.length === 0 && <div className="empty-state"><span>◎</span><strong>Aún no hay alumnos</strong><p>Crea el primero para generar su calendario y contrato.</p><button type="button" onClick={() => setShowForm(true)}>Registrar alumno</button></div>}
              {filtered.map((student) => {
                const paid = student.payments.filter((payment) => payment.status === "paid").length;
                const next = student.payments.find((payment) => payment.status !== "paid");
                return (
                  <button className="table-row clickable-row" role="row" key={student.id} type="button" onClick={() => openStudent(student)}>
                    <span className="student-name"><b>{initials(student.fullName)}</b><span><strong>{student.fullName}</strong><small>{student.contractStatus === "signed" ? "Contrato firmado" : student.contractStatus === "not_required" ? "Sin contrato" : "Pendiente de firma"}</small></span></span>
                    <span>{student.plan} pagos · {student.installmentAmount} {student.currency}</span>
                    <span><strong>{paid} de {student.plan}</strong><i><em style={{ width: `${(paid / student.plan) * 100}%` }} /></i></span>
                    <span>{next ? formatDate(next.dueDate) : "Completado"}</span>
                    <span><mark className={`status ${student.accessStatus === "active" ? "active" : "paused"}`}>{student.accessStatus === "active" ? "Activo" : "Pausado"}</mark></span>
                  </button>
                );
              })}
            </div>
          </article>

          {activeView === "panel" && <aside className="panel quick-panel" id="contratos">
            <div className="panel-heading"><div><h2>Acciones rápidas</h2><p>Tu operativa diaria</p></div></div>
            <button className="quick-action" type="button" onClick={() => setShowForm(true)}><span className="quick-icon">＋</span><span><strong>Registrar alumno</strong><small>Crear ficha y calendario</small></span><b>›</b></button>
            <a className="quick-action" href={privateConfig?.drive.pending || "#"} target="_blank" rel="noreferrer"><span className="quick-icon">▤</span><span><strong>Pendientes de firma</strong><small>Abrir carpeta de Drive</small></span><b>›</b></a>
            <a className="quick-action" href={privateConfig?.drive.signed || "#"} target="_blank" rel="noreferrer"><span className="quick-icon">↑</span><span><strong>Contratos firmados</strong><small>PDF privados en Drive</small></span><b>›</b></a>
            <div className="drive-health"><span>✓</span><div><strong>Drive conectado</strong><small>4 carpetas preparadas</small></div></div>
            <div className={`drive-health pandadoc-health ${privateConfig?.pandadoc.connected ? "" : "offline"}`}><span>PD</span><div><strong>{privateConfig?.pandadoc.connected ? "PandaDoc conectado" : "PandaDoc sin conexión"}</strong><small>{privateConfig?.pandadoc.connected ? "Clave validada · envíos disponibles" : privateConfig?.pandadoc.configured ? "La clave está guardada, pero PandaDoc no responde" : "Falta configurar la clave"}</small></div></div>
          </aside>}
        </section>}

        {activeView === "payments" && <article className="panel view-panel">
          <div className="panel-heading"><div><h2>Calendario general de pagos</h2><p>Todos los movimientos ordenados por fecha</p></div></div>
          <div className="view-table" role="table" aria-label="Pagos">
            <div className="view-table-row view-table-head" role="row"><span>ALUMNO</span><span>CUOTA</span><span>IMPORTE</span><span>FECHA</span><span>ESTADO</span></div>
            {!loading && paymentRows.length === 0 && <div className="empty-state"><span>◇</span><strong>Aún no hay pagos</strong><p>Los calendarios aparecerán al registrar alumnos.</p></div>}
            {paymentRows.map(({ student, payment }) => <div className="view-table-row" role="row" key={payment.id}>
              <button className="student-link" type="button" onClick={() => openStudent(student)}>{student.fullName}</button>
              <span>{payment.installmentNo} de {student.plan}</span><strong>{payment.amount} {payment.currency}</strong><span>{formatDate(payment.dueDate)}</span>
              <button className={`payment-toggle ${payment.status}`} type="button" onClick={() => void togglePayment(payment)}>{payment.status === "paid" ? "✓ Pagado" : payment.status === "overdue" ? "Marcar pagado" : "Pendiente"}</button>
            </div>)}
          </div>
        </article>}

        {activeView === "contracts" && <article className="panel view-panel">
          <div className="panel-heading"><div><h2>Estado de contratos</h2><p>Firmados, pendientes y alumnos sin contrato</p></div></div>
          <div className="view-table" role="table" aria-label="Contratos">
            <div className="view-table-row contracts-row view-table-head" role="row"><span>ALUMNO</span><span>PLAN</span><span>ESTADO</span><span>DOCUMENTO</span></div>
            {!loading && students.length === 0 && <div className="empty-state"><span>▤</span><strong>Aún no hay alumnos</strong><p>Los contratos aparecerán al registrar alumnos.</p></div>}
            {students.map((student) => <div className="view-table-row contracts-row" role="row" key={student.id}>
              <button className="student-link" type="button" onClick={() => openStudent(student)}>{student.fullName}</button><span>{student.plan} × {student.installmentAmount} {student.currency}</span>
              <mark className={`status ${student.contractStatus === "signed" ? "active" : student.contractStatus === "not_required" ? "paused" : "warning"}`}>{student.contractStatus === "signed" ? "Firmado" : student.contractStatus === "not_required" ? "No requerido" : "Pendiente"}</mark>
              {student.signedPdfUrl ? <a className="signed-link compact-link" href={student.signedPdfUrl} target="_blank" rel="noreferrer">Abrir documento ↗</a> : student.pandadocDocumentId ? <a className="signed-link compact-link" href={`https://app.pandadoc.com/a/#/documents/${student.pandadocDocumentId}`} target="_blank" rel="noreferrer">{pandaDocLabel(student.pandadocStatus)} ↗</a> : <span>Sin documento</span>}
            </div>)}
          </div>
        </article>}
      </section>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-student-title">
            <div className="modal-header"><div><p className="eyebrow">NUEVA INCORPORACIÓN</p><h2 id="new-student-title">Registrar alumno</h2><p>La ficha creará automáticamente su calendario de cuotas.</p></div><button type="button" aria-label="Cerrar" onClick={() => setShowForm(false)}>×</button></div>
            <form onSubmit={createStudent}>
              <div className="form-section"><h3>Datos del alumno</h3><div className="form-grid">
                <label className="wide">Nombre y apellidos<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
                <label>DNI / Pasaporte<input required value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} /></label>
                <label>País<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
                <label className="wide">Dirección<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
                <label>Correo electrónico<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label>Teléfono<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              </div></div>
              <div className="form-section"><h3>Plan y forma de pago</h3><div className="form-grid">
                <label>Plan<select value={form.plan} onChange={(e) => { const plan = Number(e.target.value); setForm({ ...form, plan, installmentAmount: form.currency === "EUR" ? (plan === 4 ? 375 : 500) : (plan === 4 ? 385 : 510) }); }}><option value={3}>3 pagos</option><option value={4}>4 pagos</option></select></label>
                <label>Importe de cada pago<input required min="1" step="1" type="number" value={form.installmentAmount} onChange={(e) => setForm({ ...form, installmentAmount: Number(e.target.value) })} /></label>
                <label>Moneda<select value={form.currency} onChange={(e) => { const currency = e.target.value; setForm({ ...form, currency, installmentAmount: currency === "EUR" ? (form.plan === 4 ? 375 : 500) : (form.plan === 4 ? 385 : 510), network: currency === "EUR" ? "Bizum" : "", wallet: currency === "EUR" ? "" : form.wallet }); }}><option>USDT</option><option>USDC</option><option>EUR</option></select></label>
                {form.currency === "EUR" ? <label>Método de pago<select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })}><option>Bizum</option></select></label> : <label>Red<input placeholder="Ej. TRC20, ERC20…" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} /></label>}
                {form.currency !== "EUR" && <label className="wide">Wallet<input value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })} /></label>}
                <label className="wide">Contrato<select value={form.contractRequired ? "required" : "not_required"} onChange={(e) => setForm({ ...form, contractRequired: e.target.value === "required" })}><option value="required">Requiere contrato</option><option value="not_required">Sin contrato</option></select></label>
              </div></div>
              <div className="form-section"><h3>Fechas de pago</h3><div className="dates-grid">{Array.from({ length: form.plan }, (_, index) => <label key={index}>Pago {index + 1}<input required type="date" value={form.dueDates[index]} onChange={(e) => { const dueDates = [...form.dueDates]; dueDates[index] = e.target.value; setForm({ ...form, dueDates }); }} /></label>)}</div></div>
              <div className="form-section"><label>Notas internas<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div>
              <footer className="modal-footer"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar alumno"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Ficha de ${selected.fullName}`}>
            <div className="drawer-header"><div className="student-hero"><b>{initials(selected.fullName)}</b><div><p className="eyebrow">FICHA DEL ALUMNO</p><h2>{selected.fullName}</h2><span>{selected.documentId} · {selected.country || "Sin país"}</span></div></div><button type="button" aria-label="Cerrar" onClick={() => setSelected(null)}>×</button></div>
            <div className="drawer-content">
              <div className="detail-grid"><span><small>Correo</small><strong>{selected.email || "Sin indicar"}</strong></span><span><small>Teléfono</small><strong>{selected.phone}</strong></span><span><small>Plan</small><strong>{selected.plan} × {selected.installmentAmount} {selected.currency}</strong></span><span><small>{selected.currency === "EUR" ? "Método" : "Red"}</small><strong>{selected.network || "Sin indicar"}</strong></span></div>
              <section className="drawer-section" id="pagos"><div className="section-title"><h3>Calendario de pagos</h3><mark className={`status ${selected.accessStatus === "active" ? "active" : "paused"}`}>{selected.accessStatus === "active" ? "Acceso activo" : "Acceso pausado"}</mark></div>
                <div className="payments-list">{selected.payments.map((payment) => <div className="payment-item" key={payment.id}><span><b>{payment.installmentNo}</b><span><strong>{payment.amount} {payment.currency}</strong><small>Vence {formatDate(payment.dueDate)}</small></span></span><button className={`payment-toggle ${payment.status}`} type="button" onClick={() => void togglePayment(payment)}>{payment.status === "paid" ? "✓ Pagado" : payment.status === "overdue" ? "Marcar pagado" : "Pendiente"}</button></div>)}</div>
              </section>
              {selected.contractStatus === "not_required" ? <section className="drawer-section"><h3>Contrato</h3><p className="notes">Este alumno está registrado únicamente para seguimiento interno y no requiere contrato.</p></section> : <section className="drawer-section"><h3>Contrato</h3><div className="contract-actions"><a className="secondary-button button-link" href={`/contrato/${selected.id}`} target="_blank" rel="noreferrer">Abrir contrato imprimible</a><button className="primary-button button-link" type="button" disabled={pandadocBusy || !privateConfig?.pandadoc.connected || !selected.email} onClick={() => void sendPandaDocContract()}>{pandadocBusy ? "Conectando…" : selected.pandadocDocumentId ? "Revisar en PandaDoc" : "Enviar a PandaDoc"}</button></div>
                <div className={`pandadoc-state ${selected.pandadocStatus === "document.completed" ? "complete" : ""}`}><span>PD</span><div><strong>{privateConfig?.pandadoc.connected ? pandaDocLabel(selected.pandadocStatus) : "PandaDoc pendiente de conectar"}</strong><small>{selected.pandadocDocumentId ? "Seguimiento automático de la firma" : selected.email ? "Se enviará al correo del alumno" : "Añade el correo del alumno para poder enviarlo"}</small></div>{selected.pandadocDocumentId && <button type="button" disabled={pandadocBusy} onClick={() => void refreshPandaDocStatus()}>Actualizar</button>}</div>
                {selected.pandadocDocumentId && <a className="signed-link" href={`https://app.pandadoc.com/a/#/documents/${selected.pandadocDocumentId}`} target="_blank" rel="noreferrer">Abrir documento en PandaDoc ↗</a>}
                <label className="pdf-field">Enlace del PDF firmado<input placeholder="Pega aquí el enlace de Drive" value={pdfUrl} onChange={(event) => setPdfUrl(event.target.value)} /></label>
                <button className="save-link" type="button" disabled={saving} onClick={() => void saveSignedPdf()}>{saving ? "Guardando…" : "Guardar enlace firmado"}</button>
                {selected.signedPdfUrl && <a className="signed-link" href={selected.signedPdfUrl} target="_blank" rel="noreferrer">✓ Abrir PDF firmado en Drive ↗</a>}
              </section>}
              {selected.notes && <section className="drawer-section"><h3>Notas internas</h3><p className="notes">{selected.notes}</p></section>}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
