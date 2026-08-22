import { SLIDE } from "./layout_constants.mjs";
import { validateReferenceList } from "./validate_reference_list.mjs";

export function planReferenceList(data) {
  const normalized = validateReferenceList(data).normalized;
  const count = normalized.diagram.references.length;
  const listTop = normalized.subtitle ? 124 : 104;
  const listBottom = 628;
  const entryHeight = Math.floor((listBottom - listTop) / count);
  return {
    normalized,
    slide: SLIDE,
    title: { ...normalized.title, left: 54, top: 28, width: 1172, height: 52 },
    subtitle: normalized.subtitle ? { ...normalized.subtitle, left: 54, top: 82, width: 1172, height: 26 } : null,
    list: { left: 54, top: listTop, width: 1172, height: listBottom - listTop, entryHeight },
    footer: { left: 54, top: 646, width: 1172, height: 30 },
  };
}
