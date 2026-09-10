"use strict";

const bridge = window.api;

// ============================================================
// CONSTANTES
// ============================================================

const CLASS_COLORS = { A: "#00E5C0", B: "#FFD166", C: "#B066FF", D: "#8A8A9E" };

const STAGE_CLASS = {
  Prospecting: "stage-prospecting",
  Contactado: "stage-contactado",
  "Propuesta Enviada": "stage-propuesta",
  "Negociación": "stage-negociacion",
  Ganado: "stage-ganado",
  Perdido: "stage-perdido",
};

const WEIGHT_COLUMNS = ["weight_title", "weight_company", "weight_location", "weight_industry", "weight_keywords"];
const WEIGHT_LABELS = {
  weight_title: "Title",
  weight_company: "Company",
  weight_location: "Location",
  weight_industry: "Industry",
  weight_keywords: "Keywords",
};
const WEIGHT_DEFAULTS = { weight_title: 30, weight_company: 15, weight_location: 15, weight_industry: 25, weight_keywords: 15 };
const WEIGHT_BAR_COLORS = ["#00E5C0", "#FFD166", "#B066FF", "#5CC8FF", "#FF8FB3"];

// ============================================================
// ESTADO
// ============================================================

let offeringId = null;
let painId = null;
let icpId = null;
let contactId = null;
let dealContactId = null;

let selectedOfferingRow = null;
let selectedPainRow = null;
let selectedIcpRow = null;
let selectedContactRow = null;

// ============================================================
// HELPERS GENERICOS
// ============================================================

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function truncate(text, max) {
  const clean = (text || "").replace(/\n/g, " ");
  return clean.length > max ? clean.slice(0, max - 3) + "..." : clean;
}

function showModal(title, message, { confirm = false } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-box">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          <div class="modal-actions">
            ${confirm ? '<button class="btn" id="modal-cancel">Cancelar</button>' : ""}
            <button class="btn accent" id="modal-ok">${confirm ? "Confirmar" : "OK"}</button>
          </div>
        </div>
      </div>`;

    const close = (value) => {
      root.innerHTML = "";
      resolve(value);
    };

    document.getElementById("modal-ok").onclick = () => close(true);
    if (confirm) {
      document.getElementById("modal-cancel").onclick = () => close(false);
    }
  });
}

function getSelectedOptionIds(select) {
  return Array.from(select.selectedOptions).map((o) => Number(o.value));
}

function setSelectedOptionIds(select, ids) {
  const idSet = new Set(ids || []);
  Array.from(select.options).forEach((o) => {
    o.selected = idSet.has(Number(o.value));
  });
}

/**
 * Click = selecciona/resalta la fila. Doble click = carga la fila en el formulario.
 * Mismo patron que ttk.Treeview en la version Tkinter.
 */
function wireTableSelection(tableId, onSelect, onLoad) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    tbody.querySelectorAll("tr").forEach((r) => r.classList.remove("selected"));
    tr.classList.add("selected");
    onSelect(tr.dataset.id);
  });
  tbody.addEventListener("dblclick", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    onLoad(tr.dataset.id);
  });
}

// ============================================================
// TABS
// ============================================================

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));

  if (name === "icp") refreshPainChoices();
  else if (name === "contacts") refreshContacts();
  else if (name === "pipeline") refreshPipeline();
  else if (name === "intelligence") refreshResults();
}

// ============================================================
// PROPUESTA -- Offerings
// ============================================================

async function refreshPainChoices() {
  const pains = await bridge.pains.list();
  const optionsHtml = pains
    .map((p) => `<option value="${p.id}">[${escapeHtml(p.category)}] ${escapeHtml(p.name)}</option>`)
    .join("");
  document.getElementById("offering-pains").innerHTML = optionsHtml;
  document.getElementById("icp-pains").innerHTML = optionsHtml;
}

async function refreshOfferings() {
  const rows = await bridge.offerings.list();
  const tbody = document.querySelector("#offering-table tbody");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr data-id="${r.id}">
        <td>${r.id}</td><td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(truncate(r.outcome, 60))}</td><td>${r.pains_count}</td>
      </tr>`
    )
    .join("");
  await refreshStatusBar();
}

async function loadOffering(id) {
  const data = await bridge.offerings.get(id);
  if (!data) return;
  offeringId = id;
  document.getElementById("offering-kind").value = data.kind;
  document.getElementById("offering-name").value = data.name;
  document.getElementById("offering-outcome").value = data.outcome || "";
  document.getElementById("offering-notes").value = data.notes || "";
  setSelectedOptionIds(document.getElementById("offering-pains"), data.pain_ids);
}

function clearOfferingForm() {
  offeringId = null;
  document.getElementById("offering-kind").value = "Producto";
  document.getElementById("offering-name").value = "";
  document.getElementById("offering-outcome").value = "";
  document.getElementById("offering-notes").value = "";
  document.getElementById("offering-pains").selectedIndex = -1;
}

async function saveOffering() {
  const name = document.getElementById("offering-name").value.trim();
  if (!name) {
    await showModal("Offering", "El nombre es obligatorio.");
    return;
  }

  const data = {
    id: offeringId,
    kind: document.getElementById("offering-kind").value,
    name,
    outcome: document.getElementById("offering-outcome").value.trim(),
    notes: document.getElementById("offering-notes").value.trim(),
    pain_ids: getSelectedOptionIds(document.getElementById("offering-pains")),
  };

  try {
    await bridge.offerings.save(data);
  } catch (e) {
    await showModal("SQLite", `No se pudo guardar el offering:\n\n${e.message}`);
    return;
  }

  clearOfferingForm();
  await refreshOfferings();
  await showModal("AETHERYON", "Offering guardado.");
}

async function deleteOffering() {
  if (!selectedOfferingRow) {
    await showModal("Offering", "Seleccioná un offering.");
    return;
  }
  const ok = await showModal("Confirmar", "¿Eliminar este offering?", { confirm: true });
  if (!ok) return;

  await bridge.offerings.delete(Number(selectedOfferingRow));
  clearOfferingForm();
  await refreshOfferings();
}

// ============================================================
// PROPUESTA -- Pains
// ============================================================

async function refreshPains() {
  const rows = await bridge.pains.listWithCounts();
  const tbody = document.querySelector("#pain-table tbody");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr data-id="${r.id}">
        <td>${r.id}</td><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.name)}</td><td>${r.offerings_count}</td>
      </tr>`
    )
    .join("");
  await refreshStatusBar();
}

async function loadPain(id) {
  const data = await bridge.pains.get(id);
  if (!data) return;
  painId = id;
  document.getElementById("pain-category").value = data.category;
  document.getElementById("pain-name").value = data.name;
  document.getElementById("pain-notes").value = data.notes || "";
}

function clearPainForm() {
  painId = null;
  document.getElementById("pain-category").value = "Datos";
  document.getElementById("pain-name").value = "";
  document.getElementById("pain-notes").value = "";
}

async function savePain() {
  const name = document.getElementById("pain-name").value.trim();
  if (!name) {
    await showModal("Pain", "El nombre es obligatorio.");
    return;
  }

  const data = {
    id: painId,
    category: document.getElementById("pain-category").value.trim() || "General",
    name,
    notes: document.getElementById("pain-notes").value.trim(),
  };

  try {
    await bridge.pains.save(data);
  } catch (e) {
    await showModal("SQLite", `No se pudo guardar el pain:\n\n${e.message}`);
    return;
  }

  clearPainForm();
  await refreshPains();
  await refreshPainChoices();
  await showModal("AETHERYON", "Pain guardado.");
}

async function deletePain() {
  if (!selectedPainRow) {
    await showModal("Pain", "Seleccioná un pain.");
    return;
  }
  const ok = await showModal(
    "Confirmar",
    "¿Eliminar este pain? También se quita de ICPs y offerings vinculados.",
    { confirm: true }
  );
  if (!ok) return;

  await bridge.pains.delete(Number(selectedPainRow));
  clearPainForm();
  await refreshPains();
  await refreshOfferings();
  await refreshPainChoices();
}

// ============================================================
// ICP DEFINITION
// ============================================================

function buildWeightGrid() {
  const grid = document.getElementById("weight-grid");
  grid.innerHTML = WEIGHT_COLUMNS.map(
    (col, i) => `
    <div class="weight-item">
      <span class="swatch" style="background:${WEIGHT_BAR_COLORS[i]}"></span>
      <span>${WEIGHT_LABELS[col]}</span>
      <input type="number" id="w-${col}" value="${WEIGHT_DEFAULTS[col]}" min="0" step="1">
    </div>`
  ).join("");

  WEIGHT_COLUMNS.forEach((col) => {
    document.getElementById(`w-${col}`).addEventListener("input", updateWeightTotal);
  });

  updateWeightTotal();
}

function getWeightsLenient() {
  const w = {};
  WEIGHT_COLUMNS.forEach((col) => {
    const n = Number(document.getElementById(`w-${col}`).value);
    w[col] = Number.isFinite(n) ? Math.max(0, n) : 0;
  });
  return w;
}

function setWeights(w) {
  WEIGHT_COLUMNS.forEach((col) => {
    document.getElementById(`w-${col}`).value = w[col] ?? WEIGHT_DEFAULTS[col];
  });
  updateWeightTotal();
}

function updateWeightTotal() {
  const w = getWeightsLenient();
  const total = WEIGHT_COLUMNS.reduce((sum, col) => sum + w[col], 0);

  const el = document.getElementById("weight-total");
  el.textContent = `Total: ${total} / 100 ${total === 100 ? "✓" : "⚠"}`;
  el.className = `weight-total ${total === 100 ? "ok" : "bad"}`;

  drawWeightBar(w, total);
}

function drawWeightBar(weights, total) {
  const canvas = document.getElementById("weight-canvas");
  const width = canvas.clientWidth || 400;
  canvas.width = width;
  canvas.height = 12;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, 12);

  const denom = Math.max(total, 100);
  let x = 0;
  WEIGHT_COLUMNS.forEach((col, i) => {
    const segment = width * (weights[col] / denom);
    if (segment > 0) {
      ctx.fillStyle = WEIGHT_BAR_COLORS[i];
      ctx.fillRect(x, 0, segment, 12);
      x += segment;
    }
  });
  if (x < width) {
    ctx.fillStyle = "#13131F";
    ctx.fillRect(x, 0, width - x, 12);
  }
}

async function refreshIcps() {
  const rows = await bridge.icps.list();
  const tbody = document.querySelector("#icp-table tbody");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr data-id="${r.id}">
        <td>${r.id}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.industries || "")}</td>
        <td>${escapeHtml(r.locations || "")}</td><td>${escapeHtml(r.job_titles || "")}</td><td>${escapeHtml(r.status || "")}</td>
      </tr>`
    )
    .join("");
  await refreshStatusBar();
}

async function loadIcp(id) {
  const data = await bridge.icps.get(id);
  if (!data) return;

  icpId = id;
  document.getElementById("icp-name").value = data.name;
  document.getElementById("icp-status").value = data.status || "Active";
  document.getElementById("icp-description").value = data.description || "";

  ["job_titles", "companies", "locations", "industries", "keywords", "notes"].forEach((k) => {
    document.getElementById(`icp-${k}`).value = data[k] || "";
  });

  setWeights(data);
  setSelectedOptionIds(document.getElementById("icp-pains"), data.pain_ids);
}

function clearIcpForm() {
  icpId = null;
  document.getElementById("icp-name").value = "";
  document.getElementById("icp-status").value = "Active";
  document.getElementById("icp-description").value = "";

  ["job_titles", "companies", "locations", "industries", "keywords", "notes"].forEach((k) => {
    document.getElementById(`icp-${k}`).value = "";
  });

  setWeights(WEIGHT_DEFAULTS);
  document.getElementById("icp-pains").selectedIndex = -1;
}

async function saveIcp() {
  const name = document.getElementById("icp-name").value.trim();
  if (!name) {
    await showModal("ICP", "El nombre del ICP es obligatorio.");
    return;
  }

  const weights = {};
  let invalid = false;
  WEIGHT_COLUMNS.forEach((col) => {
    const raw = document.getElementById(`w-${col}`).value;
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0) invalid = true;
    weights[col] = n;
  });

  if (invalid) {
    await showModal("ICP", "Los pesos deben ser números enteros iguales o mayores a 0.");
    return;
  }

  const total = WEIGHT_COLUMNS.reduce((sum, col) => sum + weights[col], 0);
  if (total !== 100) {
    await showModal("ICP", `La suma de los pesos debe ser exactamente 100.\n\nTotal actual: ${total}`);
    return;
  }

  const data = {
    id: icpId,
    name,
    description: document.getElementById("icp-description").value.trim(),
    job_titles: document.getElementById("icp-job_titles").value.trim(),
    companies: document.getElementById("icp-companies").value.trim(),
    locations: document.getElementById("icp-locations").value.trim(),
    industries: document.getElementById("icp-industries").value.trim(),
    keywords: document.getElementById("icp-keywords").value.trim(),
    notes: document.getElementById("icp-notes").value.trim(),
    status: document.getElementById("icp-status").value || "Active",
    ...weights,
    pain_ids: getSelectedOptionIds(document.getElementById("icp-pains")),
  };

  try {
    await bridge.icps.save(data);
  } catch (e) {
    await showModal("ICP", e.message);
    return;
  }

  clearIcpForm();
  await refreshIcps();
  await refreshStatusBar();
  await showModal("AETHERYON", "ICP guardado correctamente.");
}

async function deleteIcp() {
  if (!selectedIcpRow) {
    await showModal("ICP", "Seleccioná un ICP.");
    return;
  }
  const ok = await showModal("Confirmar", "¿Eliminar este ICP?", { confirm: true });
  if (!ok) return;

  await bridge.icps.delete(Number(selectedIcpRow));
  clearIcpForm();
  await refreshIcps();
  await refreshContacts();
  await refreshResults();
  await refreshStatusBar();
}

// ============================================================
// ENTITY MANAGEMENT -- Contacts
// ============================================================

function setMatchDisplay(best) {
  const badge = document.getElementById("contact-badge");

  if (best && best.classification) {
    badge.textContent = best.classification;
    badge.style.background = CLASS_COLORS[best.classification] || "#181826";
    badge.style.color = "#07070F";

    document.getElementById("contact-best-icp").textContent = best.icp_name || "—";
    document.getElementById("contact-score").textContent = `${best.score} / 100`;

    const pains = best.pains || [];
    const offerings = best.offerings || [];
    document.getElementById("contact-pains").textContent = "Pains: " + (pains.length ? pains.join(", ") : "—");
    document.getElementById("contact-offerings").textContent =
      "Propuesta sugerida: " + (offerings.length ? offerings.join(", ") : "—");
  } else {
    badge.textContent = "—";
    badge.style.background = "#181826";
    badge.style.color = "#8A8A9E";

    document.getElementById("contact-best-icp").textContent = "Sin evaluar";
    document.getElementById("contact-score").textContent = "0 / 100";
    document.getElementById("contact-pains").textContent = "Pains: —";
    document.getElementById("contact-offerings").textContent = "Propuesta sugerida: —";
  }
}

async function refreshContacts() {
  const rows = await bridge.contacts.list();
  const tbody = document.querySelector("#contact-table tbody");
  tbody.innerHTML = rows
    .map((r) => {
      const cls = r.classification ? `class-${r.classification}` : "";
      return `
      <tr data-id="${r.id}">
        <td>${r.id}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.job_title || "")}</td>
        <td>${escapeHtml(r.organization || "")}</td><td>${escapeHtml(r.email || "")}</td>
        <td>${escapeHtml(r.icp_name || "—")}</td>
        <td class="${cls}">${r.score ?? 0}</td>
        <td class="${cls}">${r.classification || ""}</td>
      </tr>`;
    })
    .join("");
  await refreshStatusBar();
}

function collectContactForm() {
  return {
    name: document.getElementById("contact-name").value.trim(),
    job_title: document.getElementById("contact-title").value.trim(),
    email: document.getElementById("contact-email").value.trim(),
    linkedin: document.getElementById("contact-linkedin").value.trim(),
    organization: document.getElementById("contact-org").value.trim(),
    location: document.getElementById("contact-location").value.trim(),
    industry: document.getElementById("contact-industry").value.trim(),
  };
}

async function loadContact(id) {
  const data = await bridge.contacts.get(id);
  if (!data) return;

  contactId = id;
  document.getElementById("contact-name").value = data.name || "";
  document.getElementById("contact-title").value = data.job_title || "";
  document.getElementById("contact-email").value = data.email || "";
  document.getElementById("contact-linkedin").value = data.linkedin || "";
  document.getElementById("contact-org").value = data.organization || "";
  document.getElementById("contact-location").value = data.location || "";
  document.getElementById("contact-industry").value = data.organization_industry || "";

  const best = await bridge.contacts.bestMatch(id);
  setMatchDisplay(best);
}

function clearContactForm() {
  contactId = null;
  ["name", "title", "email", "linkedin", "org", "location", "industry"].forEach((k) => {
    document.getElementById(`contact-${k}`).value = "";
  });
  setMatchDisplay(null);
}

async function addContact() {
  const name = document.getElementById("contact-name").value.trim();
  if (!name) {
    await showModal("Contacto", "El nombre es obligatorio.");
    return;
  }

  const activeIcps = await bridge.icps.listActive();
  if (!activeIcps.length) {
    await showModal("Contacto", "No hay ICPs activos definidos. Creá al menos uno en ICP Definition.");
    return;
  }

  const data = collectContactForm();
  let contact;
  try {
    contact = await bridge.contacts.add(data);
  } catch (e) {
    await showModal("SQLite", `No se pudo guardar el contacto:\n\n${e.message}`);
    return;
  }

  const best = await bridge.contacts.evaluate(contact.id);

  clearContactForm();
  await refreshContacts();
  await refreshResults();

  if (best) {
    await showModal(
      "AETHERYON",
      `Contacto agregado.\n\nMejor match: ${best.icp_name}\nScore: ${best.score} · Clase ${best.classification}\n\n${best.evidence}`
    );
  } else {
    await showModal("AETHERYON", "Contacto agregado.");
  }
}

async function updateContact() {
  if (!contactId) {
    await showModal("Contacto", "Primero hacé doble click sobre un contacto.");
    return;
  }

  const name = document.getElementById("contact-name").value.trim();
  if (!name) {
    await showModal("Contacto", "El nombre es obligatorio.");
    return;
  }

  const data = collectContactForm();
  try {
    await bridge.contacts.update(contactId, data);
  } catch (e) {
    await showModal("SQLite", `No se pudo actualizar:\n\n${e.message}`);
    return;
  }

  const best = await bridge.contacts.evaluate(contactId);
  const updatedId = contactId;

  clearContactForm();
  await refreshContacts();
  await refreshResults();

  if (best) {
    await showModal(
      "AETHERYON",
      `Contacto #${updatedId} actualizado.\n\nMejor match: ${best.icp_name}\nScore: ${best.score} · Clase ${best.classification}`
    );
  } else {
    await showModal("AETHERYON", `Contacto #${updatedId} actualizado.`);
  }
}

async function reevaluateSelectedContact() {
  if (!selectedContactRow) {
    await showModal("ICP Engine", "Seleccioná un contacto.");
    return;
  }

  const id = Number(selectedContactRow);
  const best = await bridge.contacts.evaluate(id);

  await refreshContacts();
  await refreshResults();

  if (!best) {
    await showModal("ICP Engine", "No hay ICPs activos para evaluar.");
    return;
  }

  if (contactId === id) {
    const fullBest = await bridge.contacts.bestMatch(id);
    setMatchDisplay(fullBest);
  }

  await showModal(
    "ICP Engine",
    `Mejor match: ${best.icp_name}\nScore: ${best.score} · Clase ${best.classification}\n\nEvidence:\n${best.evidence}`
  );
}

// ============================================================
// PIPELINE -- Cierre & Seguimiento
// ============================================================

async function refreshPipeline() {
  const rows = await bridge.pipeline.list();
  const tbody = document.querySelector("#pipeline-table tbody");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr data-id="${r.id}">
        <td>${r.id}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.organization || "—")}</td>
        <td class="${STAGE_CLASS[r.stage] || ""}">${escapeHtml(r.stage)}</td>
        <td>${escapeHtml(r.next_follow_up || "—")}</td>
        <td>${r.score ?? "—"}</td><td>${r.classification || "—"}</td>
      </tr>`
    )
    .join("");
  await refreshStatusBar();
}

async function loadDeal(id) {
  const contactIdArg = Number(id);
  dealContactId = contactIdArg;

  const contact = await bridge.contacts.get(contactIdArg);
  document.getElementById("deal-contact-label").textContent = contact.organization
    ? `${contact.name} · ${contact.organization}`
    : contact.name;

  const deal = await bridge.deals.get(contactIdArg);
  document.getElementById("deal-stage").value = deal ? deal.stage : "Prospecting";
  document.getElementById("deal-follow-up").value = deal ? deal.next_follow_up || "" : "";
  document.getElementById("deal-notes").value = deal ? deal.notes || "" : "";

  const best = await bridge.contacts.bestMatch(contactIdArg);
  const rec = document.getElementById("deal-recommendation");
  if (best) {
    const pains = best.pains.length ? best.pains.join(", ") : "—";
    const offerings = best.offerings.length ? best.offerings.join(", ") : "—";
    rec.textContent = `Mejor ICP: ${best.icp_name} (${best.score}/100 · Clase ${best.classification})   ·   Pains: ${pains}   ·   Propuesta sugerida: ${offerings}`;
  } else {
    rec.textContent = "Este contacto todavía no fue evaluado contra ningún ICP.";
  }
}

function clearDealForm() {
  dealContactId = null;
  document.getElementById("deal-contact-label").textContent = "Seleccioná un contacto en la tabla ↓";
  document.getElementById("deal-stage").value = "Prospecting";
  document.getElementById("deal-follow-up").value = "";
  document.getElementById("deal-notes").value = "";
  document.getElementById("deal-recommendation").textContent = "";
}

async function saveDeal() {
  if (!dealContactId) {
    await showModal("Pipeline", "Seleccioná un contacto en la tabla antes de guardar.");
    return;
  }

  await bridge.deals.save({
    contact_id: dealContactId,
    stage: document.getElementById("deal-stage").value,
    next_follow_up: document.getElementById("deal-follow-up").value.trim(),
    notes: document.getElementById("deal-notes").value.trim(),
  });

  await refreshPipeline();
  await showModal("AETHERYON", "Deal actualizado.");
}

// ============================================================
// INTELLIGENCE
// ============================================================

async function refreshResults() {
  const rows = await bridge.results.list();
  const tbody = document.querySelector("#results-table tbody");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.contact)}</td><td>${escapeHtml(r.job_title || "")}</td><td>${escapeHtml(r.company || "")}</td>
        <td>${escapeHtml(r.icp)}</td>
        <td class="class-${r.classification}">${r.score}</td><td class="class-${r.classification}">${r.classification}</td>
        <td>${escapeHtml(r.evidence)}</td>
      </tr>`
    )
    .join("");
  await refreshStatusBar();
}

async function recalcAll() {
  const activeIcps = await bridge.icps.listActive();
  if (!activeIcps.length) {
    await showModal("ICP Engine", "No hay ICPs activos para evaluar.");
    return;
  }

  const result = await bridge.contacts.recalcAll();
  await refreshContacts();
  await refreshResults();
  await showModal("AETHERYON", `${result.count} contactos reevaluados contra todos los ICPs activos.`);
}

// ============================================================
// STATUS BAR
// ============================================================

async function refreshStatusBar() {
  const s = await bridge.status.counts();
  document.getElementById("status-text").textContent =
    `Offerings: ${s.offerings}    ·    Pains: ${s.pains}    ·    ICPs activos: ${s.activeIcps}` +
    `    ·    Contactos: ${s.contacts}    ·    Deals abiertos: ${s.openDeals}    ·    Evaluaciones: ${s.evaluations}`;
}

// ============================================================
// WIRING + BOOT
// ============================================================

function wireEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("offering-new").onclick = clearOfferingForm;
  document.getElementById("offering-save").onclick = saveOffering;
  document.getElementById("offering-delete").onclick = deleteOffering;

  document.getElementById("pain-new").onclick = clearPainForm;
  document.getElementById("pain-save").onclick = savePain;
  document.getElementById("pain-delete").onclick = deletePain;

  document.getElementById("icp-new").onclick = clearIcpForm;
  document.getElementById("icp-save").onclick = saveIcp;
  document.getElementById("icp-delete").onclick = deleteIcp;

  document.getElementById("contact-new").onclick = clearContactForm;
  document.getElementById("contact-add").onclick = addContact;
  document.getElementById("contact-update").onclick = updateContact;
  document.getElementById("contact-reevaluate").onclick = reevaluateSelectedContact;

  document.getElementById("deal-save").onclick = saveDeal;
  document.getElementById("deal-clear").onclick = clearDealForm;

  document.getElementById("recalc-all").onclick = recalcAll;
  document.getElementById("refresh-intelligence").onclick = refreshResults;

  wireTableSelection("offering-table", (id) => (selectedOfferingRow = id), (id) => loadOffering(Number(id)));
  wireTableSelection("pain-table", (id) => (selectedPainRow = id), (id) => loadPain(Number(id)));
  wireTableSelection("icp-table", (id) => (selectedIcpRow = id), (id) => loadIcp(Number(id)));
  wireTableSelection("contact-table", (id) => (selectedContactRow = id), (id) => loadContact(Number(id)));
  wireTableSelection("pipeline-table", () => {}, (id) => loadDeal(id));

  window.addEventListener("resize", () => updateWeightTotal());
}

window.addEventListener("DOMContentLoaded", async () => {
  buildWeightGrid();
  wireEvents();

  await refreshPainChoices();
  await refreshOfferings();
  await refreshPains();
  await refreshIcps();
  await refreshContacts();
  await refreshPipeline();
  await refreshResults();
  await refreshStatusBar();
});
