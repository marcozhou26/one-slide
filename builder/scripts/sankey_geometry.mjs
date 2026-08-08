function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
  return value;
}

export function computeSankeyGeometry(
  layers,
  flows,
  plot,
  { nodeWidth = 20, gap = 14 } = {},
) {
  if (!Array.isArray(layers) || layers.length < 2) {
    throw new Error("Sankey geometry needs at least two layers");
  }
  const totals = layers.map((layer) =>
    layer.nodes.reduce((sum, node) => sum + finitePositive(node.value, `Node ${node.id}`), 0)
  );
  const maxNodes = Math.max(...layers.map((layer) => layer.nodes.length));
  const maxTotal = Math.max(...totals);
  const drawableHeight = plot.height - gap * (maxNodes - 1);
  if (drawableHeight <= 0) throw new Error("Sankey plot is too short for its node count");
  const scale = drawableHeight / maxTotal;
  const columnGap = (plot.width - nodeWidth) / (layers.length - 1);
  if (columnGap <= nodeWidth) throw new Error("Sankey plot is too narrow for its layer count");

  const nodes = {};
  const nodeLayerIndex = new Map();
  layers.forEach((layer, layerIndex) => {
    const usedHeight = totals[layerIndex] * scale + gap * (layer.nodes.length - 1);
    let top = plot.top + (plot.height - usedHeight) / 2;
    layer.nodes.forEach((node, nodeIndex) => {
      const height = node.value * scale;
      nodes[node.id] = {
        id: node.id,
        value: node.value,
        layer: layerIndex,
        index: nodeIndex,
        left: plot.left + layerIndex * columnGap,
        top,
        width: nodeWidth,
        height,
      };
      nodeLayerIndex.set(node.id, { layer: layerIndex, index: nodeIndex });
      top += height + gap;
    });
  });

  const flowKey = (flow, index) => `${index}:${flow.from}->${flow.to}`;
  const sourceOffsets = new Map();
  const targetOffsets = new Map();

  for (const node of Object.values(nodes)) {
    const outgoing = flows
      .map((flow, index) => ({ flow, index }))
      .filter(({ flow }) => flow.from === node.id)
      .sort((left, right) => {
        const leftTarget = nodeLayerIndex.get(left.flow.to);
        const rightTarget = nodeLayerIndex.get(right.flow.to);
        return leftTarget.index - rightTarget.index || left.index - right.index;
      });
    let offset = 0;
    for (const { flow, index } of outgoing) {
      sourceOffsets.set(flowKey(flow, index), offset);
      offset += flow.value * scale;
    }

    const incoming = flows
      .map((flow, index) => ({ flow, index }))
      .filter(({ flow }) => flow.to === node.id)
      .sort((left, right) => {
        const leftSource = nodeLayerIndex.get(left.flow.from);
        const rightSource = nodeLayerIndex.get(right.flow.from);
        return leftSource.index - rightSource.index || left.index - right.index;
      });
    offset = 0;
    for (const { flow, index } of incoming) {
      targetOffsets.set(flowKey(flow, index), offset);
      offset += flow.value * scale;
    }
  }

  const flowGeometry = flows.map((flow, index) => {
    const source = nodes[flow.from];
    const target = nodes[flow.to];
    const thickness = flow.value * scale;
    const key = flowKey(flow, index);
    return {
      ...flow,
      index,
      thickness,
      source,
      target,
      sourceTop: source.top + (sourceOffsets.get(key) ?? 0),
      targetTop: target.top + (targetOffsets.get(key) ?? 0),
    };
  });

  return { nodes, flows: flowGeometry, scale, gap, nodeWidth, columnGap };
}

export function buildSankeyRibbonPath(flow, curveFactor = 0.46) {
  const x0 = flow.source.left + flow.source.width;
  const x1 = flow.target.left;
  const sourceTop = flow.sourceTop;
  const sourceBottom = sourceTop + flow.thickness;
  const targetTop = flow.targetTop;
  const targetBottom = targetTop + flow.thickness;
  const minY = Math.min(sourceTop, targetTop);
  const maxY = Math.max(sourceBottom, targetBottom);
  const width = x1 - x0;
  const height = Math.max(1, maxY - minY);
  const bend = width * curveFactor;
  return {
    position: { left: x0, top: minY, width, height },
    customPaths: [{
      width,
      height,
      commands: [
        { moveTo: { x: 0, y: sourceTop - minY } },
        { cubicBezTo: {
          x1: bend,
          y1: sourceTop - minY,
          x2: width - bend,
          y2: targetTop - minY,
          x: width,
          y: targetTop - minY,
        } },
        { lineTo: { x: width, y: targetBottom - minY } },
        { cubicBezTo: {
          x1: width - bend,
          y1: targetBottom - minY,
          x2: bend,
          y2: sourceBottom - minY,
          x: 0,
          y: sourceBottom - minY,
        } },
        { close: {} },
      ],
    }],
  };
}
