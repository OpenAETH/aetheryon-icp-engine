# AETHERYON Systems · ICP Segmentation Engine (Electron)

Migración de la versión Tkinter/SQLite a Electron. Misma lógica de negocio,
mismo schema, misma UI (tema oscuro con la paleta AETHERYON).

Pipeline: **Propuesta → Pains → ICP & Search Definition → Acquisition → Entity Management → Pipeline → Intelligence**

## Setup

```bash
npm install
npm start
```

`npm install` baja `electron` (binario desde GitHub Releases) y `better-sqlite3`
(binding nativo). El `postinstall` corre automáticamente `electron-rebuild`
para recompilar `better-sqlite3` contra el ABI de Node que usa Electron —
si no se hiciera esto, la app tira `NODE_MODULE_VERSION mismatch` al arrancar,
porque Electron empaqueta su propio Node internamente y no coincide con el
Node del sistema. Ya está resuelto en `package.json`, no hace falta tocar nada.

Corré `npm install` en la máquina donde vas a usar la app; no copies
`node_modules` entre sistemas operativos distintos (el binding nativo de
`better-sqlite3` y el binario de Electron son específicos por plataforma).

## Estructura

```
src/
  main.js       proceso principal: crea la ventana, inicializa la DB, registra IPC
  preload.js    contextBridge -- expone window.api al renderer (contextIsolation activado)
  db.js         schema SQLite + queries (better-sqlite3, sincrono)
  engine.js      ICPEngine: normalize/tokens/containsMatch/evaluate (funciones puras)
renderer/
  index.html    shell de la app (5 tabs)
  styles.css    tema oscuro AETHERYON (teal #00E5C0 / gold #FFD166 / violet #B066FF)
  app.js        UI: tablas, formularios, wiring con window.api
```

## Dónde vive la base de datos

A diferencia de la versión Python (que guardaba `aetheryon_icp.db` al lado del
script), esta versión usa la carpeta estándar de datos de usuario de Electron
(`app.getPath('userData')`):

- Windows: `%APPDATA%\aetheryon-icp-engine\aetheryon_icp.db`
- Linux: `~/.config/aetheryon-icp-engine/aetheryon_icp.db`
- macOS: `~/Library/Application Support/aetheryon-icp-engine/aetheryon_icp.db`

Es el lugar correcto para una app empaquetada (sobrevive updates, no depende
de desde dónde se lanya el ejecutable). Si preferís tener la DB visible en la
carpeta del proyecto durante desarrollo, cambiá la línea en `src/main.js`:

```js
const dbPath = path.join(app.getPath("userData"), "aetheryon_icp.db");
```

por ejemplo a `path.join(__dirname, "..", "aetheryon_icp.db")`.

## Qué cambió respecto a la versión Python

- Misma base de datos SQLite (schema idéntico: `icps`, `organizations`,
  `contacts`, `contact_icps`, `offerings`, `pains`, `pain_offerings`,
  `icp_pains`, `deals`) — **no** son intercambiables automáticamente entre
  versiones porque cada una abre su propio archivo `.db` en una ubicación
  distinta; si querés reusar los datos de la versión Tkinter, copiá ese
  `aetheryon_icp.db` a la ruta de `userData` de arriba.
- `ICPEngine.evaluate` es un port línea por línea del Python: mismo algoritmo
  de normalización/tokenización por substring, mismos umbrales de
  clasificación (A ≥80, B ≥60, C ≥40, D resto).
- Los `messagebox` de Tkinter se reemplazan por un modal propio (`showModal`
  en `app.js`) con la misma semántica (info / warning / confirm).
- Selección de fila: un click resalta la fila (igual que `ttk.Treeview`),
  doble click carga el registro en el formulario.

## Empaquetar como instalador (opcional, no incluido)

Este proyecto corre con `npm start` sobre Electron en modo desarrollo. Para
generar un `.exe`/`.dmg`/`.AppImage` instalable hace falta agregar
`electron-builder` (o `electron-forge`) y su configuración de `build` en
`package.json` — no se incluyó acá para no atar el proyecto a una config de
firma/íconos que todavía no definiste.


## ICP & Search Definition

The ICP layer separates four concerns:

`Offering → Pain → ICP → Search Configuration`

Search Configuration stores acquisition recipes for platforms such as Apollo or LeadForge without coupling provider APIs to the ICP scoring engine. A single ICP can have multiple search configurations.

The current implementation includes:
- ICP definition and weighted evaluation.
- Reusable Pain catalog with inline creation.
- Search Configuration CRUD.
- Apollo People Search fields.
- Exclusions and Pain Signals.
- Optional ICP and Offering links.
- Configuration duplication.

Provider API integration is intentionally outside this phase.

---

## Autoría

**AETHERYON Systems** · [aetheryon.onrender.com](https://aetheryon.onrender.com)

**Guido Miguel Gómez** — Specific Consultant · Consultor Específico

© AETHERYON Systems. Todos los derechos reservados.
