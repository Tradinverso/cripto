"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  payments: Array<{ id: number; installmentNo: number; amount: number; currency: string; dueDate: string }>;
};

type PrivateConfig = {
  provider: { name: string; documentId: string; address: string; email: string; phone: string };
};

function date(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export function ContractView({ id }: { id: string }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [privateConfig, setPrivateConfig] = useState<PrivateConfig | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/students?id=${id}`, { cache: "no-store" }),
      fetch("/api/config", { cache: "no-store" }),
    ])
      .then(async ([response, configResponse]) => {
        const data = await response.json() as { students?: Student[]; error?: string };
        const configData = await configResponse.json() as PrivateConfig & { error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudo abrir el contrato.");
        if (!configResponse.ok) throw new Error(configData.error || "No se pudo cargar la configuración privada.");
        setStudent(data.students?.[0] || null);
        setPrivateConfig(configData);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo abrir el contrato."));
  }, [id]);

  if (error) return <main className="contract-loading">{error}</main>;
  if (!student || !privateConfig) return <main className="contract-loading">Preparando contrato…</main>;
  const total = student.plan * student.installmentAmount;

  return (
    <main className="contract-page">
      <div className="print-toolbar"><button type="button" onClick={() => window.print()}>Imprimir o guardar en PDF</button><Link href="/">Volver al panel</Link></div>
      <article className="contract-sheet">
        <header className="contract-title"><p>TRADINVERSO</p><h1>Acuerdo privado de acceso y pago</h1><span>Programa completo · modalidad de pago en plazos</span></header>
        <div className="contract-summary"><span><small>PLAN ELEGIDO</small><strong>{student.plan} pagos</strong></span><span><small>CADA PAGO</small><strong>{student.installmentAmount} {student.currency}</strong></span><span><small>TOTAL</small><strong>{total} {student.currency}</strong></span></div>

        <section><h2>Datos de las partes</h2><div className="contract-columns"><div><h3>TRADINVERSO / RESPONSABLE</h3><dl><dt>Nombre</dt><dd>{privateConfig.provider.name}</dd><dt>DNI</dt><dd>{privateConfig.provider.documentId}</dd><dt>Dirección</dt><dd>{privateConfig.provider.address}</dd><dt>Correo</dt><dd>{privateConfig.provider.email}</dd><dt>Teléfono</dt><dd>{privateConfig.provider.phone}</dd></dl></div><div><h3>ALUMNO</h3><dl><dt>Nombre</dt><dd>{student.fullName}</dd><dt>DNI / Pasaporte</dt><dd>{student.documentId}</dd><dt>Dirección</dt><dd>{student.address}{student.country ? `, ${student.country}` : ""}</dd><dt>Correo</dt><dd>{student.email}</dd><dt>Teléfono</dt><dd>{student.phone}</dd></dl></div></div></section>

        <section><h2>Qué estamos acordando</h2><p>Tradinverso dará al alumno acceso al programa completo de formación y acompañamiento. El alumno elige pagar el precio total en varios plazos y se compromete a completar todos los pagos indicados en este documento.</p><p>Este plan no funciona como una suscripción mensual. Que el alumno deje de utilizar la formación, la comunidad o las sesiones no elimina el compromiso de completar las cantidades acordadas.</p></section>

        <section><h2>Qué incluye Tradinverso</h2><p>La formación está dividida en tres pilares: Trading, Psicotrading y Optimización Financiera.</p><p>Desde el primer pago, el alumno tendrá acceso a la comunidad, llamadas, clases, operativas en directo, demás sesiones organizadas por Tradinverso y acceso al software TRADINVERSO. Los pilares formativos se abrirán progresivamente con cada pago.</p></section>

        <section><h2>Cómo se abre el acceso</h2><table><thead><tr><th>Momento</th><th>Formación</th><th>Acceso y servicios</th></tr></thead><tbody><tr><td>Después del pago 1</td><td>Pilar Trading</td><td>Comunidad, llamadas, clases, operativas y software TRADINVERSO</td></tr><tr><td>Después del pago 2</td><td>Se añade Psicotrading</td><td>Se mantiene el acceso a todos los servicios</td></tr><tr><td>Después del pago 3</td><td>Se añade Optimización Financiera</td><td>Acceso completo a todo el programa confirmado</td></tr>{student.plan === 4 && <tr><td>Después del pago 4</td><td>Los tres pilares permanecen disponibles</td><td>Se mantiene el acceso completo a todo el programa</td></tr>}</tbody></table></section>

        <section><h2>Calendario de pagos</h2><p>El precio total acordado es de {total} {student.currency}, dividido en {student.plan} pagos de {student.installmentAmount} {student.currency}.</p><table><thead><tr><th>Pago</th><th>Importe</th><th>Fecha acordada</th><th>Qué se desbloquea</th></tr></thead><tbody>{student.payments.map((payment) => <tr key={payment.id}><td>{payment.installmentNo}</td><td>{payment.amount} {payment.currency}</td><td>{date(payment.dueDate)}</td><td>{payment.installmentNo === 1 ? "Pilar Trading + todos los servicios + software TRADINVERSO" : payment.installmentNo === 2 ? "Se añade Psicotrading" : payment.installmentNo === 3 ? "Se añade Optimización Financiera y se confirma el acceso completo" : "Se mantiene el acceso completo"}</td></tr>)}</tbody></table></section>

        <section><h2>Datos para el pago en criptomonedas</h2><dl className="crypto-details"><dt>Criptomoneda</dt><dd>{student.currency}</dd><dt>Red</dt><dd>{student.network || "____________________________"}</dd><dt>Wallet</dt><dd>{student.wallet || "____________________________"}</dd></dl></section>

        <section><h2>Si un pago se retrasa</h2><p>Cada pago debe realizarse como máximo en la fecha acordada. Si al terminar ese día no se ha recibido, Tradinverso pausará desde el día siguiente todo el acceso del alumno: formación, comunidad, llamadas, clases, operativas en directo, software TRADINVERSO y cualquier otro servicio.</p><p>La pausa no cancela el compromiso de pago. En cuanto Tradinverso reciba el pago pendiente, el acceso se reactivará.</p></section>

        <section><h2>Confirmación del acuerdo</h2><p>Con su firma, ambas partes confirman que entienden el plan elegido, las fechas, el acceso progresivo y la pausa inmediata del servicio cuando exista un pago pendiente.</p><div className="signatures"><div><strong>EL PRESTADOR</strong><span>Firma: ______________________________</span><span>{privateConfig.provider.name}</span><span>Fecha: ____ / ____ / ______</span></div><div><strong>EL ALUMNO</strong><span>Firma: ______________________________</span><span>{student.fullName}</span><span>Fecha: ____ / ____ / ______</span></div></div></section>
      </article>
    </main>
  );
}
