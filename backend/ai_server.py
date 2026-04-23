import os
import json
import re
import asyncio
import datetime
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
import threading
import time
from openai import AsyncOpenAI
from composio import Composio
from composio_openai_agents import OpenAIAgentsProvider
from agents import Agent, Runner, set_default_openai_client, set_default_openai_api, set_tracing_disabled
from agents.models.openai_chatcompletions import OpenAIChatCompletionsModel
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- CONFIGURATION ---
GEMINI_API_KEY = "AIzaSyA9d8YKCgIIN_wu9GPKYZUsJcexX4CL3tY" # Replace with environment variable for security
CONCURRENCY_LIMIT = 2 # Control the number of concurrent tasks Gemini processes
# ---------------------

client = genai.Client(api_key=GEMINI_API_KEY)
semaphore = threading.Semaphore(CONCURRENCY_LIMIT)

# --- AGENT SETUP (Composio + OpenAI Agents SDK with Gemini) ---
async_openai_client = AsyncOpenAI(
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    api_key=os.getenv("GOOGLE_API_KEY"),
)
set_default_openai_client(async_openai_client)
set_default_openai_api("chat_completions")
set_tracing_disabled(True)


class ToolIntercepted(Exception):
    def __init__(self, tool_call: dict, message: str = None):
        super().__init__(message or "Tool call intercepted")
        self.tool_call = tool_call


class ToolExecutionError(Exception):
    def __init__(self, tool_call: dict, tool_slug: str, arguments: dict, error_message: str, traceback: str = None):
        super().__init__(error_message)
        self.tool_call = tool_call
        self.tool_slug = tool_slug
        self.arguments = arguments
        self.error_message = error_message
        self.traceback = traceback


def modify_tool_call_args(tool_name: str, args: dict) -> dict:
    """Intercept and modify args for any tool call before execution."""
    if tool_name == "COMPOSIO_MULTI_EXECUTE_TOOL":
        for tool_entry in args.get("tools", []):
            if tool_entry.get("tool_slug", "").strip():
                # Example interception logic: capture the planned Composio tool call
                inner_args = tool_entry.get("arguments", {})
                body = inner_args.get("body", "")
                inner_args["body"] = body
                payload = {
                    "tool_name": tool_name,
                    "tools": args.get("tools", []),
                    "intercept_reason": f"Intercepted tool call for {tool_entry.get('tool_slug')}",
                }
                raise ToolIntercepted(payload)
    return args


class InterceptingModel(OpenAIChatCompletionsModel):
    async def get_response(self, *args, **kwargs):
        response = await super().get_response(*args, **kwargs)
        for item in response.output:
            if hasattr(item, "arguments"):
                raw = json.loads(item.arguments)
                modified = modify_tool_call_args(item.name, raw)
                object.__setattr__(item, "arguments", json.dumps(modified))
        return response


agents_composio = Composio(api_key=os.getenv("COMPOSIO_API_KEY"), provider=OpenAIAgentsProvider())
agents_session = agents_composio.create(
    user_id=os.getenv("COMPOSIO_USER_ID", "pg-test-38339501-59e6-4f3f-adf8-3a830dbbf6a6"),
)
agents_tools = agents_session.tools()
composio_executor = Composio(api_key=os.getenv("COMPOSIO_API_KEY"))
# --------------------------------------------------------------

def generate_gemini_response(prompt_text):
    model = "gemini-3-flash-preview"
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt_text)],
        )
    ]
    # Thinking config validation varies by SDK version, simplified for broad compatibility
    config = types.GenerateContentConfig(
        # Remove thinking_level if your model/SDK version doesn't support it directly
        thinking_config=types.ThinkingConfig(
            thinking_level="high",
        ),
    )

    result = []
    # Blocking call to generate content
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config,
    ):
        if chunk.text:
            result.append(chunk.text)
    return "".join(result)


def extract_json_object(text):
    if not text:
        return None
    try:
        return json.loads(text)
    except ValueError:
        match = re.search(r"(\{[\s\S]*\})", text)
        if not match:
            return None
        try:
            return json.loads(match.group(1))
        except ValueError:
            return None


def build_task_parse_prompt(raw_text):
    return f"""
Extract structured task data from a short plain-language description.
Return ONLY valid JSON with the exact keys: title, notes, priority, date, assignee.
- title: concise task title
- notes: supporting context not captured in the title
- priority: one of none, low, med, high
- date: due date / deadline text, or empty string if none
- assignee: person mentioned, or empty string if none

Input: {json.dumps(raw_text)}

Respond only with JSON.
"""


def build_agent_plan_prompt(card, linked_cards=None, target_comment=None):
    if linked_cards is None:
        linked_cards = []

    lines = []
    if target_comment:
        lines.extend([
            "Create a plan to address ONLY the target comment shown below.",
            "Do not create a plan for the entire task.",
            "Use the task title and description only to fill in missing details if that makes sense.",
            "Do not use other comments to define the plan objective.",
            "",
            "Target comment:",
            f"- {target_comment.get('text', '')}",
            "",
        ])
    else:
        lines.append("Create a persistent plan for the following task.")

    lines.extend([
        "Return ONLY valid JSON with the exact keys: goal, current_phase, summary, completed_steps, next_steps, notes.",
        "- goal: the primary objective of the task",
        "- current_phase: the current phase or stage of the work",
        "- summary: a short summary of the approach",
        "- completed_steps: an array of steps already completed",
        "- next_steps: an array of next steps the agent should take",
        "- notes: additional context, constraints, or dependencies",
        "",
        f"Title: {card.get('title', '')}",
    ])

    if card.get('notes'):
        lines.append(f"Description: {card.get('notes')}")
    if card.get('priority'):
        lines.append(f"Priority: {card.get('priority')}")
    if card.get('assignee'):
        lines.append(f"Assignee: {card.get('assignee')}")
    if card.get('date'):
        lines.append(f"Due Date: {card.get('date')}")
    if card.get('comments') and not target_comment:
        lines.append("Comments:")
        for comment in card.get('comments', []):
            lines.append(f"- {comment.get('text', '')}")
    if linked_cards:
        lines.append("Linked tasks:")
        for linked in linked_cards:
            lines.append(f"- {linked.get('title', '')}: {linked.get('notes', '')}")

    lines.append("")
    lines.append("Respond only with valid JSON. Do not include any surrounding explanation.")
    return "\n".join(lines)


@app.route("/api/ai/plan", methods=["POST"])
def generate_plan():
    data = request.json or {}
    card = data.get("card", {})
    linked_cards = data.get("linked_cards", [])
    target_comment = data.get("target_comment")
    prompt = build_agent_plan_prompt(card, linked_cards, target_comment)

    acquired = semaphore.acquire(blocking=True)
    try:
        print(f"Generating plan for task: {card.get('title')}")
        response_text = generate_gemini_response(prompt)
        print(f"Gemini plan response: {response_text}")
        plan = extract_json_object(response_text)
        if not plan or not isinstance(plan, dict):
            return jsonify({"error": "Could not parse plan output", "raw": response_text}), 500

        return jsonify({"plan": plan, "raw": response_text})
    except Exception as e:
        traceback.print_exc()
        append_error_log(str(e), context=f"generate_plan card={card}", tb=traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        semaphore.release()


@app.route("/api/ai/parse_task", methods=["POST"])
def parse_task():
    data = request.json or {}
    raw_text = data.get("text", "").strip()
    if not raw_text:
        return jsonify({"error": "Text is required"}), 400

    acquired = semaphore.acquire(blocking=True)
    try:
        prompt = build_task_parse_prompt(raw_text)
        print(f"Parsing task text: {raw_text}")
        response_text = generate_gemini_response(prompt)
        print(f"Gemini parse response: {response_text}")
        parsed = extract_json_object(response_text)
        if not parsed:
            return jsonify({"error": "Could not parse model output", "raw": response_text}), 500

        priority = str(parsed.get("priority", "")).strip().lower()
        if priority.startswith("h"):
            priority = "high"
        elif priority.startswith("m"):
            priority = "med"
        elif priority.startswith("l"):
            priority = "low"
        else:
            priority = "none"

        return jsonify({
            "title": str(parsed.get("title", "")).strip(),
            "notes": str(parsed.get("notes", "")).strip(),
            "priority": priority,
            "date": str(parsed.get("date", "")).strip(),
            "assignee": str(parsed.get("assignee", "")).strip(),
        })
    except Exception as e:
        traceback.print_exc()
        append_error_log(str(e), context=f"parse_task raw_text={raw_text}", tb=traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        semaphore.release()


@app.route("/api/ai/step", methods=["POST"])
def ai_step():
    data = request.json
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Acquire semaphore to respect concurrency limit
    acquired = semaphore.acquire(blocking=True)
    try:
        print(f"Processing prompt: {prompt}...")
        response_text = generate_gemini_response(prompt)
        print(f"Gemini response: {response_text}")
        return jsonify({"answer": response_text})
    except Exception as e:
        traceback.print_exc()
        append_error_log(str(e), context=f"ai_step prompt={prompt}", tb=traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        semaphore.release()

@app.route("/api/ai/run", methods=["POST"])
def agent_task():
    data = request.json or {}
    prompt = data.get("prompt", "").strip()
    instructions = data.get("instructions", "You are a helpful assistant that helps users manage their tasks.")
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    agent = Agent(
        name="Task Agent",
        instructions=instructions,
        model=InterceptingModel("gemini-3.1-flash-lite-preview", async_openai_client),
        tools=agents_tools,
    )

    async def run_agent():
        result = await Runner.run(
            starting_agent=agent,
            input=prompt,
        )
        return result.final_output

    try:
        print(f"Running agent with prompt: {prompt}...")
        output = asyncio.run(run_agent())
        print(f"Agent output: {output}")
        return jsonify({"answer": output})
    except ToolIntercepted as e:
        print(f"Tool interception detected: {e.tool_call}")
        return jsonify({
            "intercepted": True,
            "tool_call": e.tool_call,
            "message": "The agent requested a tool execution and it must be approved or modified before running.",
        })
    except Exception as e:
        traceback.print_exc()
        append_error_log(str(e), context=f"agent_task prompt={prompt}", tb=traceback.format_exc())
        return jsonify({"error": str(e)}), 500


def execute_tool_call(tool_call: dict, edited_tool_call: dict | None = None) -> dict:
    payload = edited_tool_call or tool_call
    tool_entries = payload.get("tools") or []
    if not tool_entries:
        raise ValueError("tool_call payload must include a tools list")

    user_id = os.getenv("COMPOSIO_USER_ID")
    if not user_id:
        raise RuntimeError("COMPOSIO_USER_ID is required to execute tool calls")

    results = []
    for tool_entry in tool_entries:
        tool_slug = tool_entry.get("tool_slug") or tool_entry.get("tool_name")
        if not tool_slug:
            raise ValueError("Each tool entry must include a tool_slug")
        arguments = tool_entry.get("arguments", {}) or {}
        print(f"Executing tool {tool_slug} with args: {arguments}")
        try:
            result = composio_executor.tools.execute(
                tool_slug,
                user_id=user_id,
                arguments=arguments,
                dangerously_skip_version_check=True, # Use with caution - ensures compatibility with tools created with older SDK versions
            )
            results.append({
                "tool_slug": tool_slug,
                "arguments": arguments,
                "result": result,
            })
        except Exception as exc:
            import traceback as tb
            tb_str = tb.format_exc()
            raise ToolExecutionError(
                tool_call=tool_call,
                tool_slug=tool_slug,
                arguments=arguments,
                error_message=str(exc),
                traceback=tb_str,
            )
    return {"executed_tools": results}


def build_tool_continuation_prompt(tool_call: dict, executed_result: dict, note: str | None = None, agent_plan: dict | None = None):
    lines = [
        "The agent previously requested the following tool call.",
        "That tool call has now been executed.",
        "Use the tool execution result below to continue reasoning and finish the task.",
    ]
    if note:
        lines.append(f"User note: {note}")
    if agent_plan:
        lines.append("Agent plan:")
        lines.append(json.dumps(agent_plan, indent=2))
    lines.append("Tool call:")
    lines.append(json.dumps(tool_call, indent=2))
    if executed_result.get("error"):
        lines.append("Tool execution failed with the following error:")
        lines.append(json.dumps(executed_result["error"], indent=2))
        lines.append("")
        lines.append("Important: The tool call above failed and must not be retried as-is.")
        lines.append("Do not request the same tool again unless the user explicitly approves a corrected tool call.")
        lines.append("If the tool is unavailable or invalid, continue by reasoning with the available information or ask the user for a different action.")
    else:
        lines.append("Tool execution result:")
        lines.append(json.dumps(executed_result, indent=2))
    lines.append("Continue reasoning from this state and provide the next agent response.")
    return "\n\n".join(lines)


def append_error_log(message, context=None, tb=None):
    log_path = os.path.join(os.path.dirname(__file__), "error_logs_2")
    timestamp = datetime.datetime.now().isoformat()
    entries = [f"[{timestamp}]"]
    if context:
        entries.append(f"Context: {context}")
    entries.append(f"Error: {message}")
    if tb:
        entries.append("Traceback:")
        entries.append(tb)
    entries.append("".join(["-" for _ in range(80)]))
    with open(log_path, "a", encoding="utf-8") as f:
        f.write("\n".join(entries) + "\n")


def run_agent_with_prompt(prompt_text, instructions=None):
    if instructions is None:
        instructions = "You are a helpful assistant that helps users manage their tasks."

    agent = Agent(
        name="Task Agent",
        instructions=instructions,
        model=InterceptingModel("gemini-3.1-flash-lite-preview", async_openai_client),
        tools=agents_tools,
    )

    async def run_agent():
        result = await Runner.run(
            starting_agent=agent,
            input=prompt_text,
        )
        return result.final_output

    return asyncio.run(run_agent())


@app.route("/api/ai/tool_decision", methods=["POST"])
def tool_decision():
    data = request.json or {}
    decision = data.get("decision")
    tool_call = data.get("tool_call")
    edited_tool_call = data.get("edited_tool_call")
    note = data.get("note")
    agent_plan = data.get("agent_plan")

    if decision not in {"allow", "reject", "edit"}:
        return jsonify({"error": "decision must be allow, reject, or edit"}), 400
    if not tool_call:
        return jsonify({"error": "tool_call is required"}), 400

    if decision == "reject":
        return jsonify({
            "status": "rejected",
            "tool_call": tool_call,
            "message": "The tool request was rejected and the agent will not continue from this tool execution.",
        })

    try:
        executed = execute_tool_call(tool_call, edited_tool_call)
        continuation_prompt = build_tool_continuation_prompt(tool_call, executed, note, agent_plan)
        agent_output = run_agent_with_prompt(continuation_prompt)
        return jsonify({
            "status": "ok",
            "decision": decision,
            "tool_result": executed,
            "agent_output": agent_output,
        })
    except ToolExecutionError as exc:
        append_error_log(str(exc), context=f"tool_decision tool_slug={exc.tool_slug} arguments={exc.arguments}", tb=exc.traceback)
        error_context = {
            "tool_slug": exc.tool_slug,
            "arguments": exc.arguments,
            "error_message": exc.error_message,
            "traceback": exc.traceback,
        }
        executed = {"error": error_context}
        continuation_prompt = build_tool_continuation_prompt(tool_call, executed, note, agent_plan)
        agent_output = run_agent_with_prompt(continuation_prompt)
        return jsonify({
            "status": "tool_error",
            "decision": decision,
            "tool_error": error_context,
            "agent_output": agent_output,
        })
    except ToolIntercepted as e:
        print(f"Tool interception detected during continuation: {e.tool_call}")
        return jsonify({
            "intercepted": True,
            "tool_call": e.tool_call,
            "message": "The agent generated a new tool request while continuing after tool execution.",
        })
    except Exception as e:
        traceback.print_exc()
        append_error_log(str(e), context=f"tool_decision tool_call={tool_call}", tb=traceback.format_exc())
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print(f"Starting Gemini Backend with Concurrency Limit: {CONCURRENCY_LIMIT}")
    app.run(port=5000, debug=True)
