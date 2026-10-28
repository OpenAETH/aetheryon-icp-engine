# AETHERYON ICP Engine · Implementation Phases

## Phase 1 · ICP Definition
**Objective:** define the ideal customer profile without mixing acquisition filters with scoring.

Functional scope:
- ICP identity: name, status, description.
- ICP criteria: job titles, companies, locations, industries, keywords, notes.
- Existing weighted evaluation model preserved at 100 points.
- ICP-to-Pain relationship preserved.
- Existing ICP CRUD remains operational.

Acceptance:
- An ICP can be created, edited, selected and deleted.
- Weight total must equal 100.
- Existing contact scoring continues to use the same engine.

## Phase 2 · Pain Catalog
**Objective:** make pains reusable commercial signals.

Functional scope:
- Pain catalog remains normalized in `pains`.
- Offerings and ICPs keep relational links to pains.
- Offering and ICP forms now expose pains as removable chips.
- Existing pains can be selected from a controlled picker.
- A new pain can be created inline and immediately linked.

Acceptance:
- Create a pain from the Proposal area.
- Add/remove pains from an Offering without editing raw IDs.
- Add/remove pains from an ICP without editing raw IDs.
- Existing relationships survive edits.

## Phase 3 · Search Configuration
**Objective:** represent the actual prospecting recipe separately from ICP evaluation.

Functional scope:
- New `search_configurations` entity.
- One ICP may have multiple search recipes.
- Apollo is modeled as an acquisition platform, not as the ICP itself.
- Person filters: location, seniority, job titles.
- Company filters: size, industries.
- Exclusions.
- Pain signals.
- Optional Offering link.
- Status and notes.
- CRUD + duplicate action.

Acceptance:
- Create `APOLLO-001`.
- Link it to an ICP and an Offering.
- Store multi-value filters as structured JSON arrays.
- Reload the configuration and recover all filters.
- Duplicate creates a new unique code.
- Delete removes only the configuration.

## Phase 4 · Acquisition-Ready Architecture
**Objective:** prepare the model for Apollo/LeadForge execution without coupling the current desktop app to either provider.

Current state:
- Apollo and LeadForge are represented as independent acquisition channels.
- Search Configuration is the abstraction between ICP and acquisition.
- No provider API is called yet.
- No CRM behavior is introduced into the ICP engine.

Next integration boundary:
`ICP → Search Configuration → Acquisition Adapter → Leads → ICP Scoring → Offering`

This keeps provider-specific API logic out of the ICP definition and evaluation engine.

---

_AETHERYON Systems · [aetheryon.onrender.com](https://aetheryon.onrender.com) · Guido Miguel Gómez — Specific Consultant · Consultor Específico_
