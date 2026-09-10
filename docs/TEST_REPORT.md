# Test Report · ICP & Search Definition

## Static validation
- `src/db.js`: Node syntax check PASS.
- `renderer/app.js`: Node syntax check PASS.
- Renderer ID/reference consistency: PASS. Only dynamically-created modal IDs are absent from static HTML, by design.

## Database validation
The full schema was executed against SQLite using the Python SQLite engine.
- `search_configurations` table creation: PASS.
- Foreign keys to `icps` and `offerings`: PASS at schema level.
- Insert configuration: PASS.
- Read configuration: PASS.
- Update configuration: PASS.
- Delete configuration: PASS.
- Multi-value filters persist as JSON arrays: PASS.

## Runtime note
The supplied `node_modules` contains a native `better_sqlite3.node` built for Windows, while this validation environment is Linux. Therefore the Electron runtime itself was not launched here. The application source was syntax-checked and the new SQL contract was exercised independently with SQLite.

## Manual acceptance test
1. Start the application with `npm install` / existing project dependencies.
2. Open **2 · ICP & Search**.
3. Create an ICP with weights totaling 100.
4. Add an existing pain and create one inline.
5. Save the ICP.
6. Create `APOLLO-001 / Growth + Technical Pain`.
7. Set Argentina, 11-50 / 51-200 / 201-500, C-Suite / VP / Head / Director, CTO/CIO/COO and target industries.
8. Add exclusions and pain signals.
9. Link the Search Configuration to the ICP and an Offering.
10. Save, double-click the row, verify every field reloads.
11. Duplicate it and verify a new unique code.
12. Delete the duplicate.
13. Re-evaluate contacts and verify the existing ICP scoring remains functional.

## Scope boundary
No Apollo API calls were introduced in this phase. The app now has the data model and UI required to implement a provider adapter safely in a later phase.
