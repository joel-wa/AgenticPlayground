# AgenticPlayground

A lightweight visual workflow playground built with plain HTML/CSS/JS.

## Features

- Drag and move workflow nodes on a canvas
- Node types:
  - User Input
  - Text Input
  - Prompt Builder (supports variables like `{toollist}`)
  - AI Processing (configurable server URL)
  - Route (multi-path branching)
- Link nodes with labeled paths (e.g. `A`, `B`, `C`)
- Execute a workflow from a start node and inspect run logs

## Run

Open `/home/runner/work/AgenticPlayground/AgenticPlayground/index.html` in a browser.

## Backend placeholder

Use `/home/runner/work/AgenticPlayground/AgenticPlayground/backend` to add your server implementation.
A minimal example is available at `backend/server.example.js`.
