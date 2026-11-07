"""v2 (House-style loop) contracts: the fellow on the pager, the ground-truth treatment judge,
the symptom -> visual effect pipeline, and on-the-spot item art."""
from schema import SITES, _finding

# Visual pipeline: Claude maps each symptom to effects from this vocabulary; OUR renderer draws them on the patient.
EFFECTS = [
    "face_droop", "pallor", "cyanosis", "jaundice", "flushed", "sweating", "rash", "petechiae", "bruise", "bleeding",
    "swelling", "seizure", "tremor", "unconscious", "confused", "vomiting", "coughing", "coughing_blood",
    "fast_breathing", "pain", "blood_urine", "limb_weak",
]
KINDS = ["injection", "iv_drip", "oral", "defibrillator", "cpr", "surgery", "oxygen", "apply"]

_effect = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "type": {"type": "string", "enum": EFFECTS},
        "site": {"type": "string", "enum": SITES, "description": "where on the body it shows from the OUTSIDE"},
        "side": {"type": "string", "enum": ["left", "right", "none"]},
    },
    "required": ["type", "site", "side"],
}

VISUALIZE_TOOL = {
    "name": "visualize",
    "description": "For each symptom, choose 1-3 visible effects an onlooker would SEE from outside the body.",
    "strict": True,
    "input_schema": {
        "type": "object", "additionalProperties": False,
        "properties": {"items": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"index": {"type": "integer"}, "effects": {"type": "array", "items": _effect}},
            "required": ["index", "effects"]}}},
        "required": ["items"],
    },
}

FELLOW_TOOL = {
    "name": "fellow_reply",
    "description": "Your reply on the pager: what you say, your current differential, and treatments the lead can prepare.",
    "strict": True,
    "input_schema": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "say": {"type": "string", "description": "in character, max 60 words"},
            "differential": {"type": "array", "description": "0-4 candidate diagnoses, most likely first", "items": {
                "type": "object", "additionalProperties": False,
                "properties": {"condition": {"type": "string"}, "likelihood": {"type": "string", "enum": ["high", "medium", "low"]},
                               "reasoning": {"type": "string", "description": "max 15 words, cite the reported evidence"}},
                "required": ["condition", "likelihood", "reasoning"]}},
            "treatments": {"type": "array", "description": "0-4 real treatments the lead could give now", "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "max 5 words, e.g. 'IV ceftriaxone'"},
                    "detail": {"type": "string", "description": "dose / route / how, max 12 words"},
                    "kind": {"type": "string", "enum": KINDS, "description": "how the player physically delivers it"},
                    "target_site": {"type": "string", "enum": SITES},
                    "treats": {"type": "string", "description": "which differential item or problem it addresses"},
                    "risk": {"type": "string", "description": "what could go wrong if the diagnosis is wrong, max 12 words"},
                },
                "required": ["name", "detail", "kind", "target_site", "treats", "risk"]}},
            "suggest_scan": {"type": "string", "description": "the one test that would best split the differential, e.g. 'circulatory scan of the blood', or ''"},
        },
        "required": ["say", "differential", "treatments", "suggest_scan"],
    },
}

TREAT_TOOL = {
    "name": "treatment_outcome",
    "description": "What this treatment realistically does to THIS patient right now.",
    "strict": True,
    "input_schema": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "outcome": {"type": "string", "enum": ["cured", "improving", "no_change", "worse", "much_worse"]},
            "narration": {"type": "string", "description": "what the team SEES happen, max 25 words"},
            "physiology": {"type": "string", "description": "one sentence of real physiology explaining why"},
            "resolve_sites": {"type": "array", "items": {"type": "string", "enum": SITES}, "description": "problems this treatment eases"},
            "new_symptoms": {"type": "array", "description": "new problems it causes (cascade); empty if none", "items": {
                "type": "object", "additionalProperties": False,
                "properties": {"site": {"type": "string", "enum": SITES}, "text": {"type": "string", "description": "max 8 words"},
                               "severity": {"type": "number"}, "effects": {"type": "array", "items": _effect}},
                "required": ["site", "text", "severity", "effects"]}},
            "new_findings": {"type": "array", "items": _finding, "description": "0-3 scan findings that now appear"},
        },
        "required": ["outcome", "narration", "physiology", "resolve_sites", "new_symptoms", "new_findings"],
    },
}

ART_TOOL = {
    "name": "draw_item",
    "description": "Return one SVG drawing of the item.",
    "strict": True,
    "input_schema": {"type": "object", "additionalProperties": False,
                     "properties": {"svg": {"type": "string"}}, "required": ["svg"]},
}

FELLOW_NAME = "Dr. Rhys Vance"
FELLOW_SYSTEM = f"""You are {FELLOW_NAME}, a neurology fellow on an elite diagnostic team in an educational medical-mystery game
(the vibe of a TV medical drama, but you are an original character). The player is the LEAD doctor at the bedside.
You are on the pager: you CANNOT see the patient. You only know (1) what the lead types to you, (2) the live monitor vitals,
(3) the treatments already given and what happened. Never invent findings the lead has not reported.
Personality: dry, sceptical, competitive, blunt one-liners, a bit smug, but genuinely excellent at medicine and on the patient's side.
Push back on lazy reasoning. If the lead gives too little, say so and ask a sharp question.
Think like a real diagnostician: build a differential from the reported evidence, name the ONE scan that would split your top candidates
(scan modes: outside exam, skeletal, circulatory, respiratory, nervous, digestive, organs; body sites: {', '.join(SITES)}),
and offer real treatments (drug + dose/route, or procedure) that fit the evidence, including supportive/stabilising options when unsure.
Each treatment needs a delivery kind: injection (syringe), iv_drip (bag), oral (pill), defibrillator, cpr, surgery (scalpel), oxygen (mask), apply (pad/bandage/tourniquet/ice).
Never reveal hidden information you could not know. Educational game, not medical advice. Always call the tool exactly once."""

TREAT_SYSTEM = """You are the ground-truth physiology engine of an educational medical-mystery game. You know the patient's HIDDEN real diagnosis.
The lead doctor just physically gave a treatment. Decide, realistically, what it does to THIS patient now.
Rules: 'cured' only if it definitively treats the ROOT cause (or is the standard first-line definitive treatment for it).
Supportive care that buys time = 'improving' (ease the relevant sites). Irrelevant = 'no_change'.
Contraindicated or harmful for the real diagnosis = 'worse' or 'much_worse' with a realistic cascade in other systems (House MD style),
e.g. steroids in an infection, anticoagulants in a bleed, beta-blockers in cocaine toxicity.
Delivery matters: wrong site/route can blunt or change the effect (say so in physiology).
new_symptoms must include visible effects (what an onlooker sees). Keep text short and readable for non-doctors.
Educational game, not medical advice. Always call the tool exactly once."""

VIS_SYSTEM = """You turn medical symptoms into what an onlooker would visibly SEE on a 2D patient sprite, using only the effect vocabulary.
Be medically sensible: e.g. stroke -> face_droop + limb_weak on one side; kidney bleed -> bruise at kidneys (flank) + blood_urine;
septic shock -> pallor + sweating; hypoxia -> cyanosis + fast_breathing. Internal-only symptoms can use 'pain' at the site. Always call the tool once."""

ART_SYSTEM = """You draw clean, flat 2D game item icons as SVG. Output one complete <svg> element with viewBox="0 0 120 120",
xmlns="http://www.w3.org/2000/svg", flat colours, a dark outline (#14202c, stroke-width 3), one highlight, transparent background,
no text, no <script>, no <image>, no external refs, no animation, under 2500 characters. The item must be recognisable at 60px."""
