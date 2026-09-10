"use strict";

/**
 * Capa de datos -- AETHERYON ICP Segmentation Engine.
 * Port directo del schema y las queries de la version Python (sqlite3 -> better-sqlite3).
 * better-sqlite3 es sincrono: no hace falta async/await ni manejo de conexiones,
 * un solo objeto Database persiste durante toda la vida del proceso principal.
 */

const Database = require("better-sqlite3");

let db = null;

const WEIGHT_COLUMNS = [
  "weight_title",
  "weight_company",
  "weight_location",
  "weight_industry",
  "weight_keywords",
];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS icps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    job_titles TEXT,
    companies TEXT,
    locations TEXT,
    industries TEXT,
    keywords TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Active',
    weight_title INTEGER DEFAULT 30,
    weight_company INTEGER DEFAULT 15,
    weight_location INTEGER DEFAULT 15,
    weight_industry INTEGER DEFAULT 25,
    weight_keywords INTEGER DEFAULT 15,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    website TEXT,
    industry TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    name TEXT NOT NULL,
    job_title TEXT,
    email TEXT,
    linkedin TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contact_icps (
    contact_id INTEGER,
    icp_id INTEGER,
    score INTEGER DEFAULT 0,
    classification TEXT,
    evidence TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contact_id, icp_id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (icp_id) REFERENCES icps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offerings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'Producto',
    name TEXT NOT NULL,
    outcome TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL DEFAULT 'General',
    name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pain_offerings (
    pain_id INTEGER,
    offering_id INTEGER,
    PRIMARY KEY (pain_id, offering_id),
    FOREIGN KEY (pain_id) REFERENCES pains(id) ON DELETE CASCADE,
    FOREIGN KEY (offering_id) REFERENCES offerings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS icp_pains (
    icp_id INTEGER,
    pain_id INTEGER,
    PRIMARY KEY (icp_id, pain_id),
    FOREIGN KEY (icp_id) REFERENCES icps(id) ON DELETE CASCADE,
    FOREIGN KEY (pain_id) REFERENCES pains(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL UNIQUE,
    stage TEXT NOT NULL DEFAULT 'Prospecting',
    next_follow_up TEXT,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_icps_contact ON contact_icps(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_icps_icp ON contact_icps(icp_id);
CREATE INDEX IF NOT EXISTS idx_icps_status ON icps(status);
CREATE INDEX IF NOT EXISTS idx_pain_offerings_offering ON pain_offerings(offering_id);
CREATE INDEX IF NOT EXISTS idx_icp_pains_pain ON icp_pains(pain_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
`;

function init(dbPath) {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
}

// ============================================================
// OFFERINGS
// ============================================================

function listOfferings() {
  return db
    .prepare(
      `SELECT o.id, o.kind, o.name, o.outcome, COUNT(po.pain_id) pains_count
       FROM offerings o
       LEFT JOIN pain_offerings po ON po.offering_id = o.id
       GROUP BY o.id
       ORDER BY o.kind, o.name`
    )
    .all();
}

function getOffering(id) {
  const row = db.prepare("SELECT * FROM offerings WHERE id = ?").get(id);
  if (!row) return null;
  const painIds = db
    .prepare("SELECT pain_id FROM pain_offerings WHERE offering_id = ?")
    .all(id)
    .map((r) => r.pain_id);
  return { ...row, pain_ids: painIds };
}

function saveOffering(data) {
  const tx = db.transaction((data) => {
    let offeringId = data.id;
    if (offeringId) {
      db.prepare("UPDATE offerings SET kind=?, name=?, outcome=?, notes=? WHERE id=?").run(
        data.kind,
        data.name,
        data.outcome,
        data.notes,
        offeringId
      );
    } else {
      const info = db
        .prepare("INSERT INTO offerings(kind, name, outcome, notes) VALUES (?,?,?,?)")
        .run(data.kind, data.name, data.outcome, data.notes);
      offeringId = info.lastInsertRowid;
    }

    db.prepare("DELETE FROM pain_offerings WHERE offering_id=?").run(offeringId);
    const insertPain = db.prepare("INSERT INTO pain_offerings(pain_id, offering_id) VALUES (?, ?)");
    for (const pid of data.pain_ids || []) insertPain.run(pid, offeringId);

    return offeringId;
  });

  return tx(data);
}

function deleteOffering(id) {
  db.prepare("DELETE FROM offerings WHERE id = ?").run(id);
}

// ============================================================
// PAINS
// ============================================================

function listPains() {
  return db.prepare("SELECT id, category, name FROM pains ORDER BY category, name").all();
}

function listPainsWithCounts() {
  return db
    .prepare(
      `SELECT p.id, p.category, p.name, COUNT(po.offering_id) offerings_count
       FROM pains p
       LEFT JOIN pain_offerings po ON po.pain_id = p.id
       GROUP BY p.id
       ORDER BY p.category, p.name`
    )
    .all();
}

function getPain(id) {
  return db.prepare("SELECT * FROM pains WHERE id = ?").get(id);
}

function savePain(data) {
  if (data.id) {
    db.prepare("UPDATE pains SET category=?, name=?, notes=? WHERE id=?").run(
      data.category,
      data.name,
      data.notes,
      data.id
    );
    return data.id;
  }
  const info = db
    .prepare("INSERT INTO pains(category, name, notes) VALUES (?,?,?)")
    .run(data.category, data.name, data.notes);
  return info.lastInsertRowid;
}

function deletePain(id) {
  db.prepare("DELETE FROM pains WHERE id = ?").run(id);
}

// ============================================================
// ICPS
// ============================================================

function listIcps() {
  return db
    .prepare("SELECT id, name, industries, locations, job_titles, status FROM icps ORDER BY id DESC")
    .all();
}

function listActiveIcps() {
  return db.prepare("SELECT * FROM icps WHERE LOWER(TRIM(status)) = 'active' ORDER BY name").all();
}

function getIcpWithPains(id) {
  const row = db.prepare("SELECT * FROM icps WHERE id = ?").get(id);
  if (!row) return null;
  const painIds = db
    .prepare("SELECT pain_id FROM icp_pains WHERE icp_id = ?")
    .all(id)
    .map((r) => r.pain_id);
  return { ...row, pain_ids: painIds };
}

function saveIcp(data) {
  const total = WEIGHT_COLUMNS.reduce((sum, col) => sum + Number(data[col] || 0), 0);
  if (total !== 100) {
    throw new Error(`La suma de los pesos debe ser exactamente 100.\n\nTotal actual: ${total}`);
  }

  const tx = db.transaction((data) => {
    let icpId = data.id;
    const values = [
      data.name,
      data.description,
      data.job_titles,
      data.companies,
      data.locations,
      data.industries,
      data.keywords,
      data.notes,
      data.status || "Active",
      data.weight_title,
      data.weight_company,
      data.weight_location,
      data.weight_industry,
      data.weight_keywords,
    ];

    if (icpId) {
      db.prepare(
        `UPDATE icps SET
           name=?, description=?, job_titles=?, companies=?, locations=?,
           industries=?, keywords=?, notes=?, status=?,
           weight_title=?, weight_company=?, weight_location=?, weight_industry=?, weight_keywords=?
         WHERE id=?`
      ).run(...values, icpId);
    } else {
      const info = db
        .prepare(
          `INSERT INTO icps(
             name, description, job_titles, companies, locations, industries,
             keywords, notes, status,
             weight_title, weight_company, weight_location, weight_industry, weight_keywords
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(...values);
      icpId = info.lastInsertRowid;
    }

    db.prepare("DELETE FROM icp_pains WHERE icp_id=?").run(icpId);
    const insertPain = db.prepare("INSERT INTO icp_pains(icp_id, pain_id) VALUES (?, ?)");
    for (const pid of data.pain_ids || []) insertPain.run(icpId, pid);

    return icpId;
  });

  try {
    return tx(data);
  } catch (e) {
    if (String(e.message).includes("UNIQUE constraint failed")) {
      throw new Error("Ya existe un ICP con ese nombre.");
    }
    throw e;
  }
}

function deleteIcp(id) {
  db.prepare("DELETE FROM icps WHERE id = ?").run(id);
}

// ============================================================
// ORGANIZATIONS
// ============================================================

function upsertOrganization(name, location, industry) {
  if (!name) return null;

  db.prepare(
    `INSERT INTO organizations(name, location, industry)
     VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       location = CASE WHEN excluded.location <> '' THEN excluded.location ELSE organizations.location END,
       industry = CASE WHEN excluded.industry <> '' THEN excluded.industry ELSE organizations.industry END`
  ).run(name, location || "", industry || "");

  return db.prepare("SELECT id FROM organizations WHERE name=?").get(name).id;
}

// ============================================================
// CONTACTS
// ============================================================

function getContactRaw(id) {
  return db
    .prepare(
      `SELECT
         c.*,
         o.name organization,
         o.industry organization_industry,
         o.location organization_location
       FROM contacts c
       LEFT JOIN organizations o ON o.id = c.organization_id
       WHERE c.id = ?`
    )
    .get(id);
}

function addContact(data) {
  const tx = db.transaction((data) => {
    const orgId = upsertOrganization(data.organization, data.location, data.industry);
    const info = db
      .prepare(
        `INSERT INTO contacts(organization_id, name, job_title, email, linkedin, location)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(orgId, data.name, data.job_title, data.email, data.linkedin, data.location);
    return info.lastInsertRowid;
  });

  return { id: tx(data) };
}

function updateContact(id, data) {
  const tx = db.transaction((id, data) => {
    const orgId = upsertOrganization(data.organization, data.location, data.industry);
    db.prepare(
      `UPDATE contacts
       SET organization_id=?, name=?, job_title=?, email=?, linkedin=?, location=?
       WHERE id=?`
    ).run(orgId, data.name, data.job_title, data.email, data.linkedin, data.location, id);
  });

  tx(id, data);
  return { id };
}

function listContactsWithBestMatch() {
  return db
    .prepare(
      `SELECT
         c.id, c.name, c.job_title, o.name organization, c.email,
         best.icp_name, best.score, best.classification
       FROM contacts c
       LEFT JOIN organizations o ON o.id = c.organization_id
       LEFT JOIN (
         SELECT
           ci.contact_id, i.name icp_name, ci.score, ci.classification,
           ROW_NUMBER() OVER (PARTITION BY ci.contact_id ORDER BY ci.score DESC) rn
         FROM contact_icps ci
         JOIN icps i ON i.id = ci.icp_id
       ) best ON best.contact_id = c.id AND best.rn = 1
       ORDER BY best.score DESC, c.id DESC`
    )
    .all();
}

function listAllContactIds() {
  return db.prepare("SELECT id FROM contacts").all().map((r) => r.id);
}

function storeContactIcpResults(contactId, results) {
  const tx = db.transaction((contactId, results) => {
    const stmt = db.prepare(
      `INSERT INTO contact_icps(contact_id, icp_id, score, classification, evidence, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(contact_id, icp_id) DO UPDATE SET
         score=excluded.score,
         classification=excluded.classification,
         evidence=excluded.evidence,
         updated_at=CURRENT_TIMESTAMP`
    );
    for (const { icp, result } of results) {
      stmt.run(contactId, icp.id, result.score, result.classification, result.evidence);
    }
  });

  tx(contactId, results);
}

function getBestIcpForContact(contactId) {
  return db
    .prepare(
      `SELECT ci.icp_id, i.name icp_name, ci.score, ci.classification
       FROM contact_icps ci
       JOIN icps i ON i.id = ci.icp_id
       WHERE ci.contact_id = ?
       ORDER BY ci.score DESC
       LIMIT 1`
    )
    .get(contactId);
}

function getRecommendationForIcp(icpId) {
  if (!icpId) return { pains: [], offerings: [] };

  const pains = db
    .prepare(
      `SELECT p.name
       FROM icp_pains ip
       JOIN pains p ON p.id = ip.pain_id
       WHERE ip.icp_id = ?
       ORDER BY p.category, p.name`
    )
    .all(icpId)
    .map((r) => r.name);

  const offerings = db
    .prepare(
      `SELECT DISTINCT o.name
       FROM icp_pains ip
       JOIN pain_offerings po ON po.pain_id = ip.pain_id
       JOIN offerings o ON o.id = po.offering_id
       WHERE ip.icp_id = ?
       ORDER BY o.name`
    )
    .all(icpId)
    .map((r) => r.name);

  return { pains, offerings };
}

// ============================================================
// DEALS / PIPELINE
// ============================================================

function getDeal(contactId) {
  return db.prepare("SELECT * FROM deals WHERE contact_id = ?").get(contactId);
}

function saveDeal(data) {
  db.prepare(
    `INSERT INTO deals(contact_id, stage, next_follow_up, notes, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(contact_id) DO UPDATE SET
       stage=excluded.stage,
       next_follow_up=excluded.next_follow_up,
       notes=excluded.notes,
       updated_at=CURRENT_TIMESTAMP`
  ).run(data.contact_id, data.stage, data.next_follow_up, data.notes);
}

function listPipeline() {
  return db
    .prepare(
      `SELECT
         c.id, c.name, o.name organization,
         COALESCE(d.stage, 'Prospecting') stage,
         d.next_follow_up,
         best.score, best.classification
       FROM contacts c
       LEFT JOIN organizations o ON o.id = c.organization_id
       LEFT JOIN deals d ON d.contact_id = c.id
       LEFT JOIN (
         SELECT ci.contact_id, ci.score, ci.classification,
                ROW_NUMBER() OVER (PARTITION BY ci.contact_id ORDER BY ci.score DESC) rn
         FROM contact_icps ci
       ) best ON best.contact_id = c.id AND best.rn = 1
       ORDER BY
         CASE COALESCE(d.stage, 'Prospecting')
           WHEN 'Negociación' THEN 0
           WHEN 'Propuesta Enviada' THEN 1
           WHEN 'Contactado' THEN 2
           WHEN 'Prospecting' THEN 3
           WHEN 'Ganado' THEN 4
           WHEN 'Perdido' THEN 5
           ELSE 6
         END,
         best.score DESC`
    )
    .all();
}

// ============================================================
// INTELLIGENCE
// ============================================================

function listResults() {
  return db
    .prepare(
      `SELECT
         c.name contact, c.job_title, o.name company, i.name icp,
         ci.score, ci.classification, ci.evidence
       FROM contact_icps ci
       JOIN contacts c ON c.id = ci.contact_id
       JOIN icps i ON i.id = ci.icp_id
       LEFT JOIN organizations o ON o.id = c.organization_id
       ORDER BY ci.score DESC, c.name`
    )
    .all();
}

// ============================================================
// STATUS BAR
// ============================================================

function statusCounts() {
  const one = (sql) => db.prepare(sql).get().c;
  return {
    offerings: one("SELECT COUNT(*) c FROM offerings"),
    pains: one("SELECT COUNT(*) c FROM pains"),
    activeIcps: one("SELECT COUNT(*) c FROM icps WHERE LOWER(TRIM(status))='active'"),
    contacts: one("SELECT COUNT(*) c FROM contacts"),
    openDeals: one("SELECT COUNT(*) c FROM deals WHERE stage NOT IN ('Ganado','Perdido')"),
    evaluations: one("SELECT COUNT(*) c FROM contact_icps"),
  };
}

module.exports = {
  init,
  listOfferings,
  getOffering,
  saveOffering,
  deleteOffering,
  listPains,
  listPainsWithCounts,
  getPain,
  savePain,
  deletePain,
  listIcps,
  listActiveIcps,
  getIcpWithPains,
  saveIcp,
  deleteIcp,
  getContactRaw,
  addContact,
  updateContact,
  listContactsWithBestMatch,
  listAllContactIds,
  storeContactIcpResults,
  getBestIcpForContact,
  getRecommendationForIcp,
  getDeal,
  saveDeal,
  listPipeline,
  listResults,
  statusCounts,
};
