"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function invoke(channel) {
  return (...args) => ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld("api", {
  offerings: {
    list: invoke("offerings:list"),
    get: invoke("offerings:get"),
    save: invoke("offerings:save"),
    delete: invoke("offerings:delete"),
  },
  pains: {
    list: invoke("pains:list"),
    listWithCounts: invoke("pains:listWithCounts"),
    get: invoke("pains:get"),
    save: invoke("pains:save"),
    delete: invoke("pains:delete"),
  },
  icps: {
    list: invoke("icps:list"),
    listActive: invoke("icps:listActive"),
    get: invoke("icps:get"),
    save: invoke("icps:save"),
    delete: invoke("icps:delete"),
  },
  contacts: {
    list: invoke("contacts:list"),
    get: invoke("contacts:get"),
    add: invoke("contacts:add"),
    update: invoke("contacts:update"),
    evaluate: invoke("contacts:evaluate"),
    recalcAll: invoke("contacts:recalcAll"),
    bestMatch: invoke("contacts:bestMatch"),
  },
  deals: {
    get: invoke("deals:get"),
    save: invoke("deals:save"),
  },
  pipeline: {
    list: invoke("pipeline:list"),
  },
  results: {
    list: invoke("results:list"),
  },
  status: {
    counts: invoke("status:counts"),
  },
});
