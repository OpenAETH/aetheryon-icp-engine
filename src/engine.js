"use strict";

/**
 * ICPEngine -- port 1:1 de la logica de matching de la version Python.
 * Funciones puras, sin dependencias de Electron ni de la base de datos.
 */

function normalize(value) {
  if (!value) return "";
  return String(value).toLowerCase().trim().split(/\s+/).join(" ");
}

function tokens(value) {
  let v = normalize(value);
  if (!v) return [];
  for (const separator of [",", ";", "\n", "|"]) {
    v = v.split(separator).join(",");
  }
  return v
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function containsMatch(value, criteria) {
  const v = normalize(value);
  if (!v) return false;
  return tokens(criteria).some((token) => v.includes(token));
}

/**
 * contact: fila de contacts + alias organization/organization_industry/organization_location.
 * organization: {name, industry, location} o null.
 * icp: fila de icps.
 */
function evaluate(contact, organization, icp) {
  let score = 0;
  const evidence = [];

  if (containsMatch(contact.job_title, icp.job_titles)) {
    score += icp.weight_title;
    evidence.push(`Job Title +${icp.weight_title}`);
  }

  if (organization && containsMatch(organization.name, icp.companies)) {
    score += icp.weight_company;
    evidence.push(`Company +${icp.weight_company}`);
  }

  const location = contact.location || (organization ? organization.location : "") || "";
  if (containsMatch(location, icp.locations)) {
    score += icp.weight_location;
    evidence.push(`Location +${icp.weight_location}`);
  }

  const industry = organization ? organization.industry || "" : "";
  if (containsMatch(industry, icp.industries)) {
    score += icp.weight_industry;
    evidence.push(`Industry +${icp.weight_industry}`);
  }

  const keywordSource = normalize(
    [
      contact.name,
      contact.job_title,
      organization ? organization.name : "",
      organization ? organization.industry : "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  const keywordMatches = tokens(icp.keywords).filter((keyword) => keywordSource.includes(keyword));
  if (keywordMatches.length) {
    score += icp.weight_keywords;
    evidence.push(`Keywords +${icp.weight_keywords} (${keywordMatches.join(", ")})`);
  }

  let classification;
  if (score >= 80) classification = "A";
  else if (score >= 60) classification = "B";
  else if (score >= 40) classification = "C";
  else classification = "D";

  return {
    score: Math.min(score, 100),
    classification,
    evidence: evidence.length ? evidence.join(" · ") : "No significant matches",
  };
}

module.exports = { normalize, tokens, containsMatch, evaluate };
