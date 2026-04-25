const VAR_RE = /\{(\w+)\}/g;

export const MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
];

export const MATCH_MODES = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "starts", label: "starts" },
  { value: "ends", label: "ends" },
  { value: "regex", label: "regex" },
];

export const TYPE_META = {
  userInput:     { label: "User Input",     icon: "⌨",  color: "#22d3ee" },
  textInput:     { label: "Text",           icon: "T",  color: "#34d399" },
  promptBuilder: { label: "Prompt Builder", icon: "{}",  color: "#fb923c" },
  aiNode:        { label: "AI Process",     icon: "◈",  color: "#a78bfa" },
  branch:        { label: "Branch",         icon: "⑂",  color: "#f472b6" },
  setGlobal:     { label: "Set Global",     icon: "⚙",  color: "#38bdf8" },
  output:        { label: "Output",         icon: "◎",  color: "#fbbf24" },
  note:          { label: "Note",           icon: "✎",  color: "#64748b" },
};

export function extractTemplateVars(template) {
  return [...new Set((template || "").match(VAR_RE)?.map(m => m.slice(1, -1)) || [])];
}

export function getPorts(node) {
  switch (node.type) {
    case "userInput":
      return { inputs: [], outputs: [{ id: "out", label: "text" }] };
    case "textInput":
      return { inputs: [], outputs: [{ id: "out", label: "text" }] };
    case "promptBuilder": {
      const vars = extractTemplateVars(node.data?.template || "");
      return {
        inputs: vars.map(v => ({ id: `v:${v}`, label: v })),
        outputs: [{ id: "out", label: "prompt" }],
      };
    }
    case "aiNode":
      return {
        inputs: [{ id: "in", label: "prompt" }],
        outputs: [{ id: "out", label: "response" }, { id: "err", label: "error" }],
      };
    case "branch": {
      const conds = node.data?.conditions || [];
      return {
        inputs: [{ id: "in", label: "value" }],
        outputs: [
          ...conds.map(c => ({ id: c.id, label: c.label })),
          { id: "_else", label: "else" },
        ],
      };
    }
    case "setGlobal":
      return { inputs: [{ id: "in", label: "value" }], outputs: [{ id: "out", label: "value" }] };
    case "output":
      return { inputs: [{ id: "in", label: "value" }], outputs: [] };
    case "note":
      return { inputs: [], outputs: [] };
    default:
      return { inputs: [], outputs: [] };
  }
}

export function defaultData(type) {
  switch (type) {
    case "userInput":     return { label: "User Input", value: "" };
    case "textInput":     return { content: "Static text here..." };
    case "promptBuilder": return { template: "Context: {context}\n\nTask: {task}" };
    case "aiNode":        return { serverUrl: "", systemPrompt: "You are a helpful assistant.", maxTokens: 1000, model: "", temperature: 0.7 };
    case "branch":        return { conditions: [{ id: "b1", label: "Path A", match: "yes", mode: "contains" }, { id: "b2", label: "Path B", match: "no", mode: "contains" }] };
    case "setGlobal":     return { key: "var_name", value: "" };
    case "output":        return { label: "Result" };
    case "note":          return { text: "Add notes here…" };
    default:              return {};
  }
}
