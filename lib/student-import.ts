export type QuickStudentImport = {
  fullName: string;
  documentId: string;
  address: string;
  country: string;
  email: string;
  phone: string;
  plan: number;
  installmentAmount: number;
  currency: "USDT" | "USDC" | "EUR";
  network: string;
  wallet: string;
  contractRequired: boolean;
  notes: string;
  dueDates: string[];
  paidInstallments: number[];
};

type ImportDefaults = {
  usdtNetwork: string;
  usdtWallet: string;
  usdcNetwork: string;
  usdcWallet: string;
  today?: Date;
};

const monthNumbers: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function withoutAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalized(value: string) {
  return withoutAccents(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseSpanishDate(value: string, defaultYear: number) {
  const numeric = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const rawYear = numeric[3] ? Number(numeric[3]) : defaultYear;
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return isoDate(year, Number(numeric[2]), Number(numeric[1]));
  }

  const simple = normalized(value).match(/\b(\d{1,2})(?:\s+de)?\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(\d{4}))?\b/);
  if (!simple) return "";
  return isoDate(Number(simple[3] || defaultYear), monthNumbers[simple[2]], Number(simple[1]));
}

function datesInText(value: string, defaultYear: number) {
  const dates: string[] = [];
  for (const match of value.matchAll(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g)) {
    const date = parseSpanishDate(match[0], defaultYear);
    if (date) dates.push(date);
  }
  for (const match of normalized(value).matchAll(/\b\d{1,2}(?:\s+de)?\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?\d{4})?\b/g)) {
    const date = parseSpanishDate(match[0], defaultYear);
    if (date) dates.push(date);
  }
  return [...new Set(dates)];
}

function labeledValue(lines: string[], labels: string[]) {
  const expression = new RegExp(`^(?:${labels.join("|")})\\s*[:=-]\\s*(.+)$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const match = withoutAccents(lines[index]).match(expression);
    if (match?.[1]?.trim()) return { value: match[1].trim(), index };
  }
  return { value: "", index: -1 };
}

function paymentFromLine(line: string, defaultYear: number) {
  const withoutNumber = line.replace(/^\s*(?:pago|cuota|plazo)\s*\d+\s*[:=-]?\s*/i, "");
  const match = withoutNumber.match(/^\s*(\d+(?:[.,]\d{1,2})?)\s*(?:USDT|USDC|EUR|EUROS?|€)?\s*(?:[-–—:])\s*(.+)$/i);
  if (!match) return null;
  const dueDate = parseSpanishDate(match[2], defaultYear);
  if (!dueDate) return null;
  return { amount: Math.round(Number(match[1].replace(",", "."))), dueDate };
}

function installmentMentions(text: string) {
  const paid = new Set<number>();
  const value = normalized(text);
  const words: Record<string, number> = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4 };
  for (const match of value.matchAll(/(?:pago|cuota|plazo)\s*(\d|primer(?:o)?|segundo|tercer(?:o)?|cuarto)[^\n,.]{0,35}\b(?:pagad[oa]|cobrad[oa]|recibid[oa])\b/g)) {
    const raw = match[1];
    const number = Number(raw) || words[raw];
    if (number) paid.add(number);
  }
  for (const match of value.matchAll(/\b(?:pagad[oa]|cobrad[oa]|recibid[oa])[^\n,.]{0,30}(?:pago|cuota|plazo)\s*(\d|primer(?:o)?|segundo|tercer(?:o)?|cuarto)\b/g)) {
    const raw = match[1];
    const number = Number(raw) || words[raw];
    if (number) paid.add(number);
  }
  if (/\bprimer\s+(?:pago|plazo|mes)\s+(?:ya\s+)?(?:pagad[oa]|cobrad[oa]|recibid[oa])\b/.test(value)) paid.add(1);
  if (/\b(?:pago|abono)\s+(?:ya\s+)?(?:el\s+)?primer\s+(?:pago|plazo|mes)\b/.test(value)) paid.add(1);
  return paid;
}

export function parseStudentText(rawText: string, defaults: ImportDefaults): QuickStudentImport {
  const today = defaults.today || new Date();
  const defaultYear = today.getFullYear();
  const text = rawText.replace(/\u00a0/g, " ").trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const used = new Set<number>();
  const normalizedText = normalized(text);

  const nameEntry = labeledValue(lines, ["nombre(?: y apellidos)?", "alumno"]);
  let fullName = nameEntry.value;
  if (nameEntry.index >= 0) used.add(nameEntry.index);
  if (!fullName && lines[0] && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{5,}$/.test(lines[0]) && lines[0].split(/\s+/).length >= 2) {
    fullName = lines[0];
    used.add(0);
  }
  if (!fullName) {
    const index = lines.findIndex((line) => {
      const value = normalized(line);
      const words = line.split(/\s+/);
      return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{5,}$/.test(line)
        && words.length >= 2
        && words.length <= 6
        && !/\b(pago|plazo|siguiente|contrato|usdt|usdc|bizum|euros?|tron|datos|tengo|ayer|hoy)\b/.test(value);
    });
    if (index >= 0) {
      fullName = lines[index];
      used.add(index);
    }
  }

  const documentEntry = labeledValue(lines, ["dni", "nie", "documento", "pasaporte", "identificacion"]);
  let documentId = documentEntry.value;
  if (documentEntry.index >= 0) used.add(documentEntry.index);
  if (!documentId) {
    const index = lines.findIndex((line, lineIndex) => !used.has(lineIndex) && /^(?:[XYZ]\d{7,8}[A-Z]|\d{7,9}[A-Z]?)$/i.test(line.replace(/[ .-]/g, "")));
    if (index >= 0) {
      documentId = lines[index].replace(/\s+/g, "");
      used.add(index);
    }
  }

  const countryEntry = labeledValue(lines, ["pais"]);
  const country = countryEntry.value;
  if (countryEntry.index >= 0) used.add(countryEntry.index);

  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  const email = emailMatch?.[0] || "";
  lines.forEach((line, index) => { if (email && line.includes(email)) used.add(index); });

  const phoneEntry = labeledValue(lines, ["telefono", "telf", "tel", "movil", "whatsapp"]);
  let phone = phoneEntry.value;
  if (phoneEntry.index >= 0) used.add(phoneEntry.index);
  if (!phone) {
    const index = lines.findIndex((line, lineIndex) => !used.has(lineIndex) && /^\+?[\d ()-]{9,18}$/.test(line) && line.replace(/\D/g, "").length >= 9);
    if (index >= 0) {
      phone = lines[index];
      used.add(index);
    }
  }

  const addressEntry = labeledValue(lines, ["direccion", "domicilio"]);
  let address = addressEntry.value;
  if (addressEntry.index >= 0) used.add(addressEntry.index);

  const birthEntry = labeledValue(lines, ["fecha de nacimiento", "nacimiento"]);
  let birthDate = birthEntry.value ? parseSpanishDate(birthEntry.value, defaultYear) : "";
  if (birthEntry.index >= 0) used.add(birthEntry.index);
  if (!birthDate) {
    const index = lines.findIndex((line, lineIndex) => !used.has(lineIndex) && /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(line));
    if (index >= 0) {
      birthDate = parseSpanishDate(lines[index], defaultYear);
      used.add(index);
    }
  }

  const paymentsFound: Array<{ amount: number; dueDate: string; lineIndex: number }> = [];
  lines.forEach((line, index) => {
    const payment = paymentFromLine(line, defaultYear);
    if (!payment) return;
    paymentsFound.push({ ...payment, lineIndex: index });
    used.add(index);
  });

  if (!address) {
    const candidates = lines.filter((line, index) => {
      if (used.has(index) || !line) return false;
      const value = normalized(line);
      if (/^(pais|correo|email|telefono|telf|tel|movil|whatsapp|red|wallet|moneda|contrato|notas?)\b/.test(value)) return false;
      if (/\b(usdt|usdc|bizum|euros?|trc20|tron|erc20|bep20|pagad[oa]|cobrad[oa]|recibid[oa]|contrato)\b/.test(value)) return false;
      return /[a-záéíóúüñ]|\d{5}/i.test(line);
    });
    address = candidates.slice(0, 3).join(", ");
  }

  const currency: QuickStudentImport["currency"] = /\b(?:bizum|stripe|euros?|eur)\b|€/.test(normalizedText)
    ? "EUR"
    : /\busdc\b/.test(normalizedText) ? "USDC" : "USDT";
  const plan = 3;
  const installmentAmount = 550;

  const networkEntry = labeledValue(lines, ["red", "network", "metodo(?: de pago)?"]);
  let network = currency === "EUR" ? (/\bstripe\b/.test(normalizedText) ? "Stripe" : "Bizum") : networkEntry.value;
  if (currency !== "EUR" && !network) {
    const networkMatch = text.match(/\b(?:TRC20(?:\s*\(TRON\))?|TRON|ERC20|BEP20)\b/i);
    network = networkMatch?.[0] || (currency === "USDT" ? defaults.usdtNetwork : defaults.usdcNetwork);
  }

  const walletEntry = labeledValue(lines, ["wallet", "direccion de pago", "destino del pago"]);
  const wallet = currency === "USDT"
    ? walletEntry.value || defaults.usdtWallet
    : currency === "USDC" ? walletEntry.value || defaults.usdcWallet : "";
  const contractRequired = !/\b(?:sin contrato|no requiere contrato|no hacemos contrato|contrato no requerido)\b/.test(normalizedText);
  const paidInstallments = installmentMentions(text);
  paymentsFound.forEach((payment, index) => {
    if (/\b(?:pagad[oa]|cobrad[oa]|recibid[oa])\b/.test(normalized(lines[payment.lineIndex]))) paidInstallments.add(index + 1);
  });

  const notes = birthDate ? `Fecha de nacimiento: ${birthDate.split("-").reverse().join("/")}` : "";
  let dueDates = paymentsFound.slice(0, plan).map((payment) => payment.dueDate);
  if (!dueDates.length) {
    dueDates = datesInText(text, defaultYear).filter((date) => date !== birthDate && Number(date.slice(0, 4)) >= defaultYear - 1).slice(0, plan);
  }
  if (dueDates.length === plan - 1 && paidInstallments.has(1)) {
    const inferred = new Date(today);
    if (/\bayer\b/.test(normalizedText)) inferred.setDate(inferred.getDate() - 1);
    if (/\b(?:hoy|ayer)\b/.test(normalizedText)) dueDates.unshift(isoDate(inferred.getFullYear(), inferred.getMonth() + 1, inferred.getDate()));
  }
  while (dueDates.length < 4) dueDates.push("");

  return {
    fullName,
    documentId,
    address,
    country,
    email,
    phone,
    plan,
    installmentAmount,
    currency,
    network,
    wallet,
    contractRequired,
    notes,
    dueDates,
    paidInstallments: [...paidInstallments].filter((number) => number >= 1 && number <= plan).sort(),
  };
}

export function importSummary(result: QuickStudentImport) {
  const missing: string[] = [];
  if (!result.fullName) missing.push("nombre");
  if (!result.documentId) missing.push("documento");
  if (!result.phone) missing.push("teléfono");
  const missingDates = result.dueDates.slice(0, result.plan).filter((date) => !date).length;
  if (missingDates) missing.push(`${missingDates} fecha${missingDates === 1 ? "" : "s"} de pago`);
  const detected = `${result.plan} pagos · ${result.installmentAmount} ${result.currency}${result.paidInstallments.length ? ` · ${result.paidInstallments.length} ya cobrado${result.paidInstallments.length === 1 ? "" : "s"}` : ""}`;
  return missing.length
    ? `Datos detectados: ${detected}. Revisa y completa: ${missing.join(", ")}.`
    : `Datos detectados: ${detected}. Revisa los campos y guarda el alumno.`;
}
