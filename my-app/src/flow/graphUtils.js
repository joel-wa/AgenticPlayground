import { defaultData, getPorts } from "./nodeTypes";

let _c = 100;
export const uid = () => `n${++_c}`;
export const eid = () => `e${++_c}`;

export function nodeHeight(node, result) {
  const { inputs, outputs } = getPorts(node);
  const maxPorts = Math.max(inputs.length, outputs.length, 1);
  let base = {
    userInput: 92,
    textInput: 98,
    promptBuilder: 112,
    aiNode: 158,
    output: 64,
    note: 104,
    branch: 52 + Math.max(1, (node.data?.conditions?.length || 1) + 1) * 34,
  }[node.type] || 80;

  if (node.type === "output" && result !== undefined && result !== null) {
    const text = String(result);
    const lines = text.split("\n").length;
    const approxLines = Math.ceil(text.length / 48);
    const visibleLines = Math.min(10, Math.max(lines, approxLines));
    const contentHeight = 28 + visibleLines * 18;
    base = Math.max(base, contentHeight);
  }

  return 42 + Math.max(base, maxPorts * 30 + 20) + 8;
}

export function portXY(node, portId, side, result) {
  const { inputs, outputs } = getPorts(node);
  const list = side === "in" ? inputs : outputs;
  const idx = list.findIndex(p => p.id === portId);
  if (idx === -1) return { x: node.position.x, y: node.position.y };
  const h = nodeHeight(node, result);
  const inner = h - 42 - 8;
  const spacing = inner / (list.length + 1);
  const y = node.position.y + 42 + 4 + spacing * (idx + 1);
  const x = side === "in" ? node.position.x : node.position.x + 272;
  return { x, y };
}

export function bezier(x1, y1, x2, y2) {
  const dx = Math.max(Math.abs(x2 - x1) * 0.55, 50);
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

export function snap(v) { return Math.round(v / 20) * 20; }

export function buildInitialGraph() {
  const n1 = { id: uid(), type: "userInput", position: { x: 80, y: 110 }, data: defaultData("userInput") };
  const n2 = { id: uid(), type: "promptBuilder", position: { x: 430, y: 70 }, data: { template: "You are an expert assistant.\n\nUser question: {input}" } };
  const n3 = { id: uid(), type: "aiNode", position: { x: 780, y: 90 }, data: defaultData("aiNode") };
  const n4 = { id: uid(), type: "output", position: { x: 1130, y: 120 }, data: defaultData("output") };
  return {
    nodes: [n1, n2, n3, n4],
    edges: [
      { id: eid(), source: n1.id, sourceHandle: "out", target: n2.id, targetHandle: "v:input" },
      { id: eid(), source: n2.id, sourceHandle: "out", target: n3.id, targetHandle: "in" },
      { id: eid(), source: n3.id, sourceHandle: "out", target: n4.id, targetHandle: "in" },
    ],
  };
}
