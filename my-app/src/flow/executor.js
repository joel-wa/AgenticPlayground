import { getPorts } from "./nodeTypes";

function resolveTemplate(str, vars) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}

function parseAIResponse(json) {
  if (typeof json === "string") return json;
  return json.text ?? json.output ?? json.result ?? json.message ?? json.content?.[0]?.text ?? JSON.stringify(json);
}

export async function execNode(node, inputs, globalVars, log, defaultModel) {
  log(`Running ${node.type}`, "info");
  switch (node.type) {
    case "userInput":
      return { out: node.data.value || "" };
    case "textInput":
      return { out: node.data.content || "" };
    case "promptBuilder": {
      let tpl = node.data.template || "";
      getPorts(node).inputs.forEach(port => {
        const vn = port.id.replace("v:", "");
        const val = inputs[port.id] ?? globalVars[vn] ?? `{${vn}}`;
        tpl = tpl.replace(new RegExp(`\\{${vn}\\}`, "g"), val);
      });
      return { out: tpl };
    }
    case "aiNode": {
      const prompt = inputs["in"] || "(no input)";
      const model = node.data.model || defaultModel || "";
      const serverUrl = resolveTemplate((node.data.serverUrl || "").trim(), globalVars);
      const system = resolveTemplate(node.data.systemPrompt || "You are helpful.", globalVars);
      if (!serverUrl) {
        log("⚠ No server URL set on AI node", "warn");
        return { out: "[Error] No server URL configured on this AI node.", err: "missing_url" };
      }
      log(`→ POST ${serverUrl}`, "info");
      try {
        const res = await fetch(serverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, model, system, max_tokens: node.data.maxTokens || 1000, temperature: node.data.temperature ?? 0.7 }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error?.message || errBody.message || `HTTP ${res.status}`);
        }
        const json = await res.json();
        const text = parseAIResponse(json);
        log(`← ${String(text).length} chars received`, "success");
        return { out: String(text), err: null };
      } catch (e) {
        log(`✗ Request failed: ${e.message}`, "error");
        return { out: null, err: e.message };
      }
    }
    case "branch": {
      const raw = inputs["in"] ?? "";
      const val = String(raw).toLowerCase();
      const conds = node.data.conditions || [];
      const result = {};
      conds.forEach(c => { result[c.id] = null; });
      result["_else"] = null;
      let matched = false;
      for (const c of conds) {
        if (matched || !c.match) continue;
        const m = c.match.toLowerCase();
        let hit = false;
        switch (c.mode || "contains") {
          case "contains": hit = val.includes(m); break;
          case "equals": hit = val === m; break;
          case "starts": hit = val.startsWith(m); break;
          case "ends": hit = val.endsWith(m); break;
          case "regex": {
            try { hit = new RegExp(c.match, "i").test(raw); } catch { hit = false; }
            break;
          }
        }
        if (hit) {
          result[c.id] = raw;
          matched = true;
          log(`Branch → "${c.label}" (${c.mode || "contains"}: "${c.match}")`, "info");
        }
      }
      if (!matched) {
        result["_else"] = raw;
        log("Branch → else (no conditions matched)", "warn");
      }
      return result;
    }
    case "setGlobal": {
      const key = (node.data.key || "").trim();
      const value = inputs["in"] ?? node.data.value ?? "";
      if (!key) {
        log("⚠ Set Global node has no variable key configured", "warn");
        return { out: value };
      }
      globalVars[key] = value;
      log(`Set runtime global {${key}} = ${JSON.stringify(value)}`, "success");
      return { out: value };
    }
    case "output":
      return { _display: inputs["in"] };
    case "note":
      return {};
    default:
      return {};
  }
}
