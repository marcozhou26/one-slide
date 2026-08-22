import { STRUCTURE_THEMES, validateStructurePage } from "./structure_page_common.mjs";
import { SLIDE } from "./layout_constants.mjs";

export function planStructurePage(data, expectedModule) {
  const normalized = validateStructurePage(data, expectedModule).normalized;
  const pageType = normalized.page_contract.page_type;
  return {
    normalized,
    slide: SLIDE,
    theme: STRUCTURE_THEMES[normalized.theme],
    pageType,
    content: { left: 78, top: 92, width: 1050, height: 520 },
    module_id: expectedModule,
  };
}
