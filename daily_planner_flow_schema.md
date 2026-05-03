# Daily Planner Flow Schema

This document explains the JSON structure used by the `daily_planner.json` flow. It defines the graph-based flow syntax so an agent can understand how to create similar JSON flows for a new goal or process.

## High-level structure

The JSON contains three top-level keys:

- `nodes`: an array of flow nodes
- `edges`: an array of connections between nodes
- `gvars`: a dictionary of global variables

A flow is a directed graph where nodes carry data and actions, and edges wire the outputs of one node to the inputs of another.

---

## Nodes

Each entry in `nodes` is a node object with the following general shape:

- `id`: unique string identifier for the node
- `type`: node type name
- `position`: x/y coordinates for layout only
- `data`: node-specific configuration

### Common node types

#### `userInput`

Represents a user-facing input form or data capture node.

- `data.label`: visible label or title
- `data.value`: template or placeholder text for the input content

Example:

```json
{
  "id": "input_form",
  "type": "userInput",
  "position": { "x": -800, "y": 0 },
  "data": {
    "label": "Morning Check-In Form",
    "value": "Date: {date}\nMood: {mood}\nEnergy: {energy_level}\nSuccess Definition: {success_definition}"
  }
}
```

#### `textInput`

Holds static text, knowledge, or initialization data.

- `data.content`: the text payload

Example:

```json
{
  "id": "ctx_knowledge",
  "type": "textInput",
  "position": { "x": -800, "y": 250 },
  "data": {
    "content": "KNOWLEDGE CLUSTER:\n- Preferences: ..."
  }
}
```

#### `promptBuilder`

Builds a prompt template by combining inputs from other nodes.

- `data.template`: the prompt format string with placeholders like `{planner_system}`

The placeholders are filled from connected node outputs.

Example:

```json
{
  "id": "planner_prompt",
  "type": "promptBuilder",
  "position": { "x": 0, "y": 0 },
  "data": {
    "template": "SYSTEM:\n{planner_system}\n\nKNOWLEDGE:\n{knowledge}\n\nMEMORY TABLE:\n{memory}\n\nMORNING CHECK-IN:\n{form_input}"
  }
}
```

#### `aiNode`

Represents an AI model invocation.

- `data.serverUrl`: the API endpoint for chat or model requests
- `data.systemPrompt`: system-level instructions for the agent
- `data.maxTokens`, `data.model`, `data.temperature`: model settings

Example:

```json
{
  "id": "planner_ai",
  "type": "aiNode",
  "position": { "x": 400, "y": 0 },
  "data": {
    "serverUrl": "{server_url}",
    "systemPrompt": "You are the Daily Planner Agent...",
    "maxTokens": 1000,
    "model": "",
    "temperature": 0.3
  }
}
```

#### `output`

Designates a node that displays or emits final output.

- `data.label`: label for the output node

Example:

```json
{
  "id": "plan_output",
  "type": "output",
  "position": { "x": 700, "y": -100 },
  "data": {
    "label": "📋 Daily Plan Steps Generated"
  }
}
```

#### `setGlobal`

Writes a value into a global variable.

- `data.key`: the global variable name
- `data.value`: the value to assign

Example:

```json
{
  "id": "save_plan",
  "type": "setGlobal",
  "position": { "x": 760, "y": 220 },
  "data": {
    "key": "plan",
    "value": ""
  }
}
```

#### `branch`

Routes execution based on a condition.

- `data.conditions`: an array of condition objects
  - `id`: unique condition id
  - `label`: descriptive label
  - `match`: text or pattern to match in the input payload
  - `mode`: matching mode such as `contains`

Example:

```json
{
  "id": "executor_branch",
  "type": "branch",
  "position": { "x": 2300, "y": 100 },
  "data": {
    "conditions": [
      {
        "id": "b_permission",
        "label": "Needs Permission",
        "match": "NEEDS_PERMISSION: true",
        "mode": "contains"
      }
    ]
  }
}
```

---

## Edges

Each edge connects a source node to a target node:

- `id`: unique edge identifier
- `source`: source node id
- `sourceHandle`: output port or label on the source node
- `target`: target node id
- `targetHandle`: input port or placeholder on the target node

Example:

```json
{
  "id": "e001",
  "source": "input_form",
  "sourceHandle": "out",
  "target": "planner_prompt",
  "targetHandle": "v:form_input"
}
```

### How edges work

- `sourceHandle` defines what the source node emits.
- `targetHandle` defines where the emitted value is consumed.
- Prompt builder nodes typically use `v:<placeholder>` to map incoming values into template slots.
- Branch nodes use the input from a connected node to decide execution paths.

---

## Global variables (`gvars`)

`gvars` contains shared runtime data that can be referenced across nodes.

Example:

```json
"gvars": {
  "server_url": "http://localhost:8000/api/chat",
  "plan": "",
  "current_step": "1",
  "last_result": "",
  "date": "",
  "mood": "",
  "energy_level": "",
  "success_definition": "",
  "internal_tools": "[ fetch_calendar(date), fetch_tasks(due_date, assignee), ... ]"
}
```

Use global variables for:

- runtime state
- shared configuration values
- default or placeholder inputs

---

## Creating a similar flow JSON for a new goal

To author a new flow:

1. Define the goal or workflow.
2. List the steps required to achieve it.
3. Choose node types for each step.
4. Create `nodes` for:
   - user inputs
   - static instructions or knowledge
   - prompt builders
   - AI execution nodes
   - outputs and global updates
   - branching or gates
5. Link nodes with `edges` in execution order.
6. Declare any `gvars` needed by the flow.

### Recommended pattern

- `textInput` for knowledge and instructions
- `userInput` for prompts that collect user data
- `promptBuilder` to assemble full prompts
- `aiNode` to run model behavior for planning, execution, or summarization
- `branch` to route outputs into different actions
- `setGlobal` to capture state between steps
- `output` for visible results

---

## Example template

```json
{
  "nodes": [
    {
      "id": "goal_input",
      "type": "userInput",
      "position": { "x": -800, "y": 0 },
      "data": {
        "label": "Goal Input",
        "value": "Goal: {goal}"
      }
    },
    {
      "id": "system_instructions",
      "type": "textInput",
      "position": { "x": -800, "y": 200 },
      "data": {
        "content": "You are an agent creating a workflow to achieve a user goal."
      }
    },
    {
      "id": "prompt_builder",
      "type": "promptBuilder",
      "position": { "x": 0, "y": 0 },
      "data": {
        "template": "SYSTEM:\n{system_instructions}\n\nUSER GOAL:\n{goal_input}"
      }
    },
    {
      "id": "ai_node",
      "type": "aiNode",
      "position": { "x": 400, "y": 0 },
      "data": {
        "serverUrl": "{server_url}",
        "systemPrompt": "Generate a step-by-step plan based on the goal.",
        "maxTokens": 800,
        "model": "",
        "temperature": 0.3
      }
    },
    {
      "id": "result_output",
      "type": "output",
      "position": { "x": 700, "y": 0 },
      "data": {
        "label": "Workflow Result"
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "goal_input", "sourceHandle": "out", "target": "prompt_builder", "targetHandle": "v:goal_input" },
    { "id": "e2", "source": "system_instructions", "sourceHandle": "out", "target": "prompt_builder", "targetHandle": "v:system_instructions" },
    { "id": "e3", "source": "prompt_builder", "sourceHandle": "out", "target": "ai_node", "targetHandle": "in" },
    { "id": "e4", "source": "ai_node", "sourceHandle": "out", "target": "result_output", "targetHandle": "in" }
  ],
  "gvars": {
    "server_url": "http://localhost:8000/api/chat",
    "goal": "",
    "result": ""
  }
}
```

---

## Notes for agents

- Keep node ids unique.
- Use clear `type` values and descriptive `data` payloads.
- Ensure each edge connects valid source and target ids.
- Use `promptBuilder` placeholders consistently with target handles.
- Do not include extra text outside the required JSON structure when generating new flows.
- For branching logic, ensure the `match` patterns align with expected outputs from upstream nodes.

This schema is sufficient for generating similar flow JSONs for new goals or workflows while preserving the same node/edge/gvar patterns used by `daily_planner.json`.