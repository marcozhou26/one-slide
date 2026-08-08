export class SourceFidelityError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function requireCondition(condition, code, message) {
  if (!condition) throw new SourceFidelityError(code, message);
}

export function buildAnchorMap(sourceAnchors) {
  requireCondition(
    Array.isArray(sourceAnchors) && sourceAnchors.length > 0,
    "SOURCE_BASELINE_FAIL",
    "Source anchors are required",
  );
  const anchors = new Map();
  for (const anchor of sourceAnchors) {
    requireCondition(
      typeof anchor?.id === "string" &&
        typeof anchor?.text === "string" &&
        anchor.text.length > 0,
      "SOURCE_BASELINE_FAIL",
      "Every source anchor needs a non-empty id and text",
    );
    requireCondition(
      !anchors.has(anchor.id),
      "SOURCE_BASELINE_FAIL",
      `Duplicate source anchor: ${anchor.id}`,
    );
    anchors.set(anchor.id, anchor.text);
  }
  return anchors;
}

export function isExactSourceSubstring(text, sourceIds, anchors) {
  if (text === "To be supplemented by customers") return true;
  return (sourceIds ?? []).some((id) => anchors.get(id)?.includes(text));
}

export function validateVisibleText(item, anchors, label) {
  requireCondition(
    typeof item?.text === "string" && item.text.length > 0,
    "SOURCE_FIDELITY_FAIL",
    `${label} text is required`,
  );
  requireCondition(
    isExactSourceSubstring(item.text, item.source_ids, anchors),
    "SOURCE_FIDELITY_FAIL",
    `${label} is not an exact source substring`,
  );
}

export function validateTitle(title, anchors) {
  requireCondition(
    title?.origin === "source" || title?.origin === "placeholder",
    "SOURCE_FIDELITY_FAIL",
    "Title origin must be source or placeholder",
  );
  if (title.origin === "placeholder") {
    requireCondition(
      title.text === "To be supplemented by customers",
      "SOURCE_FIDELITY_FAIL",
      "Placeholder title must use To be supplemented by customers",
    );
  } else {
    validateVisibleText(title, anchors, "Title");
  }
}

export function validateAllAnchorsMapped(sourceAnchors, mappedIds) {
  const mapped = new Set(mappedIds);
  const missing = sourceAnchors
    .map((anchor) => anchor.id)
    .filter((id) => !mapped.has(id));
  requireCondition(
    missing.length === 0,
    "CONTENT_MAPPING_FAIL",
    `Unmapped source anchors: ${missing.join(", ")}`,
  );
  return { mappedSourceIds: [...mapped].sort(), unmappedSourceIds: [] };
}
