"""The structured contract between Claude (medical knowledge) and the game engine (simulation).
Claude never moves numbers directly: it names sites, findings and treatments; the engine turns severity into vitals."""

SITES = [
    "brain", "spinal_cord", "thyroid", "heart", "lungs", "liver", "stomach", "pancreas",
    "intestines", "kidneys", "bladder", "blood", "bone_marrow", "left_leg", "right_leg", "skin", "joints",
]
SYSTEMS = ["skeletal", "circulatory", "respiratory", "nervous", "digestive", "organs"]

_finding = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "site": {"type": "string", "enum": SITES},
        "system": {"type": "string", "enum": SYSTEMS, "description": "which scan mode reveals it"},
        "result": {"type": "string", "description": "what the test shows, max 12 words, plain English + 1 medical term"},
        "key": {"type": "boolean", "description": "true if this finding points to the real root cause"},
    },
    "required": ["site", "system", "result", "key"],
}
_symptom = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "site": {"type": "string", "enum": SITES},
        "text": {"type": "string", "description": "what the patient feels or shows, max 8 words"},
        "severity": {"type": "number", "description": "0.1 to 1.0"},
    },
    "required": ["site", "text", "severity"],
}
_treatment = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "name": {"type": "string", "description": "max 5 words, e.g. 'Anticoagulant (blood thinner)'"},
        "correct": {"type": "boolean"},
        "why": {"type": "string", "description": "one sentence: why it is right or why it backfires, real physiology"},
        "if_wrong_cascade": {
            "type": "array", "items": _symptom,
            "description": "if wrong: the NEW problems it realistically causes in OTHER systems (House MD style). empty if correct",
        },
        "attending_line": {"type": "string", "description": "sarcastic one-liner from the attending doctor reacting to this choice, max 16 words"},
    },
    "required": ["name", "correct", "why", "if_wrong_cascade", "attending_line"],
}

CASE_TOOL = {
    "name": "create_case",
    "description": "Create one hidden medical case for the game: a believable patient day, a root cause, findings per body system, and treatment choices with realistic cascades.",
    "strict": True,
    "input_schema": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "root_cause": {"type": "string", "description": "the real diagnosis, e.g. 'Pulmonary embolism from a DVT'"},
            "root_site": {"type": "string", "enum": SITES},
            "patient": {
                "type": "object", "additionalProperties": False,
                "properties": {"name": {"type": "string"}, "age": {"type": "integer"}, "background": {"type": "string", "description": "max 15 words incl. any relevant history or genetic condition"}},
                "required": ["name", "age", "background"],
            },
            "day_events": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": False,
                          "properties": {"time": {"type": "string", "description": "HH:MM between 07:00 and 17:00"}, "text": {"type": "string", "description": "max 5 words"}, "clue": {"type": "boolean"}},
                          "required": ["time", "text", "clue"]},
                "description": "5-6 things the patient did today; 1-2 are subtle clues to the cause",
            },
            "initial_symptoms": {"type": "array", "items": _symptom, "description": "2-3 symptoms at onset; at least one is in a DIFFERENT site from the root (misleading)"},
            "findings": {"type": "array", "items": _finding, "description": "8-12 test results across different sites and scan modes; 3-4 key, the rest red herrings or normal-but-useful"},
            "treatments": {"type": "array", "items": _treatment, "description": "exactly 4 options, exactly 1 correct, the wrong ones are tempting"},
            "post_mortem": {"type": "string", "description": "2 sentences: what really happened and the clue a good doctor would have caught"},
        },
        "required": ["root_cause", "root_site", "patient", "day_events", "initial_symptoms", "findings", "treatments", "post_mortem"],
    },
}

STAGE_TOOL = {
    "name": "next_stage",
    "description": "After a WRONG treatment, evolve the case: new test findings that now appear and 4 new treatment options.",
    "strict": True,
    "input_schema": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "new_findings": {"type": "array", "items": _finding, "description": "3-5 findings caused by the cascade or newly revealed"},
            "treatments": {"type": "array", "items": _treatment, "description": "exactly 4 options for the CURRENT state, exactly 1 correct (it must also address the root cause)"},
            "attending_line": {"type": "string", "description": "one live line from the attending about the cascade, max 16 words"},
        },
        "required": ["new_findings", "treatments", "attending_line"],
    },
}

CASE_SYSTEM = """You design medical-mystery cases for an educational 2D game inspired by House MD.
The player is a tiny medic inside a patient's body. They switch scan modes (skeletal, circulatory, respiratory, nervous, digestive, organs),
travel to sites, run tests, and pick a treatment. Wrong treatments cause realistic cascades in other body systems.
Rules: be medically accurate (real physiology, real drugs and their side effects), but keep text short and readable for non-doctors.
Make it a fair mystery: the day_events and key findings must let a careful player deduce the root cause.
Vary conditions: infections, clots, tears/ruptures, endocrine, autoimmune, metabolic, toxic, and known genetic conditions reactivating (e.g. sickle cell crisis, G6PD, cystic fibrosis exacerbation).
This is a game for education, not medical advice. Always call the provided tool exactly once."""
