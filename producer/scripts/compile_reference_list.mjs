import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const fail = (condition, code, message) => {
  if (!condition) throw Object.assign(new Error(message), { code });
};
const clean = (value) => typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : null;
const unique = (values) => [...new Set(values.filter(Boolean))];

function canonicalKey(citation) {
  const doi = clean(citation?.doi)?.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
  if (doi) return `doi:${doi}`;
  const url = clean(citation?.url)?.toLowerCase().replace(/\/$/, "");
  if (url) return `url:${url}`;
  const title = clean(citation?.title)?.toLowerCase();
  const author = clean(citation?.author ?? citation?.organization)?.toLowerCase();
  const date = clean(citation?.date ?? citation?.year)?.toLowerCase();
  if (title && (author || date)) return `work:${author ?? ""}:${title}:${date ?? ""}`;
  return null;
}

function citationText(citation) {
  const lead = clean(citation.author ?? citation.organization);
  const title = clean(citation.title);
  const publisher = clean(citation.publisher);
  const date = clean(citation.date ?? citation.year);
  return [lead, title ? `《${title.replace(/^《|》$/g, "")}》` : null, publisher, date].filter(Boolean).join("，");
}

function locatorText(citation) {
  if (clean(citation.doi)) return `DOI：${clean(citation.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}`;
  if (clean(citation.url)) return clean(citation.url);
  if (clean(citation.stable_id)) return clean(citation.stable_id);
  if (clean(citation.file_name)) return path.basename(clean(citation.file_name));
  return null;
}

export function compileReferenceList(bundle) {
  fail(bundle && typeof bundle === "object" && !Array.isArray(bundle), "INPUT_CONTRACT_FAIL", "Reference bundle must be an object");
  fail(Array.isArray(bundle.ledgers) && bundle.ledgers.length > 0, "SOURCE_BASELINE_FAIL", "At least one provenance ledger is required");
  const merged = new Map();
  const anchorText = new Map();
  let citableCount = 0;
  bundle.ledgers.forEach((ledger, ledgerIndex) => {
    const entries = Array.isArray(ledger.entries) ? ledger.entries : ledger?.provenance?.entries;
    fail(Array.isArray(entries), "INPUT_CONTRACT_FAIL", `Ledger ${ledgerIndex + 1} must contain entries`);
    const pageLabel = clean(ledger.page_label);
    entries.forEach((entry) => {
      const citation = entry?.citation;
      const eligible = entry?.kind === "externally_verified" || (entry?.kind === "user_supplied" && citation);
      if (!eligible) return;
      citableCount += 1;
      fail(citation && typeof citation === "object", "REFERENCE_METADATA_FAIL", `Source ${entry.source_id ?? "unknown"} lacks citation metadata`);
      fail(clean(citation.title), "REFERENCE_METADATA_FAIL", `Source ${entry.source_id ?? "unknown"} lacks a citation title`);
      const locator = locatorText(citation);
      fail(locator, "REFERENCE_METADATA_FAIL", `Source ${entry.source_id ?? "unknown"} lacks a URL, DOI, stable ID or clean file name`);
      const key = canonicalKey(citation);
      fail(key, "REFERENCE_METADATA_FAIL", `Source ${entry.source_id ?? "unknown"} cannot be deduplicated safely`);
      fail(clean(entry.source_id), "SOURCE_FIDELITY_FAIL", "Every cited source needs a source_id");
      anchorText.set(entry.source_id, [clean(entry.statement), citationText(citation), locator].filter(Boolean).join("；"));
      const existing = merged.get(key) ?? { id: `REF${String(merged.size + 1).padStart(2, "0")}`, canonical_key: key, citation: citationText(citation), locator, source_ids: [], supporting_pages: [] };
      existing.source_ids = unique([...existing.source_ids, entry.source_id]);
      existing.supporting_pages = unique([...existing.supporting_pages, pageLabel]);
      merged.set(key, existing);
    });
  });
  fail(citableCount > 0, "SOURCE_BASELINE_FAIL", "No citable externally verified or user-supplied sources were found");
  const references = [...merged.values()];
  fail(references.length >= 2, "DATA_CONTRACT_FAIL", "Reference list needs at least 2 unique actual sources");
  fail(references.length <= 8, "SINGLE_SLIDE_SCOPE_OVERLOAD", "More than 8 unique sources need another one-page run or a narrower scope");
  const titleText = clean(bundle.title) ?? "引用资料";
  const subtitleText = clean(bundle.subtitle) ?? `共 ${references.length} 项，按首次出现顺序排列`;
  const noteText = clean(bundle.source_note) ?? "仅列实际使用并具有可核验定位信息的资料";
  anchorText.set("D99", `${titleText}；${subtitleText}；${noteText}`);
  return {
    version: "1.0",
    module_id: "reference-list",
    source_anchors: [...anchorText].map(([id, text]) => ({ id, text })),
    title: { text: titleText, origin: "source", source_ids: ["D99"] },
    subtitle: { text: subtitleText, source_ids: ["D99"] },
    diagram: {
      type: "reference-list",
      references: references.map((reference) => ({
        ...reference,
        citation: { text: reference.citation, source_ids: reference.source_ids },
        locator: { text: reference.locator, source_ids: reference.source_ids },
      })),
      source_note: { text: noteText, source_ids: ["D99"] },
    },
  };
}

export async function loadReferenceBundle(inputPath) {
  return JSON.parse(await fs.readFile(inputPath, "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  try {
    if (!inputPath) throw new Error("Usage: compile_reference_list.mjs <bundle.json> [output.json]");
    const payload = compileReferenceList(await loadReferenceBundle(inputPath));
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    if (outputPath) await fs.writeFile(outputPath, serialized);
    else process.stdout.write(serialized);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "REFERENCE_LIST_COMPILE_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
