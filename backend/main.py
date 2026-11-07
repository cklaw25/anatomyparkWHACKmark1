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
from schema2 import (VISUALIZE_TOOL, FELLOW_TOOL, TREAT_TOOL, ART_TOOL, FELLOW_NAME, FELLOW_SYSTEM,
                     TREAT_SYSTEM, VIS_SYSTEM, ART_SYSTEM)
import re


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
CHAT_MODEL = os.environ.get("CHAT_MODEL", "claude-haiku-5-5")      # the fellow on the pager (time is paused while chatting)
TREAT_MODEL = os.environ.get("TREAT_MODEL", "claude-opus-5-5")     # ground truth: what a treatment really does
FAST_MODEL = os.environ.get("FAST_MODEL", "claude-haiku-5-5")      # visuals + item art
FAST_OFF = os.environ.get("FAST_THINKING", "off").lower() == "off"
client = anthropic.AsyncAnthropic()
app = FastAPI()
ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_origin_regex=os.environ.get("ALLOWED_ORIGIN_REGEX") or None,
                   allow_methods=["*"], allow_headers=["*"])
CACHE = Path(__file__).with_name("cache")
CACHE.mkdir(exist_ok=True)

# ---- public hosting: seed the case/art pool from the repo, and stop strangers burning the API budget ----
PUBLIC = os.environ.get("PUBLIC", "0") == "1"
SEED = Path(__file__).with_name("seed")
if SEED.exists():
    import shutil
    for src in SEED.rglob("*"):
        dst = CACHE / src.relative_to(SEED)
        if src.is_file() and not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)
IP_LIMIT = int(os.environ.get("IP_LIMIT", "60"))          # AI calls per IP per IP_WINDOW seconds
IP_WINDOW = int(os.environ.get("IP_WINDOW", "600"))
DAILY_CAP = int(os.environ.get("DAILY_CAP", "2000"))      # AI calls per day for the whole site
_hits: dict[str, list[float]] = {}
_day = {"date": "", "n": 0}
AI_PATHS = {"/case", "/stage", "/visualize", "/chat", "/treat", "/art"}


@app.middleware("http")
async def limiter(request, call_next):
    from fastapi.responses import JSONResponse
    if request.method == "POST" and request.url.path in AI_PATHS:
        ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
        now = time.time()
        q = [t for t in _hits.get(ip, []) if now - t < IP_WINDOW]
        today = time.strftime("%Y-%m-%d")
        if _day["date"] != today:
            _day.update(date=today, n=0)
        if len(q) >= IP_LIMIT or _day["n"] >= DAILY_CAP:
            # ok:false -> the game quietly falls back to its offline content
            return JSONResponse({"ok": False, "error": "rate limited: slow down a bit"}, status_code=429,
                                headers={"Access-Control-Allow-Origin": request.headers.get("origin", "*")})
        q.append(now)
        _hits[ip] = q
        _day["n"] += 1
        if len(_hits) > 5000:
            _hits.clear()
    return await call_next(request)


async def call_tool(model: str, tool: dict, user, thinking_off: bool = False, max_tokens: int = 6000, system: str = CASE_SYSTEM) -> dict:
    extra = {"output_config": {"effort": EFFORT}}
    if thinking_off:
        extra["thinking"] = {"type": "disabled"}
    messages = user if isinstance(user, list) else [{"role": "user", "content": user}]
    resp = await client.messages.create(
        model=model, max_tokens=max_tokens,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        tools=[tool], tool_choice={"type": "auto"},
        messages=messages,
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
    return {"ok": True, "public": PUBLIC, "used_today": _day["n"], "case_model": CASE_MODEL, "stage_model": STAGE_MODEL, "chat_model": CHAT_MODEL, "treat_model": TREAT_MODEL, "fellow": FELLOW_NAME, "key_set": bool(os.environ.get("ANTHROPIC_API_KEY"))}


@app.post("/case")
async def get_case(body: dict):
    """Serve a case instantly from the pool of pre-generated Claude cases (Opus takes ~25 s per case),
    and top the pool up in the background. {"fresh": true} forces a live generation."""
    pool = sorted(CACHE.glob("case_*.json"))
    if PUBLIC and pool:
        # public: serve only the pre-generated pool (Opus case writing is the priciest call)
        return {"ok": True, "case": json.loads(random.choice(pool).read_text(encoding="utf-8")), "cached": True}
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


# ======================= v2: House-style loop =======================
ART = CACHE / "art"
ART.mkdir(exist_ok=True)


def ms(t0):
    return round((time.perf_counter() - t0) * 1000)


@app.post("/visualize")
async def visualize(body: dict):
    """Symptoms -> visible effects (the 'image pipeline': Claude picks WHAT shows, our renderer draws it)."""
    t0 = time.perf_counter()
    syms = body.get("symptoms", [])
    lines = "\n".join(f"{i}. site={s.get('site')} : {s.get('text')}" for i, s in enumerate(syms))
    try:
        out = await call_tool(FAST_MODEL, VISUALIZE_TOOL, "Symptoms:\n" + lines, thinking_off=FAST_OFF, max_tokens=2000, system=VIS_SYSTEM)
        return {"ok": True, "items": out["items"], "ms": ms(t0)}
    except Exception as e:  # noqa: BLE001
        print("visualize error:", type(e).__name__, e)
        return {"ok": False, "error": str(e)}


@app.post("/chat")
async def chat(body: dict):
    """The fellow on the pager. He only knows what the lead tells him + the monitor + treatment history (NOT the hidden case)."""
    t0 = time.perf_counter()
    msgs = []
    for h in body.get("history", [])[-14:]:
        role = "assistant" if h.get("role") == "fellow" else "user"
        if msgs and msgs[-1]["role"] == role:
            msgs[-1]["content"] += "\n" + h.get("text", "")
        else:
            msgs.append({"role": role, "content": h.get("text", "")})
    if msgs and msgs[0]["role"] == "assistant":
        msgs.insert(0, {"role": "user", "content": "(the lead pages you)"})
    p = body.get("patient") or {}
    ctx = {"patient": {"name": p.get("name"), "age": p.get("age")}, "clock": body.get("clock"), "monitor_vitals": body.get("vitals"),
           "treatments_given_and_results": body.get("treatments", []), "visible_body_changes": body.get("body_changes", [])}
    note = "\n\n[context, not typed by the lead: " + json.dumps(ctx) + "]"
    if msgs and msgs[-1]["role"] == "user":
        msgs[-1]["content"] += note
    else:
        msgs.append({"role": "user", "content": "(no message)" + note})
    try:
        out = await call_tool(CHAT_MODEL, FELLOW_TOOL, msgs, thinking_off=("haiku" in CHAT_MODEL), max_tokens=2500, system=FELLOW_SYSTEM)
        return {"ok": True, "reply": out, "ms": ms(t0), "model": CHAT_MODEL}
    except Exception as e:  # noqa: BLE001
        print("chat error:", type(e).__name__, e)
        return {"ok": False, "error": str(e)}


@app.post("/treat")
async def treat(body: dict):
    """Ground truth: Claude (knowing the hidden case) decides what the treatment the player physically gave really does."""
    t0 = time.perf_counter()
    case = body.get("case", {})
    hidden = {k: case.get(k) for k in ("root_cause", "root_site", "patient", "day_events", "post_mortem")}
    user = ("HIDDEN CASE: " + json.dumps(hidden) + "\nCURRENT PROBLEMS: " + json.dumps(body.get("symptoms", []))
            + "\nVITALS: " + json.dumps(body.get("vitals", {})) + "\nEARLIER TREATMENTS: " + json.dumps(body.get("history", []))
            + "\nBODY CHANGES SO FAR: " + json.dumps(body.get("body_changes_so_far", []))
            + "\nTREATMENT JUST GIVEN: " + json.dumps(body.get("treatment", {})))
    for model in dict.fromkeys((TREAT_MODEL, FAST_MODEL)):
        try:
            out = await call_tool(model, TREAT_TOOL, user, thinking_off=("haiku" in model), max_tokens=3000, system=TREAT_SYSTEM)
            return {"ok": True, "result": out, "ms": ms(t0), "model": model}
        except Exception as e:  # noqa: BLE001
            print("treat error:", model, type(e).__name__, e)
    return {"ok": False}


def clean_svg(svg: str) -> str:
    m = re.search(r"<svg[\s\S]*?</svg>", svg or "")
    if not m:
        return ""
    s = m.group(0)
    s = re.sub(r"<(script|foreignObject|image|iframe)[\s\S]*?(</\1>|/>)", "", s, flags=re.I)
    s = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*')", "", s, flags=re.I)
    s = re.sub(r"(href|xlink:href)\s*=\s*(\"(?!#)[^\"]*\"|'(?!#)[^']*')", "", s, flags=re.I)
    return s


ART_HOW = {"injection": "a syringe with a needle; tint the liquid to suit the drug", "iv_drip": "an IV fluid bag with a short tube",
           "oral": "a pill, tablet, capsule or small medicine cup", "defibrillator": "a pair of defibrillator paddles with a cable",
           "cpr": "two hands stacked for chest compressions", "surgery": "a scalpel or the right surgical instrument",
           "oxygen": "an oxygen face mask with tubing", "apply": "the pad, bandage, tourniquet or pack it is"}


@app.post("/art")
async def art(body: dict):
    """On-the-spot item art: any treatment the fellow invents gets its own drawn item (cached by name)."""
    t0 = time.perf_counter()
    name, kind = str(body.get("name", "item"))[:60], str(body.get("kind", "apply"))
    slug = re.sub(r"[^a-z0-9]+", "_", f"{kind}_{name}".lower()).strip("_")[:80]
    f = ART / f"{slug}.svg"
    if f.exists():
        return {"ok": True, "svg": f.read_text(encoding="utf-8"), "cached": True}
    try:
        out = await call_tool(FAST_MODEL, ART_TOOL, f"Item: {name}. Draw it as {ART_HOW.get(kind, 'the item')}.",
                              thinking_off=FAST_OFF, max_tokens=3000, system=ART_SYSTEM)
        svg = clean_svg(out.get("svg", ""))
        if not svg:
            raise ValueError("no svg")
        f.write_text(svg, encoding="utf-8")
        return {"ok": True, "svg": svg, "ms": ms(t0)}
    except Exception as e:  # noqa: BLE001
        print("art error:", type(e).__name__, e)
        return {"ok": False}
