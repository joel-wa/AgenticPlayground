const workspace = document.getElementById('workspace');
const connections = document.getElementById('connections');
const nodeForm = document.getElementById('nodeForm');
const editorEmpty = document.getElementById('editorEmpty');
const nodeTitle = document.getElementById('nodeTitle');
const nodeContent = document.getElementById('nodeContent');
const nodeUrl = document.getElementById('nodeUrl');
const nodeRouteMap = document.getElementById('nodeRouteMap');
const edgeSource = document.getElementById('edgeSource');
const edgeTarget = document.getElementById('edgeTarget');
const edgeLabel = document.getElementById('edgeLabel');
const startNode = document.getElementById('startNode');
const runOutput = document.getElementById('runOutput');
const NODE_COUNTER_START = 1;

const state = {
  nodes: [],
  edges: [],
  selectedId: null,
  counter: NODE_COUNTER_START,
};

const nodeTemplates = {
  user_input: { title: 'User Input', content: 'user_text', url: '', routeMap: '' },
  text_input: { title: 'Text Input', content: 'static text', url: '', routeMap: '' },
  prompt_builder: { title: 'Prompt Builder', content: 'Available tools: {toollist}', url: '', routeMap: '' },
  ai_processing: { title: 'AI Processing', content: 'Send prompt to AI', url: 'http://localhost:8080/ai', routeMap: '' },
  route: { title: 'Route', content: 'route_key', url: '', routeMap: 'A=pathA\nB=pathB\nC=pathC' },
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function addNode(type) {
  const template = nodeTemplates[type];
  const id = `node-${state.counter++}`;
  const node = {
    id,
    type,
    x: 60 + state.nodes.length * 20,
    y: 60 + state.nodes.length * 20,
    ...template,
  };

  state.nodes.push(node);

  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.id = id;
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.innerHTML = `<strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(type)}</small>`;
  workspace.appendChild(el);

  enableDrag(el);
  el.addEventListener('click', () => selectNode(id));

  refreshNodeSelectors();
}

function refreshNodeSelectors() {
  const options = state.nodes.map((n) => `<option value="${n.id}">${escapeHtml(n.title)} (${escapeHtml(n.id)})</option>`).join('');
  edgeSource.innerHTML = `<option value="">Select source</option>${options}`;
  edgeTarget.innerHTML = `<option value="">Select target</option>${options}`;
  startNode.innerHTML = `<option value="">Auto</option>${options}`;
}

function renderNode(node) {
  const el = workspace.querySelector(`[data-id="${node.id}"]`);
  if (!el) return;
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.innerHTML = `<strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.type)}</small>`;
  drawEdges();
}

function selectNode(id) {
  state.selectedId = id;
  const node = state.nodes.find((n) => n.id === id);
  if (!node) return;

  workspace.querySelectorAll('.node').forEach((el) => {
    el.classList.toggle('selected', el.dataset.id === id);
  });

  editorEmpty.hidden = true;
  nodeForm.hidden = false;
  nodeTitle.value = node.title;
  nodeContent.value = node.content;
  nodeUrl.value = node.url;
  nodeRouteMap.value = node.routeMap;
}

function enableDrag(el) {
  let startX = 0;
  let startY = 0;
  let dragging = false;

  el.addEventListener('pointerdown', (event) => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    startX = event.clientX;
    startY = event.clientY;

    const node = state.nodes.find((n) => n.id === el.dataset.id);
    if (!node) return;

    node.x = Math.max(0, node.x + dx);
    node.y = Math.max(0, node.y + dy);
    renderNode(node);
  });

  el.addEventListener('pointerup', () => {
    dragging = false;
  });
}

function drawEdges() {
  connections.innerHTML = '';
  state.edges.forEach((edge) => {
    const source = state.nodes.find((n) => n.id === edge.source);
    const target = state.nodes.find((n) => n.id === edge.target);
    if (!source || !target) return;

    const x1 = source.x + 90;
    const y1 = source.y + 30;
    const x2 = target.x + 90;
    const y2 = target.y + 30;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#444');
    line.setAttribute('stroke-width', '1.5');
    connections.appendChild(line);

    if (edge.label) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String((x1 + x2) / 2));
      text.setAttribute('y', String((y1 + y2) / 2 - 4));
      text.setAttribute('fill', '#333');
      text.setAttribute('font-size', '11');
      text.textContent = edge.label;
      connections.appendChild(text);
    }
  });
}

function parseRouteMap(routeMapText) {
  const map = {};
  routeMapText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key && value) map[key] = value;
    });
  return map;
}

function fillPromptVariables(template, context) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    if (context[key] === undefined || context[key] === null) return `__MISSING_${key}__`;
    return String(context[key]);
  });
}

function buildSafePayload(values) {
  const variables = Object.fromEntries(
    Object.entries(values).filter(([key]) => /^[a-zA-Z0-9_]+$/.test(key)),
  );

  return { variables };
}

function findDefaultStartNode() {
  return state.nodes.find((n) => n.type === 'user_input')
    || state.nodes.find((n) => n.type === 'text_input')
    || state.nodes[0];
}

async function runWorkflow() {
  const logs = [];
  const values = {
    toollist: 'search, summarize, execute',
    user_text: 'hello',
    route_key: 'A',
  };

  const selectedStart = startNode.value;
  let current = selectedStart
    ? state.nodes.find((n) => n.id === selectedStart)
    : findDefaultStartNode();

  if (!current) {
    runOutput.textContent = 'No nodes to run.';
    return;
  }

  const visited = new Set();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    logs.push(`Running ${current.id} (${current.type})`);

    if (current.type === 'text_input' || current.type === 'user_input') {
      values[current.content] = values[current.content] ?? current.content;
      logs.push(`  value[${current.content}] = ${values[current.content]}`);
    }

    if (current.type === 'prompt_builder') {
      const builtPrompt = fillPromptVariables(current.content, values);
      values.prompt = builtPrompt;
      logs.push(`  prompt = ${builtPrompt}`);
    }

    if (current.type === 'ai_processing') {
      const url = current.url || '';
      if (url) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: values.prompt || current.content,
              ...buildSafePayload(values),
            }),
          });
          const text = await response.text();
          values.ai_result = text;
          logs.push(`  ai_result = ${text.slice(0, 120)}`);
        } catch (error) {
          logs.push(`  AI call failed: ${error.message}`);
        }
      }
    }

    let outgoing = state.edges.filter((edge) => edge.source === current.id);

    if (current.type === 'route') {
      const routeMap = parseRouteMap(current.routeMap);
      const key = values[current.content] || current.content;
      const mappedLabel = routeMap[key] || key;
      outgoing = outgoing.filter((edge) => edge.label === mappedLabel || edge.label === key);
      logs.push(`  route selected: key=${key}, path=${mappedLabel}`);
    }

    current = outgoing.length > 0 ? state.nodes.find((n) => n.id === outgoing[0].target) : null;
  }

  logs.push('Workflow finished.');
  runOutput.textContent = logs.join('\n');
}

document.querySelectorAll('.add-node').forEach((button) => {
  button.addEventListener('click', () => addNode(button.dataset.type));
});

document.getElementById('createEdge').addEventListener('click', () => {
  if (!edgeSource.value || !edgeTarget.value) return;
  state.edges.push({ source: edgeSource.value, target: edgeTarget.value, label: edgeLabel.value.trim() });
  edgeLabel.value = '';
  drawEdges();
});

nodeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const node = state.nodes.find((n) => n.id === state.selectedId);
  if (!node) return;
  node.title = nodeTitle.value.trim() || node.title;
  node.content = nodeContent.value.trim();
  node.url = nodeUrl.value.trim();
  node.routeMap = nodeRouteMap.value.trim();
  renderNode(node);
  refreshNodeSelectors();
});

document.getElementById('runFlow').addEventListener('click', runWorkflow);

addNode('user_input');
addNode('prompt_builder');
addNode('ai_processing');
refreshNodeSelectors();
