import { planStructurePage } from "./plan_structure_page.mjs";
import { STRUCTURE_TYPE_SCALE } from "./structure_page_common.mjs";
import { toArtifactFontSize } from "./pptx_core.mjs";

const HEADING_BOTTOM = 96;
const BODY_BOTTOM = 620;
const OPTICAL_CENTER_Y = 390;

function findPeerComponent(components) {
  return components.find((item) => Array.isArray(item.items));
}

function declaredColumns(contract, componentId) {
  const group = contract.peer_groups.find((item) => item.component_id === componentId);
  return group?.layout_policy?.columns;
}

function resolveColumns(pageType, count, explicitColumns) {
  if (Number.isInteger(explicitColumns)) return explicitColumns;
  if (pageType === "agenda" || pageType === "numbered_recap") return 1;
  if (count <= 4) return 1;
  if (count <= 14) return 2;
  return 3;
}

function distributeColumnMajor(items, columns) {
  const rows = Math.ceil(items.length / columns);
  return items.map((item, index) => ({
    ...item,
    sourceIndex: index,
    column: Math.floor(index / rows),
    row: index % rows,
  }));
}

export function computeNavigationLayout(contract) {
  const component = findPeerComponent(contract.visible_components);
  const items = component?.items ?? [];
  const columns = resolveColumns(contract.page_type, items.length, declaredColumns(contract, component?.id));
  const placedItems = distributeColumnMajor(items, columns);
  const rows = Math.max(1, ...placedItems.map((item) => item.row + 1));
  const sparse = rows <= 4;
  const labelFontSize = columns === 1 ? (rows > 4 ? STRUCTURE_TYPE_SCALE.navigationLabelDense : STRUCTURE_TYPE_SCALE.navigationLabel) : STRUCTURE_TYPE_SCALE.navigationLabelCompact;
  const numberFontDeltaPt = Number(contract.layout_intent?.number_font_delta_pt ?? -3);
  const numberFontSize = labelFontSize + Math.max(-4, Math.min(-2, numberFontDeltaPt));
  const numberContainerHeightRatio = Number(contract.layout_intent?.number_container_height_ratio ?? 1.5);
  const badgeSize = Math.round(toArtifactFontSize(labelFontSize) * numberContainerHeightRatio * 10) / 10;
  const opticalLift = Math.round(toArtifactFontSize(labelFontSize) * 0.08 * 10) / 10;
  const itemHeight = columns === 1 ? 62 : 52;
  const gap = sparse ? 24 : columns === 1 ? 18 : 20;
  const pitch = itemHeight + gap;
  const groupHeight = rows * itemHeight + (rows - 1) * gap;
  const minimumHeadingGap = Math.max(40, Math.ceil(gap * 1.5));
  const minimumTop = HEADING_BOTTOM + minimumHeadingGap;
  const maximumTop = BODY_BOTTOM - groupHeight;
  const groupTop = Math.max(minimumTop, Math.min(OPTICAL_CENTER_Y - groupHeight / 2, maximumTop));

  const frameLeft = columns === 1 ? 116 : 58;
  const frameWidth = columns === 1 ? 862 : 1164;
  const columnGap = columns === 1 ? 0 : 40;
  const columnWidth = (frameWidth - columnGap * (columns - 1)) / columns;
  const labelOffset = badgeSize + (columns === 1 ? 46 : 18);

  return {
    componentId: component.id,
    columns,
    rows,
    sparse,
    itemHeight,
    badgeSize,
    labelFontSize,
    numberFontSize,
    numberContainerHeightRatio,
    opticalLift,
    gap,
    pitch,
    groupTop,
    groupHeight,
    groupCenter: groupTop + groupHeight / 2,
    minimumHeadingGap,
    items: placedItems.map((item) => {
      const left = frameLeft + item.column * (columnWidth + columnGap);
      return {
        ...item,
        badgePosition: { left, top: groupTop + item.row * pitch + Math.max(0, (itemHeight - badgeSize) / 2) - opticalLift, width: badgeSize, height: badgeSize },
        labelPosition: {
          left: left + labelOffset,
          top: groupTop + item.row * pitch - 2,
          width: columnWidth - labelOffset,
          height: itemHeight,
        },
      };
    }),
  };
}

export const planNavigationPage = (data) => {
  const plan = planStructurePage(data, "navigation-page");
  return { ...plan, navigation: computeNavigationLayout(plan.normalized.page_contract) };
};
