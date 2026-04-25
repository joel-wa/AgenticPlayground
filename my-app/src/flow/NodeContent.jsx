import { MODELS, MATCH_MODES, extractTemplateVars } from "./nodeTypes";
import { SS } from "./styles";

function UserInputContent({ data, onChange }) {
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      <span style={SS.label}>LABEL</span>
      <input style={{ ...SS.input, marginBottom: 8 }} value={data.label}
        onChange={e => onChange({ ...data, label: e.target.value })} />
      <span style={SS.label}>RUNTIME VALUE</span>
      <input style={SS.input} value={data.value} placeholder="Value at execution..."
        onChange={e => onChange({ ...data, value: e.target.value })} />
    </div>
  );
}

function TextContent({ data, onChange }) {
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      <span style={SS.label}>CONTENT</span>
      <textarea style={{ ...SS.input, resize: "none", height: 64, lineHeight: 1.45 }}
        value={data.content} onChange={e => onChange({ ...data, content: e.target.value })} />
    </div>
  );
}

function PromptBuilderContent({ data, onChange }) {
  const vars = extractTemplateVars(data.template || "");
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      <span style={SS.label}>TEMPLATE — use <span style={{ color: "#fb923c" }}>{"{varName}"}</span></span>
      <textarea style={{ ...SS.input, resize: "none", height: 72, fontSize: 11, lineHeight: 1.45 }}
        value={data.template} onChange={e => onChange({ ...data, template: e.target.value })} />
      {vars.length > 0 && (
        <div style={{ marginTop: 5, fontSize: 9.5, color: "#64748b" }}>
          Inputs: {vars.map(v => <span key={v} style={{ color: "#fb923c", marginRight: 5 }}>{`{${v}}`}</span>)}
        </div>
      )}
    </div>
  );
}

function AiNodeContent({ data, onChange, result, status, defaultModel }) {
  const model = data.model || defaultModel || MODELS[1];
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      <span style={SS.label}>SERVER URL</span>
      <input
        style={{ ...SS.input, marginBottom: 8, fontFamily: "monospace" }}
        value={data.serverUrl || ""}
        onChange={e => onChange({ ...data, serverUrl: e.target.value })}
        placeholder="http://localhost:3000/api/chat"
        spellCheck={false}
      />
      <span style={SS.label}>MODEL</span>
      <select
        style={{ ...SS.select, marginBottom: 8 }}
        value={model}
        onChange={e => onChange({ ...data, model: e.target.value })}
      >
        {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <span style={SS.label}>SYSTEM PROMPT</span>
      <textarea style={{ ...SS.input, resize: "none", height: 50, lineHeight: 1.45, marginBottom: 8 }}
        value={data.systemPrompt} onChange={e => onChange({ ...data, systemPrompt: e.target.value })} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span style={SS.label}>MAX TOKENS</span>
          <input type="number" style={SS.input} value={data.maxTokens}
            onChange={e => onChange({ ...data, maxTokens: parseInt(e.target.value) || 1000 })} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={SS.label}>TEMPERATURE</span>
          <input type="number" style={SS.input} value={data.temperature ?? 0.7} min="0" max="1" step="0.1"
            onChange={e => onChange({ ...data, temperature: parseFloat(e.target.value) ?? 0.7 })} />
        </div>
      </div>
      {status === "running" && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#a78bfa", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}>◌</span>
          Calling {model.split("-").slice(0, 2).join("-")}…
        </div>
      )}
      {result && status === "done" && (
        <div style={{ marginTop: 8, padding: "6px 8px", background: "rgba(167,139,250,0.08)", borderRadius: 5, fontSize: 10.5, color: "#c4b5fd", maxHeight: 56, overflowY: "auto", lineHeight: 1.5, border: "1px solid rgba(167,139,250,0.12)" }}>
          {String(result).slice(0, 220)}{String(result).length > 220 ? "…" : ""}
        </div>
      )}
    </div>
  );
}

function BranchContent({ data, onChange }) {
  const add = () => onChange({ ...data, conditions: [...(data.conditions || []), { id: `b${Date.now()}`, label: `Path ${String.fromCharCode(65 + (data.conditions?.length || 0))}`, match: "", mode: "contains" }] });
  const remove = id => onChange({ ...data, conditions: data.conditions.filter(c => c.id !== id) });
  const update = (id, field, val) => onChange({ ...data, conditions: data.conditions.map(c => c.id === id ? { ...c, [field]: val } : c) });
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      {(data.conditions || []).map(c => (
        <div key={c.id} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input value={c.label} onChange={e => update(c.id, "label", e.target.value)}
              style={{ ...SS.input, flex: "0 0 62px", padding: "3px 6px", fontSize: 10.5 }} placeholder="label" />
            <select value={c.mode || "contains"} onChange={e => update(c.id, "mode", e.target.value)}
              style={{ ...SS.select, flex: "0 0 70px", padding: "3px 5px", fontSize: 9.5 }}>
              {MATCH_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input value={c.match} onChange={e => update(c.id, "match", e.target.value)}
              style={{ ...SS.input, flex: 1, padding: "3px 6px", fontSize: 10.5 }} placeholder="value…" />
            <button onClick={() => remove(c.id)}
              style={{ ...SS.btn, padding: "2px 7px", color: "#f87171", background: "rgba(248,113,113,0.08)", flexShrink: 0 }}>×</button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <button onClick={add} style={{ ...SS.btn, fontSize: 10, padding: "3px 9px" }}>+ Path</button>
        <span style={{ fontSize: 9, color: "#1e3a5f" }}>+ else port always present</span>
      </div>
    </div>
  );
}

function SetGlobalContent({ data, onChange }) {
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      <span style={SS.label}>GLOBAL KEY</span>
      <input style={{ ...SS.input, marginBottom: 8 }} value={data.key} placeholder="var_name"
        onChange={e => onChange({ ...data, key: e.target.value })} />
      <span style={SS.label}>FALLBACK VALUE</span>
      <input style={SS.input} value={data.value} placeholder="Use this if no input is connected"
        onChange={e => onChange({ ...data, value: e.target.value })} />
    </div>
  );
}

function OutputContent({ result }) {
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      {result !== undefined && result !== null ? (
        <div style={{ padding: "8px 10px", background: "rgba(251,191,36,0.07)", borderRadius: 5, fontSize: 11, color: "#fde68a", maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5, wordBreak: "break-word", border: "1px solid rgba(251,191,36,0.12)" }}>
          {String(result)}
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: "#1e293b", fontStyle: "italic" }}>Awaiting input…</div>
      )}
    </div>
  );
}

function NoteContent({ data, onChange }) {
  return (
    <div style={{ padding: "8px 12px 10px" }}>
      <textarea
        style={{ ...SS.input, resize: "none", height: 66, lineHeight: 1.55, fontSize: 11, color: "#64748b" }}
        value={data.text}
        onChange={e => onChange({ ...data, text: e.target.value })}
        placeholder="Add notes, context, or documentation…"
      />
    </div>
  );
}

export default function NodeContent({ node, onChange, result, status, defaultModel }) {
  switch (node.type) {
    case "userInput":
      return <UserInputContent data={node.data} onChange={onChange} />;
    case "textInput":
      return <TextContent data={node.data} onChange={onChange} />;
    case "promptBuilder":
      return <PromptBuilderContent data={node.data} onChange={onChange} />;
    case "aiNode":
      return <AiNodeContent data={node.data} onChange={onChange} result={result} status={status} defaultModel={defaultModel} />;
    case "branch":
      return <BranchContent data={node.data} onChange={onChange} />;
    case "setGlobal":
      return <SetGlobalContent data={node.data} onChange={onChange} />;
    case "output":
      return <OutputContent result={result} />;
    case "note":
      return <NoteContent data={node.data} onChange={onChange} />;
    default:
      return null;
  }
}
