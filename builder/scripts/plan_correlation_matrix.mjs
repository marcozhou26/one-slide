import { SLIDE } from "./layout_constants.mjs";
import { validateCorrelationMatrix } from "./validate_correlation_matrix.mjs";
export function planCorrelationMatrix(data) {
  const normalized = validateCorrelationMatrix(data).normalized;
  const content = { left: 54, width: 1172 };
  const matrixTop = 126;
  const matrixHeight = 450;
  const headerHeight = 42;
  const labelWidth = 136;
  const rightPadding = 24;
  const panelGap = 24;
  const metricCount = normalized.diagram.metrics.length;
  const cellHeight = (matrixHeight - headerHeight) / metricCount;
  // For denser matrices, protect signed coefficient readability before strict squareness.
  const cellWidth = metricCount <= 7 ? cellHeight : Math.max(cellHeight, 60);
  const gridWidth = cellWidth * metricCount;
  const matrixWidth = labelWidth + gridWidth + rightPadding;
  const matrix = { left: content.left, top: matrixTop, width: matrixWidth, height: matrixHeight };
  const grid = {
    left: matrix.left + labelWidth,
    top: matrix.top + headerHeight,
    width: gridWidth,
    height: matrixHeight - headerHeight,
    cellWidth,
    cellHeight,
    labelWidth,
    headerHeight,
    rightPadding,
  };
  const railLeft = matrix.left + matrix.width + panelGap;
  const rail = { left: railLeft, top: matrixTop, width: content.left + content.width - railLeft, height: matrixHeight };
  return { normalized, slide: SLIDE, title: { ...normalized.title, left: 54, top: 26, width: 1172, height: 58 }, subtitle: normalized.subtitle ? { ...normalized.subtitle, left: 54, top: 84, width: 1172, height: 26 } : null, matrix, grid, rail, footer: { left: 54, top: 600, width: 1172, height: 78 } };
}
