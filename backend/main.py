"""ANATOMY PARK backend: Claude is the medical brain (cases + cascades); the browser runs the live body simulation.
Run (from backend/):  python -m uvicorn main:app --port 8010
"""
import asyncio
import json
import os
import random
import time
from pathlib import Path

import anthropic
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schema import CASE_TOOL, STAGE_TOOL, CASE_SYSTEM


def load_env():
    env = Path(__file__).with_name(".env")
    if env.exists():
        for line in env.read_text(encoding="utf-8-sig").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


load_env()
CASE_MODEL = os.environ.get("CASE_MODEL", "claude-opus-5-5")
STAGE_MODEL = os.environ.get("STAGE_MODEL", "claude-haiku-5-5")
EFFORT = os.environ.get("EFFORT", "low")
STAGE_THINKING_OFF = os.environ.get("STAGE_THINKING", "on").lower() == "off"
client = anthropic.AsyncAnthropic()
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
CACHE = Path(__file__).with_name("cache")
CACHE.mkdir(exist_ok=True)


async def call_tool(model: str, tool: dict, user: str, thinking_off: bool = False, max_tokens: int = 6000) -> dict:
    extra = {"output_config": {"effort": EFFORT}}
    if thinking_off:
        extra["thinking"] = {"type": "disabled"}
    resp = await client.messages.create(
        model=model, max_tokens=max_tokens,
        system=[{"type": "text", "text": CASE_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        tools=[tool], tool_choice={"type": "auto"},
        messages=[{"role": "user", "content": user}],
        extra_body=extra,
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("refused")
    for b in resp.content:
        if b.type == "tool_use" and b.name == tool["name"]:
            return dict(b.input)
    raise ValueError("no tool call")


@app.get("/health")
async def health():
    return {"ok": True, "case_model": CASE_MODEL, "stage_model": STAGE_MODEL, "key_set": bool(os.environ.get("ANTHROPIC_API_KEY"))}


@app.post("/case")
async def get_case(body: dict):
    """Serve a case instantly from the pool of pre-generated Claude cases (Opus takes ~25 s per case),
    and top the pool up in the background. {"fresh": true} forces a live generation."""
    pool = sorted(CACHE.glob("case_*.json"))
    if pool and not body.get("fresh"):
        if len(pool) < 12:
            asyncio.create_task(generate_case({}))
        case = json.loads(random.choice(pool).read_text(encoding="utf-8"))
        return {"ok": True, "case": case, "cached": True}
    return await generate_case(body)


async def generate_case(body: dict):
    t0 = time.perf_counter()
    theme = body.get("theme") or random.choice([
        "a clot", "a bacterial infection that spreads", "a viral infection mistaken for bacterial", "a tear or rupture",
        "a genetic condition reactivating", "an endocrine emergency", "a drug interaction", "an autoimmune flare", "a toxic exposure",
    ])
    try:
        case = await call_tool(CASE_MODEL, CASE_TOOL, f"Create a new case. Theme: {theme}. Patient is a university student or young adult unless the condition needs otherwise.")
        case["_source"] = CASE_MODEL
        name = f"case_{int(time.time())}.json"
        (CACHE / name).write_text(json.dumps(case, indent=1), encoding="utf-8")
        return {"ok": True, "case": case, "ms": round((time.perf_counter() - t0) * 1000)}
    except Exception as e:  # noqa: BLE001 - the game falls back to built-in cases
        print("case error:", type(e).__name__, e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


@app.post("/stage")
async def next_stage(body: dict):
    """A wrong treatment was given: evolve the case realistically (the cascade) and offer new options."""
    t0 = time.perf_counter()
    case = body.get("case", {})
    summary = {
        "root_cause": case.get("root_cause"), "root_site": case.get("root_site"), "patient": case.get("patient"),
        "treatments_given": body.get("given", []), "active_symptoms": body.get("symptoms", []), "vitals": body.get("vitals", {}),
    }
    try:
        st = await call_tool(STAGE_MODEL, STAGE_TOOL, "The player just gave a WRONG treatment. Current situation:\n" + json.dumps(summary),
                             thinking_off=STAGE_THINKING_OFF, max_tokens=3000)
        return {"ok": True, "stage": st, "ms": round((time.perf_counter() - t0) * 1000), "model": STAGE_MODEL}
    except Exception as e:  # noqa: BLE001
        print("stage error:", type(e).__name__, e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
