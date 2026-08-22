#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const assetRoot = path.resolve(scriptDir, "../assets/icons/tabler");

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_/-]+/g, "");
}

function scoreText(query, concept, synonyms) {
  const q = normalize(query);
  const terms = [concept, ...synonyms].map(normalize).filter(Boolean);
  if (!q) return 0;
  if (terms.includes(q)) return 100;
  if (terms.some((term) => q.includes(term) || term.includes(q))) return 75;
  return Math.max(0, ...terms.map((term) => [...q].filter((character) => term.includes(character)).length / Math.max(q.length, term.length) * 40));
}

export async function resolveSemanticIcon(request, root = assetRoot) {
  const aliases = JSON.parse(await fs.readFile(path.join(root, "aliases.zh-CN.json"), "utf8"));
  const registry = JSON.parse(await fs.readFile(path.join(root, "registry.json"), "utf8"));
  const role = request?.role ?? "object_identifier";
  const requestedStyle = request?.style ?? aliases.default_style ?? "outline";
  if (!aliases.allowed_roles.includes(role) || aliases.blocked_roles.includes(role)) {
    return { status: "NO_ICON", reason: "ICON_ROLE_NOT_ALLOWED", role, candidates: [] };
  }
  const query = request?.concept ?? request?.query ?? "";
  const requestedIconId = request?.icon_id ?? null;
  const scoredConcepts = Object.entries(aliases.concepts)
    .map(([concept, entry]) => ({ concept, entry, score: scoreText(query, concept, entry.synonyms ?? []) }))
    .filter((item) => item.score >= 40)
    .sort((left, right) => right.score - left.score || left.concept.localeCompare(right.concept, "zh-CN"));
  if (!scoredConcepts.length) return { status: "NO_ICON", reason: "NO_SEMANTIC_MATCH", role, query, candidates: [] };

  const candidates = [];
  for (const match of scoredConcepts.slice(0, 4)) {
    match.entry.icons.forEach((iconId, preferenceIndex) => {
      const icon = registry.icons[iconId];
      if (!icon) return;
      const style = icon.styles[requestedStyle] ? requestedStyle : icon.styles.outline ? "outline" : Object.keys(icon.styles)[0];
      if (!style) return;
      candidates.push({
        icon_id: iconId,
        style,
        asset_path: icon.styles[style],
        asset_file: path.join(root, icon.styles[style]),
        matched_concept: match.concept,
        score: Math.round(match.score - preferenceIndex * 3),
        match_basis: match.score === 100 ? "exact_or_synonym" : "partial_semantic_match",
      });
    });
  }
  const deduped = [...new Map(candidates.sort((a, b) => b.score - a.score || a.icon_id.localeCompare(b.icon_id)).map((item) => [item.icon_id, item])).values()].slice(0, request?.limit ?? 5);
  if (!deduped.length) return { status: "NO_ICON", reason: "NO_ASSET_AVAILABLE", role, query, candidates: [] };
  if (requestedIconId && !registry.icons[requestedIconId]) {
    return { status: "NO_ICON", reason: "ICON_NOT_IN_WHITELIST", role, query, requested_icon_id: requestedIconId, candidates: deduped };
  }
  if (requestedIconId && !deduped.some((candidate) => candidate.icon_id === requestedIconId)) {
    return { status: "NO_ICON", reason: "ICON_SEMANTIC_MISMATCH", role, query, requested_icon_id: requestedIconId, candidates: deduped };
  }
  const selected = requestedIconId ? deduped.find((candidate) => candidate.icon_id === requestedIconId) : deduped[0];
  return {
    status: "ready",
    query,
    role,
    selected,
    candidates: deduped,
    selection_policy: "semantic whitelist candidate; Builder must still confirm that an icon lowers recognition cost and does not act as decoration or business emphasis",
  };
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node builder/scripts/resolve_semantic_icon.mjs '<json-or-concept>'");
  const request = input.trim().startsWith("{") ? JSON.parse(input) : { concept: input };
  process.stdout.write(`${JSON.stringify(await resolveSemanticIcon(request), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "fail", reason: error.message })}\n`);
    process.exitCode = 1;
  });
}
