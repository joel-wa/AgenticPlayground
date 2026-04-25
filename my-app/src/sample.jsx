import { useState, useRef, useCallback, useEffect } from "react";
import { getPorts, TYPE_META, defaultData, MODELS } from "./flow/nodeTypes";
import { SS } from "./flow/styles";
import NodeContent from "./flow/NodeContent";
import { execNode } from "./flow/executor";
import { nodeHeight, portXY, bezier, snap, uid, eid, buildInitialGraph } from "./flow/graphUtils";

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════
const NODE_W   = 272;
const HEADER_H = 42;
const PORT_R   = 6;
const GRID     = 20;

// ══════════════════════════════════════════════════════
// NODE CONTENT RENDERERS
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// FLOW NODE
// ══════════════════════════════════════════════════════
function FlowNode({ node, selected, status, result, onSelect, onDragStart, onPortDown, onPortUp, onDataChange, onDelete, onDuplicate, defaultModel }) {
  const meta = TYPE_META[node.type];
  const color = meta.color;
  const { inputs, outputs } = getPorts(node);
  const h = nodeHeight(node, result);
  const st = status || "idle";

  const borderColor = { idle: selected ? color : "rgba(255,255,255,0.1)", running: color, done: "#22c55e", error: "#ef4444" }[st];
  const shadow = {
    idle:    selected ? `0 0 0 1px ${color}35, 0 8px 32px rgba(0,0,0,0.6)` : "0 4px 24px rgba(0,0,0,0.55)",
    running: `0 0 0 1px ${color}55, 0 0 28px ${color}28, 0 8px 32px rgba(0,0,0,0.5)`,
    done:    "0 0 0 1px #22c55e55, 0 0 20px rgba(34,197,94,0.18)",
    error:   "0 0 0 1px #ef444455, 0 0 20px rgba(239,68,68,0.18)",
  }[st];

  return (
    <div
      onMouseDown={e => { e.stopPropagation(); onSelect(); onDragStart(e); }}
      style={{ position: "absolute", left: node.position.x, top: node.position.y, width: NODE_W, height: h, borderRadius: 10, background: "rgba(10,14,24,0.97)", border: `1px solid ${borderColor}`, boxShadow: shadow, transition: "box-shadow 0.2s, border-color 0.2s", userSelect: "none" }}
    >
      {/* Header */}
      <div style={{ height: HEADER_H, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 0 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: `linear-gradient(90deg, ${color}18 0%, transparent 55%)`, borderRadius: "9px 9px 0 0", cursor: "grab" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color, lineHeight: 1 }}>{meta.icon}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#e2e8f0", letterSpacing: "0.03em" }}>{meta.label}</span>
          {st === "running" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", animation: "pulse 0.8s ease infinite" }} />}
          {st === "done"    && <span style={{ fontSize: 10, color: "#22c55e" }}>✓</span>}
          {st === "error"   && <span style={{ fontSize: 10, color: "#ef4444" }}>✗</span>}
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDuplicate(); }}
            title="Duplicate (Ctrl+D)"
            style={{ background: "none", border: "none", color: "#1e3a5f", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "2px 5px", transition: "color 0.1s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
            onMouseLeave={e => e.currentTarget.style.color = "#1e3a5f"}
          >⊕</button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Delete (Del)"
            style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 3px", transition: "color 0.1s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
            onMouseLeave={e => e.currentTarget.style.color = "#334155"}
          >×</button>
        </div>
      </div>

      {/* Content */}
      <div onMouseDown={e => e.stopPropagation()} style={{ height: h - HEADER_H, overflow: "hidden" }}>
        <NodeContent node={node} onChange={onDataChange} result={result} status={st} defaultModel={defaultModel} />
      </div>

      {/* Input ports */}
      {inputs.map(port => {
        const { y } = portXY(node, port.id, "in", result);
        const py = y - node.position.y - PORT_R;
        return (
          <div key={port.id} style={{ position: "absolute", left: -(PORT_R + 1), top: py, zIndex: 10 }}>
            <div
              onMouseDown={e => e.stopPropagation()}
              onMouseUp={() => onPortUp(node.id, port.id, "in")}
              style={{ width: PORT_R * 2, height: PORT_R * 2, borderRadius: "50%", background: "#080d18", border: `2px solid ${color}`, cursor: "crosshair", transition: "box-shadow 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 10px ${color}`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            />
            <span style={{ position: "absolute", left: PORT_R * 2 + 5, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#334155", whiteSpace: "nowrap", pointerEvents: "none" }}>{port.label}</span>
          </div>
        );
      })}

      {/* Output ports */}
      {outputs.map(port => {
        const { y } = portXY(node, port.id, "out", result);
        const py = y - node.position.y - PORT_R;
        const isElse = port.id === "_else";
        return (
          <div key={port.id} style={{ position: "absolute", right: -(PORT_R + 1), top: py, zIndex: 10 }}>
            <div
              onMouseDown={e => { e.stopPropagation(); onPortDown(e, node.id, port.id, "out"); }}
              style={{ width: PORT_R * 2, height: PORT_R * 2, borderRadius: "50%", background: isElse ? "#080d18" : color, border: `2px solid ${isElse ? "#475569" : color}`, cursor: "crosshair", boxShadow: isElse ? "none" : `0 0 8px ${color}55`, transition: "box-shadow 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 16px ${isElse ? "#475569" : color}`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = isElse ? "none" : `0 0 8px ${color}55`}
            />
            <span style={{ position: "absolute", right: PORT_R * 2 + 5, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#334155", whiteSpace: "nowrap", pointerEvents: "none" }}>{port.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// EXECUTION ENGINE
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// INITIAL GRAPH
// ══════════════════════════════════════════════════════
const INIT = buildInitialGraph();

// ══════════════════════════════════════════════════════
// MAIN EDITOR
// ══════════════════════════════════════════════════════
export default function FlowForge() {
  const [nodes, setNodes] = useState(INIT.nodes);
  const [edges, setEdges] = useState(INIT.edges);
  const [selected, setSelected] = useState(null);
  const [tx, setTx] = useState({ x: 40, y: 40, s: 1 });
  const [dragging, setDragging] = useState(null);
  const [conn, setConn] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [logs, setLogs] = useState([{ time: "00:00:00", msg: "FlowForge ready. Drag nodes from the palette or click to add.", level: "success" }]);
  const [gvars, setGvars] = useState({ tool_list: "search, code, browse", language: "English" });
  const [running, setRunning] = useState(false);
  const [nodeStatus, setNodeStatus] = useState({});
  const [nodeResult, setNodeResult] = useState({});
  const [panel, setPanel] = useState("logs");
  const [gvKey, setGvKey] = useState("");
  const [gvVal, setGvVal] = useState("");
  const [defaultModel, setDefaultModel] = useState(() => localStorage.getItem("ff_model") || MODELS[1]);
  const [history, setHistory] = useState([]);

  const canvasRef = useRef(null);
  const panning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });

  // Save a snapshot for undo before mutations
  const pushHistory = useCallback((ns, es) => {
    setHistory(h => [...h.slice(-49), { nodes: ns, edges: es }]);
  }, []);

  const log = useCallback((msg, level = "info") => {
    const t = new Date();
    const time = [t.getHours(), t.getMinutes(), t.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
    setLogs(l => [...l.slice(-300), { time, msg, level }]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      const tag = document.activeElement?.tagName;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !typing) {
        setNodes(ns => { pushHistory(ns, edges); return ns.filter(n => n.id !== selected); });
        setEdges(es => es.filter(ev => ev.source !== selected && ev.target !== selected));
        setSelected(null);
        log("Node deleted", "info");
      }
      if (e.key === "Escape") { setConn(null); setDragging(null); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !typing) {
        e.preventDefault();
        setHistory(h => {
          if (!h.length) return h;
          const prev = h[h.length - 1];
          setNodes(prev.nodes);
          setEdges(prev.edges);
          log("Undo", "info");
          return h.slice(0, -1);
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selected && !typing) {
        e.preventDefault();
        setNodes(ns => {
          const src = ns.find(n => n.id === selected);
          if (!src) return ns;
          pushHistory(ns, edges);
          const newId = uid();
          const clone = { ...src, id: newId, position: { x: src.position.x + 40, y: src.position.y + 40 }, data: { ...src.data } };
          setSelected(newId);
          log(`Duplicated ${TYPE_META[src.type].label}`, "info");
          return [...ns, clone];
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, log, pushHistory, edges]);

  const toCanvas = useCallback((sx, sy) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (sx - r.left - tx.x) / tx.s, y: (sy - r.top - tx.y) / tx.s };
  }, [tx]);

  const addNode = useCallback((type, cx, cy) => {
    const id = uid();
    setNodes(ns => [...ns, { id, type, position: { x: snap(cx - NODE_W / 2), y: snap(cy - HEADER_H) }, data: defaultData(type) }]);
    setSelected(id);
    log(`Added ${TYPE_META[type].label}`, "info");
  }, [log]);

  const deleteNode = useCallback((id) => {
    setNodes(ns => { pushHistory(ns, edges); return ns.filter(n => n.id !== id); });
    setEdges(es => es.filter(e => e.source !== id && e.target !== id));
    if (selected === id) setSelected(null);
    log("Node removed", "info");
  }, [selected, log, pushHistory, edges]);

  const duplicateNode = useCallback((id) => {
    setNodes(ns => {
      const src = ns.find(n => n.id === id);
      if (!src) return ns;
      pushHistory(ns, edges);
      const newId = uid();
      const clone = { ...src, id: newId, position: { x: src.position.x + 40, y: src.position.y + 40 }, data: { ...src.data } };
      setSelected(newId);
      log(`Duplicated ${TYPE_META[src.type].label}`, "info");
      return [...ns, clone];
    });
  }, [log, pushHistory, edges]);

  const updateData = useCallback((id, data) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data } : n));
  }, []);

  const deleteEdge = useCallback((edgeId) => {
    setEdges(es => es.filter(e => e.id !== edgeId));
    log("Connection removed", "info");
  }, [log]);

  // Node drag
  const onNodeDragStart = useCallback((e, id) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setDragging({ id, sx: node.position.x, sy: node.position.y, mx: e.clientX, my: e.clientY });
  }, [nodes]);

  // Port connect
  const onPortDown = useCallback((e, nodeId, portId, side) => {
    e.stopPropagation();
    setConn({ nodeId, portId, side });
  }, []);

  const onPortUp = useCallback((targetId, targetPortId, targetSide) => {
    if (!conn) return;
    if (conn.side === targetSide || conn.nodeId === targetId) { setConn(null); return; }
    const [src, sh, tgt, th] = conn.side === "out"
      ? [conn.nodeId, conn.portId, targetId, targetPortId]
      : [targetId, targetPortId, conn.nodeId, conn.portId];
    const dup = edges.some(e => e.source === src && e.sourceHandle === sh && e.target === tgt && e.targetHandle === th);
    if (!dup) {
      setEdges(es => [...es, { id: eid(), source: src, sourceHandle: sh, target: tgt, targetHandle: th }]);
      log(`Connected: ${sh} → ${th}`, "info");
    }
    setConn(null);
  }, [conn, edges, log]);

  // Mouse events
  const onMouseMove = useCallback(e => {
    const { x, y } = toCanvas(e.clientX, e.clientY);
    setMouse({ x, y });
    if (dragging) {
      const dx = (e.clientX - dragging.mx) / tx.s;
      const dy = (e.clientY - dragging.my) / tx.s;
      setNodes(ns => ns.map(n => n.id === dragging.id
        ? { ...n, position: { x: snap(dragging.sx + dx), y: snap(dragging.sy + dy) } } : n));
    }
    if (panning.current) {
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setTx(t => ({ ...t, x: panStart.current.tx + dx, y: panStart.current.ty + dy }));
    }
  }, [dragging, tx.s, toCanvas]);

  const onMouseDown = useCallback(e => {
    setSelected(null);
    panning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, tx: tx.x, ty: tx.y };
  }, [tx]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
    panning.current = false;
    setConn(null);
  }, []);

  const onWheel = useCallback(e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setTx(t => {
      const ns = Math.max(0.2, Math.min(2.8, t.s * factor));
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return t;
      const px = e.clientX - r.left, py = e.clientY - r.top;
      return { x: px - (px - t.x) * (ns / t.s), y: py - (py - t.y) * (ns / t.s), s: ns };
    });
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => el?.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Attach mousemove and mouseup to window so dragging/panning is correctly
  // terminated even when the cursor leaves the canvas bounds (e.g. moves over
  // the sidebar or releases the button outside the browser window).
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Palette DnD
  const onPaletteDrag = (e, type) => e.dataTransfer.setData("ntype", type);
  const onDrop = useCallback(e => {
    e.preventDefault();
    const type = e.dataTransfer.getData("ntype");
    if (!type) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    addNode(type, x, y);
  }, [toCanvas, addNode]);

  // Run workflow
  const runWorkflow = useCallback(async () => {
    if (running || nodes.length === 0) return;
    setRunning(true);
    setNodeResult({});
    setNodeStatus({});
    setPanel("logs");
    log("━━ Starting workflow ━━", "info");

    const nodesSnap = [...nodes];
    const edgesSnap = [...edges];
    const inMap = {};
    edgesSnap.forEach(e => { if (!inMap[e.target]) inMap[e.target] = []; inMap[e.target].push(e); });

    // Build augmented edge list: add virtual ordering edges from each setGlobal node
    // to every node that uses its variable implicitly (no explicit connecting edge).
    // This ensures setGlobal always runs before the nodes that read its variable via globalVars.
    const augEdges = [...edgesSnap];
    nodesSnap.filter(n => n.type === "setGlobal").forEach(setter => {
      const key = (setter.data?.key || "").trim();
      if (!key) return;
      // Escape the key for use in a regex and match the exact token {key} (not a substring of another var)
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const varRegex = new RegExp(`\\{${escaped}\\}`);
      const textContainsVar = str => varRegex.test(str || "");
      nodesSnap.forEach(target => {
        if (target.id === setter.id) return;
        const alreadyConnected = augEdges.some(e => e.source === setter.id && e.target === target.id);
        if (alreadyConnected) return;
        let usesVar = false;
        if (target.type === "promptBuilder") {
          usesVar = textContainsVar(target.data?.template);
        } else if (target.type === "aiNode") {
          usesVar = textContainsVar(target.data?.systemPrompt) || textContainsVar(target.data?.serverUrl);
        }
        if (usesVar) {
          augEdges.push({ id: `__virtual_ordering__${setter.id}__${target.id}`, source: setter.id, target: target.id });
        }
      });
    });

    // Topological sort (use augEdges so implicit setGlobal deps are respected)
    const inDeg = {};
    nodesSnap.forEach(n => inDeg[n.id] = 0);
    augEdges.forEach(e => inDeg[e.target] = (inDeg[e.target] || 0) + 1);
    const queue = nodesSnap.filter(n => inDeg[n.id] === 0);
    const order = [];
    const seen = new Set();
    while (queue.length) {
      const n = queue.shift();
      if (seen.has(n.id)) continue;
      seen.add(n.id); order.push(n);
      augEdges.filter(e => e.source === n.id).forEach(e => {
        if (--inDeg[e.target] === 0) { const t = nodesSnap.find(x => x.id === e.target); if (t) queue.push(t); }
      });
    }
    nodesSnap.forEach(n => { if (!seen.has(n.id)) order.push(n); });

    const runtimeVars = { ...gvars };
    const portOut = {};
    const skipped = new Set();

    for (const node of order) {
      if (skipped.has(node.id)) { log(`  skip: ${TYPE_META[node.type].label}`, "warn"); continue; }

      const incoming = inMap[node.id] || [];
      const missingInput = incoming.some(e => {
        const v = portOut[`${e.source}:${e.sourceHandle}`];
        return v === undefined || v === null;
      });
      if (missingInput && incoming.length > 0) {
        log(`  skip: ${TYPE_META[node.type].label} (no input from branch path)`, "warn");
        skipped.add(node.id);
        continue;
      }

      setNodeStatus(s => ({ ...s, [node.id]: "running" }));
      await new Promise(r => setTimeout(r, 60));

      const inputs = {};
      incoming.forEach(e => {
        const v = portOut[`${e.source}:${e.sourceHandle}`];
        if (v !== null && v !== undefined) inputs[e.targetHandle] = v;
      });

      try {
        const res = await execNode(node, inputs, runtimeVars, log, defaultModel);
        Object.entries(res).forEach(([k, v]) => {
          portOut[`${node.id}:${k}`] = v;
          if (v === null) {
            edgesSnap.filter(e => e.source === node.id && e.sourceHandle === k).forEach(e => skipped.add(e.target));
          }
        });
        const display = res._display !== undefined ? res._display : (res.out !== undefined ? res.out : Object.values(res).find(v => v !== null));
        setNodeResult(r => ({ ...r, [node.id]: display }));
        setNodeStatus(s => ({ ...s, [node.id]: "done" }));
      } catch (err) {
        log(`  error: ${err.message}`, "error");
        setNodeStatus(s => ({ ...s, [node.id]: "error" }));
      }
    }

    log("━━ Workflow complete ━━", "success");
    setRunning(false);
  }, [nodes, edges, gvars, running, log, defaultModel]);

  // Pending connection path
  const pendingPath = conn ? (() => {
    const n = nodes.find(x => x.id === conn.nodeId);
    if (!n) return null;
    const sp = portXY(n, conn.portId, conn.side, nodeResult[n.id]);
    const [x1, y1, x2, y2] = conn.side === "out"
      ? [sp.x, sp.y, mouse.x, mouse.y]
      : [mouse.x, mouse.y, sp.x, sp.y];
    return { d: bezier(x1, y1, x2, y2), color: TYPE_META[n.type].color };
  })() : null;

  // Grid
  const gs = GRID * tx.s;
  const gx = ((tx.x % gs) + gs) % gs;
  const gy = ((tx.y % gs) + gs) % gs;

  const LOG_COLORS = { info: "#475569", success: "#22c55e", error: "#f87171", warn: "#fb923c" };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#030609", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", color: "#e2e8f0", overflow: "hidden" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 168, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", background: "#060a12", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 14px 11px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "#e2e8f0" }}>
            FLOW<span style={{ color: "#6366f1" }}>FORGE</span>
          </div>
          <div style={{ fontSize: 8.5, color: "#1e3a5f", marginTop: 3, letterSpacing: "0.1em" }}>VISUAL AGENT EDITOR</div>
        </div>

        <div style={{ padding: "10px 8px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.14em", padding: "0 6px", marginBottom: 8 }}>NODES</div>
          {Object.entries(TYPE_META).map(([type, meta]) => (
            <div key={type} draggable
              onDragStart={e => onPaletteDrag(e, type)}
              onClick={() => {
                const r = canvasRef.current?.getBoundingClientRect();
                if (!r) return;
                const cx = (r.width / 2 - tx.x) / tx.s;
                const cy = (r.height / 2 - tx.y) / tx.s;
                addNode(type, cx + (Math.random() - 0.5) * 120, cy + (Math.random() - 0.5) * 80);
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, marginBottom: 2, cursor: "grab", userSelect: "none", transition: "background 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.background = `${meta.color}14`}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 12, color: meta.color, width: 16, textAlign: "center", lineHeight: 1 }}>{meta.icon}</span>
              <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{meta.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.12em", marginBottom: 7 }}>CANVAS</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
            <button onClick={() => setTx(t => ({ ...t, s: Math.min(t.s * 1.2, 2.8) }))} style={{ ...SS.btn, flex: 1, fontSize: 14, padding: "3px" }}>+</button>
            <button onClick={() => setTx(t => ({ ...t, s: Math.max(t.s * 0.8, 0.2) }))} style={{ ...SS.btn, flex: 1, fontSize: 14, padding: "3px" }}>−</button>
            <button onClick={() => {
              if (!nodes.length) { setTx({ x: 40, y: 40, s: 1 }); return; }
              const r = canvasRef.current?.getBoundingClientRect();
              if (!r) return;
              const PAD = 60;
              const minX = Math.min(...nodes.map(n => n.position.x));
              const minY = Math.min(...nodes.map(n => n.position.y));
              const maxX = Math.max(...nodes.map(n => n.position.x + NODE_W));
              const maxY = Math.max(...nodes.map(n => n.position.y + nodeHeight(n, nodeResult[n.id])));
              const cw = r.width - PAD * 2, ch = r.height - PAD * 2;
              const fw = cw / (maxX - minX || 1), fh = ch / (maxY - minY || 1);
              const s = Math.max(0.2, Math.min(1.8, Math.min(fw, fh)));
              setTx({ x: PAD + (cw - (maxX - minX) * s) / 2 - minX * s, y: PAD + (ch - (maxY - minY) * s) / 2 - minY * s, s });
            }} style={{ ...SS.btn, flex: 2, fontSize: 9, letterSpacing: "0.04em" }}>FIT</button>
          </div>
          <div style={{ fontSize: 9, color: "#1e3a5f", textAlign: "center" }}>{Math.round(tx.s * 100)}%</div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#060a12", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 9.5, color: "#1e3a5f", letterSpacing: "0.06em" }}>{nodes.length} NODES · {edges.length} EDGES</span>
            {selected && <span style={{ fontSize: 9.5, color: "#334155", letterSpacing: "0.04em" }}>· {TYPE_META[nodes.find(n=>n.id===selected)?.type]?.label} SELECTED · DEL TO REMOVE</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { setNodes([]); setEdges([]); setNodeResult({}); setNodeStatus({}); setSelected(null); log("Canvas cleared", "info"); }}
              style={{ ...SS.btn, fontSize: 9.5, letterSpacing: "0.06em", padding: "5px 12px" }}>CLEAR</button>
            <button onClick={runWorkflow} disabled={running || nodes.length === 0}
              style={{ ...SS.btn, fontSize: 10, letterSpacing: "0.06em", padding: "5px 18px", fontWeight: 700, background: running ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.22)", border: `1px solid ${running ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.5)"}`, color: running ? "#4f46e5" : "#a5b4fc", cursor: running ? "not-allowed" : "pointer" }}>
              {running ? "⟳  RUNNING…" : "▶  RUN"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── CANVAS ── */}
          <div ref={canvasRef}
            style={{ flex: 1, position: "relative", overflow: "hidden", cursor: "grab", background: "#050912", backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)`, backgroundSize: `${gs}px ${gs}px`, backgroundPosition: `${gx}px ${gy}px` }}
            onMouseDown={onMouseDown}
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
          >
            <div style={{ position: "absolute", transform: `translate(${tx.x}px,${tx.y}px) scale(${tx.s})`, transformOrigin: "0 0" }}>

              {/* SVG connections */}
              <svg style={{ position: "absolute", top: 0, left: 0, width: 8000, height: 8000, pointerEvents: "all", overflow: "visible" }}>
                <defs>
                  {Object.entries(TYPE_META).map(([type, meta]) => (
                    <filter key={type} id={`glow-${type}`}>
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  ))}
                </defs>
                {edges.map(edge => {
                  const sn = nodes.find(n => n.id === edge.source);
                  const tn = nodes.find(n => n.id === edge.target);
                  if (!sn || !tn) return null;
                  const sp = portXY(sn, edge.sourceHandle, "out", nodeResult[sn.id]);
                  const tp = portXY(tn, edge.targetHandle, "in", nodeResult[tn.id]);
                  const c = TYPE_META[sn.type].color;
                  const active = nodeStatus[sn.id] === "done";
                  const d = bezier(sp.x, sp.y, tp.x, tp.y);
                  return (
                    <g key={edge.id} style={{ cursor: "pointer" }} onClick={() => deleteEdge(edge.id)}>
                      <path d={d} stroke="transparent" strokeWidth={16} fill="none" />
                      <path d={d} stroke={c} strokeWidth={active ? 2.5 : 1.5} fill="none" strokeOpacity={active ? 0.85 : 0.4} filter={active ? `url(#glow-${sn.type})` : undefined} />
                      <path d={d} stroke={c} strokeWidth={10} fill="none" strokeOpacity={0.05} />
                      <circle cx={tp.x} cy={tp.y} r={3.5} fill={c} fillOpacity={0.7} />
                    </g>
                  );
                })}
                {pendingPath && (
                  <path d={pendingPath.d} stroke={pendingPath.color} strokeWidth={2} fill="none" strokeDasharray="8 4" strokeOpacity={0.9} />
                )}
              </svg>

              {/* Nodes */}
              {nodes.map(node => (
                <FlowNode key={node.id} node={node}
                  selected={selected === node.id}
                  status={nodeStatus[node.id]}
                  result={nodeResult[node.id]}
                  onSelect={() => setSelected(node.id)}
                  onDragStart={e => onNodeDragStart(e, node.id)}
                  onPortDown={onPortDown}
                  onPortUp={onPortUp}
                  onDataChange={data => updateData(node.id, data)}
                  onDelete={() => deleteNode(node.id)}
                  onDuplicate={() => duplicateNode(node.id)}
                  defaultModel={defaultModel}
                />
              ))}
            </div>

            {/* Canvas hints */}
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#0f1e32", letterSpacing: "0.1em", pointerEvents: "none", whiteSpace: "nowrap" }}>
              SCROLL ZOOM · DRAG PAN · DRAG PALETTE TO PLACE · DRAG PORT TO CONNECT · CLICK EDGE TO DELETE · DEL TO REMOVE NODE
            </div>

            {/* Empty state */}
            {nodes.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.15 }}>⬡</div>
                <div style={{ fontSize: 11, color: "#1e3a5f", letterSpacing: "0.1em" }}>CANVAS EMPTY</div>
                <div style={{ fontSize: 9.5, color: "#0f1e32", marginTop: 6, letterSpacing: "0.06em" }}>Click or drag nodes from the left panel</div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ width: 276, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", background: "#060a12", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              {[["logs", "LOGS"], ["vars", "GLOBALS"], ["settings", "SETTINGS"]].map(([id, label]) => (
                <button key={id} onClick={() => setPanel(id)}
                  style={{ flex: 1, padding: "11px 0", background: "none", border: "none", cursor: "pointer", fontSize: 9, letterSpacing: "0.14em", color: panel === id ? "#e2e8f0" : "#1e3a5f", borderBottom: `2px solid ${panel === id ? "#6366f1" : "transparent"}`, transition: "color 0.15s, border-color 0.15s", fontFamily: "inherit" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Logs */}
            {panel === "logs" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
                  <span style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.1em" }}>{logs.length} ENTRIES</span>
                  <button onClick={() => setLogs([])} style={{ ...SS.btn, fontSize: 8.5, padding: "2px 7px" }}>CLEAR</button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
                  {[...logs].reverse().map((entry, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, marginBottom: 3, fontSize: 9.5, lineHeight: 1.5 }}>
                      <span style={{ color: "#0f1e32", flexShrink: 0, fontSize: 8.5, paddingTop: 1 }}>{entry.time}</span>
                      <span style={{ color: LOG_COLORS[entry.level] || "#475569" }}>{entry.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            {panel === "settings" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                <div style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.14em", marginBottom: 14 }}>SETTINGS</div>
                <span style={SS.label}>DEFAULT AI MODEL</span>
                <select
                  style={{ ...SS.select, marginBottom: 16 }}
                  value={defaultModel}
                  onChange={e => { setDefaultModel(e.target.value); localStorage.setItem("ff_model", e.target.value); log(`Default model → ${e.target.value}`, "info"); }}
                >
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.12em", marginBottom: 9 }}>WORKFLOW</div>
                  <button onClick={() => {
                    const data = JSON.stringify({ nodes, edges, gvars }, null, 2);
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
                    a.download = "flowforge-workflow.json"; a.click();
                    log("Workflow exported", "success");
                  }} style={{ ...SS.btn, width: "100%", marginBottom: 6, fontSize: 9.5, letterSpacing: "0.06em" }}>↓ EXPORT JSON</button>
                  <label style={{ display: "block" }}>
                    <div style={{ ...SS.btn, width: "100%", textAlign: "center", fontSize: 9.5, letterSpacing: "0.06em", cursor: "pointer" }}>↑ IMPORT JSON</div>
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => {
                        try {
                          const parsed = JSON.parse(ev.target.result);
                          if (parsed.nodes && parsed.edges) {
                            pushHistory(nodes, edges);
                            setNodes(parsed.nodes); setEdges(parsed.edges);
                            if (parsed.gvars) setGvars(parsed.gvars);
                            setNodeStatus({}); setNodeResult({});
                            log("Workflow imported", "success");
                          }
                        } catch { log("Import failed: invalid JSON", "error"); }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }} />
                  </label>
                </div>
                <div style={{ paddingTop: 12, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.12em", marginBottom: 6 }}>SHORTCUTS</div>
                  {[
                    ["Ctrl+Z", "Undo"], ["Ctrl+D", "Duplicate node"], ["Del", "Remove node"],
                    ["Esc", "Cancel connection"], ["Scroll", "Zoom"], ["Drag bg", "Pan"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 9.5 }}>
                      <span style={{ color: "#6366f1", fontFamily: "monospace" }}>{k}</span>
                      <span style={{ color: "#334155" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Global vars */}
            {panel === "vars" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                <div style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.14em", marginBottom: 14 }}>GLOBAL VARIABLES</div>
                {Object.keys(gvars).length === 0 && (
                  <div style={{ fontSize: 10, color: "#1e3a5f", marginBottom: 12, fontStyle: "italic" }}>No global variables yet.</div>
                )}
                {Object.entries(gvars).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "#fb923c", letterSpacing: "0.04em" }}>{`{${k}}`}</span>
                      <button onClick={() => { setGvars(g => { const n = { ...g }; delete n[k]; return n; }); log(`Removed {${k}}`, "info"); }}
                        style={{ ...SS.btn, fontSize: 9, padding: "1px 6px", color: "#f87171", background: "rgba(248,113,113,0.08)" }}>×</button>
                    </div>
                    <input value={v} onChange={e => setGvars(g => ({ ...g, [k]: e.target.value }))}
                      style={SS.input} />
                  </div>
                ))}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 8.5, color: "#1e3a5f", letterSpacing: "0.12em", marginBottom: 9 }}>ADD VARIABLE</div>
                  <span style={SS.label}>KEY</span>
                  <input value={gvKey} onChange={e => setGvKey(e.target.value)} style={{ ...SS.input, marginBottom: 8 }} placeholder="variable_name" />
                  <span style={SS.label}>VALUE</span>
                  <input value={gvVal} onChange={e => setGvVal(e.target.value)} style={{ ...SS.input, marginBottom: 10 }} placeholder="value" />
                  <button onClick={() => {
                    if (!gvKey.trim()) return;
                    setGvars(g => ({ ...g, [gvKey.trim()]: gvVal }));
                    log(`Added {${gvKey}}`, "info");
                    setGvKey(""); setGvVal("");
                  }} style={{ ...SS.btn, width: "100%", fontSize: 9.5, letterSpacing: "0.06em" }}>+ ADD VARIABLE</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
        input:focus, textarea:focus { border-color: rgba(99,102,241,0.45) !important; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
      `}</style>
    </div>
  );
}