import json

from openai import OpenAI
from pydantic import ValidationError

from .schemas import DigestContent


def generate_digest_content(
    api_key: str,
    org_name: str,
    period_start: str,
    period_end: str,
    feedback_items: list[str],
) -> DigestContent:
    """Call OpenAI to synthesize feedback into a structured digest.

    Raises json.JSONDecodeError or pydantic.ValidationError if the model
    returns malformed output — callers should map these to HTTP 502.
    """
    client = OpenAI(api_key=api_key)

    if feedback_items:
        feedback_text = "\n---\n".join(feedback_items)
    else:
        feedback_text = "(No feedback was submitted during this period.)"

    system = (
        "You are an expert at synthesizing employee or customer feedback into "
        "constructive, actionable organizational digests. "
        "Always respond with a single valid JSON object matching the schema provided. "
        "Never include markdown code fences, prose, or any text outside the JSON object."
    )

    user = (
        f"You have received {len(feedback_items)} piece(s) of feedback for the organization "
        f'"{org_name}" covering the period {period_start} to {period_end}.\n\n'
        f"Feedback items:\n{feedback_text}\n\n"
        "Produce a digest as a JSON object with exactly these keys:\n"
        "{\n"
        '  "summary": "<2-4 sentence overview, neutral and constructive tone>",\n'
        '  "insights": ["<insight under 20 words>", ...],\n'
        '  "immediate_actions": ["<concrete action achievable within weeks>", ...],\n'
        '  "long_term_goals": ["<strategic goal achievable over months>", ...]\n'
        "}\n\n"
        "Rules:\n"
        "- insights: 3-6 items\n"
        "- immediate_actions: 2-4 items\n"
        "- long_term_goals: 2-4 items\n"
        "- Never attribute feedback to specific individuals\n"
        "- Frame negatives as improvement opportunities\n"
        "- If there is no feedback, note that in the summary and provide placeholder guidance"
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1500,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if the model ignores the instruction
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    parsed = json.loads(raw)  # raises json.JSONDecodeError on bad output
    return DigestContent(**parsed)  # raises pydantic.ValidationError on schema mismatch
