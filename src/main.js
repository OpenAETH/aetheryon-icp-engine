"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const db = require("./db");
const engine = require("./engine");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: "#07070F",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath("userData"), "aetheryon_icp.db");
  db.init(dbPath);

  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ============================================================
// MATCHING ENGINE -- orquesta db.js + engine.js
// ============================================================

function evaluateAndStoreAll(contactId) {
  const contact = db.getContactRaw(contactId);
  if (!contact) return null;

  const organization = contact.organization_id
    ? {
        name: contact.organization,
        industry: contact.organization_industry,
        location: contact.organization_location,
      }
    : null;

  const icps = db.listActiveIcps();
  if (!icps.length) return null;

  const results = icps.map((icp) => ({ icp, result: engine.evaluate(contact, organization, icp) }));
  db.storeContactIcpResults(contactId, results);

  let best = null;
  for (const { icp, result } of results) {
    if (!best || result.score > best.score) {
      best = { ...result, icp_id: icp.id, icp_name: icp.name };
    }
  }
  return best;
}

function recalcAll() {
  const contactIds = db.listAllContactIds();
  for (const id of contactIds) evaluateAndStoreAll(id);
  return { count: contactIds.length };
}

function getBestMatchWithRecommendation(contactId) {
  const best = db.getBestIcpForContact(contactId);
  if (!best) return null;
  const { pains, offerings } = db.getRecommendationForIcp(best.icp_id);
  return { ...best, pains, offerings };
}

// ============================================================
// IPC
// ============================================================

function registerIpc() {
  // Offerings
  ipcMain.handle("offerings:list", () => db.listOfferings());
  ipcMain.handle("offerings:get", (e, id) => db.getOffering(id));
  ipcMain.handle("offerings:save", (e, data) => db.saveOffering(data));
  ipcMain.handle("offerings:delete", (e, id) => db.deleteOffering(id));

  // Pains
  ipcMain.handle("pains:list", () => db.listPains());
  ipcMain.handle("pains:listWithCounts", () => db.listPainsWithCounts());
  ipcMain.handle("pains:get", (e, id) => db.getPain(id));
  ipcMain.handle("pains:save", (e, data) => db.savePain(data));
  ipcMain.handle("pains:delete", (e, id) => db.deletePain(id));

  // ICPs
  ipcMain.handle("icps:list", () => db.listIcps());
  ipcMain.handle("icps:listActive", () => db.listActiveIcps());
  ipcMain.handle("icps:get", (e, id) => db.getIcpWithPains(id));
  ipcMain.handle("icps:save", (e, data) => db.saveIcp(data));
  ipcMain.handle("icps:delete", (e, id) => db.deleteIcp(id));

  // Search configurations
  ipcMain.handle("search-configurations:list", () => db.listSearchConfigurations());
  ipcMain.handle("search-configurations:get", (e, id) => db.getSearchConfiguration(id));
  ipcMain.handle("search-configurations:save", (e, data) => db.saveSearchConfiguration(data));
  ipcMain.handle("search-configurations:delete", (e, id) => db.deleteSearchConfiguration(id));

  // Contacts
  ipcMain.handle("contacts:list", () => db.listContactsWithBestMatch());
  ipcMain.handle("contacts:get", (e, id) => db.getContactRaw(id));
  ipcMain.handle("contacts:add", (e, data) => db.addContact(data));
  ipcMain.handle("contacts:update", (e, id, data) => db.updateContact(id, data));
  ipcMain.handle("contacts:evaluate", (e, id) => evaluateAndStoreAll(id));
  ipcMain.handle("contacts:recalcAll", () => recalcAll());
  ipcMain.handle("contacts:bestMatch", (e, id) => getBestMatchWithRecommendation(id));

  // Deals / Pipeline
  ipcMain.handle("deals:get", (e, contactId) => db.getDeal(contactId));
  ipcMain.handle("deals:save", (e, data) => db.saveDeal(data));
  ipcMain.handle("pipeline:list", () => db.listPipeline());

  // Intelligence
  ipcMain.handle("results:list", () => db.listResults());

  // Status bar
  ipcMain.handle("status:counts", () => db.statusCounts());
}
