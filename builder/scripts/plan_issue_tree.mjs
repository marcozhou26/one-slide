import { validateIssueTree } from "./validate_issue_tree.mjs";
import { SLIDE } from "./layout_constants.mjs";

function blockHeight(text, verification) {
  const units = [...text].reduce((sum, char) => sum + (/\p{Script=Han}/u.test(char) ? 1 : 0.55), 0);
  const lines = Math.max(1, Math.ceil(units / 18));
  return Math.max(62, 26 + lines * 23 + (verification ? 24 : 0));
}

export function planIssueTree(data) {
  validateIssueTree(data);
  const hasInsights = (data.diagram.so_what ?? []).length > 0;
  const columns = hasInsights
    ? { root: [56, 190], branch: [298, 210], child: [566, 282], insight: [920, 304] }
    : { root: [64, 210], branch: [352, 224], child: [660, 500], insight: null };
  const contentTop = 146;
  const contentBottom = 646;
  const contentHeight = contentBottom - contentTop;
  const branchGap = 22;
  const branchHeight = (contentHeight - branchGap * (data.diagram.branches.length - 1)) / data.diagram.branches.length;
  const branches = [];
  const children = [];
  data.diagram.branches.forEach((branch, branchIndex) => {
    const top = contentTop + branchIndex * (branchHeight + branchGap);
    branches.push({
      ...branch,
      left: columns.branch[0],
      top: top + (branchHeight - 104) / 2,
      width: columns.branch[1],
      height: 104,
    });
    const heights = branch.children.map((child) => blockHeight(child.text, child.verification));
    const gap = 12;
    const total = heights.reduce((sum, value) => sum + value, 0) + gap * (heights.length - 1);
    if (total > branchHeight) {
      const error = new Error(`Branch ${branch.id} cannot fit at 16 pt`);
      error.code = "SINGLE_SLIDE_FIT_FAIL";
      throw error;
    }
    let childTop = top + (branchHeight - total) / 2;
    branch.children.forEach((child, index) => {
      children.push({
        ...child,
        branch_id: branch.id,
        left: columns.child[0],
        top: childTop,
        width: columns.child[1],
        height: heights[index],
      });
      childTop += heights[index] + gap;
    });
  });
  return {
    slide: SLIDE,
    title: { ...data.title, left: 56, top: 42, width: 1168, height: 58, fontSize: 30 },
    root: { ...data.diagram.root, left: columns.root[0], top: 328, width: columns.root[1], height: 92 },
    branches,
    children,
    insights: (data.diagram.so_what ?? []).map((insight, index, all) => ({
      ...insight,
      left: columns.insight[0] + 22,
      top: contentTop + 48 + index * ((contentHeight - 96) / all.length),
      width: columns.insight[1] - 44,
      height: Math.min(96, (contentHeight - 120) / all.length),
    })),
    insightRail: hasInsights ? { left: columns.insight[0], top: contentTop, width: columns.insight[1], height: contentHeight } : null,
  };
}
