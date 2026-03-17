import json

from openai import OpenAI
from pydantic import ValidationError

from .schemas import DigestContent

STYLE_PROMPTS = {
    "shorten": "Shorten this into a concise public review (2-3 sentences max). Keep the core message.",
    "polish": "Rewrite this as a polished, natural-sounding public review. Keep the author's genuine opinion.",
    "simplify": "Simplify this into plain, clear language suitable for a public review.",
}


def polish_review(api_key: str, content: str, style: str) -> str:
    """Transform feedback text into a public review draft using the requested style."""
    client = OpenAI(api_key=api_key)

    style_instruction = STYLE_PROMPTS.get(style, STYLE_PROMPTS["polish"])

    system = (
        "You help people turn their private feedback into public reviews. "
        "You preserve their honest opinion — positive, negative, or mixed. "
        "Never add praise that wasn't in the original. Never remove criticism. "
        "Return only the review text, no preamble, no quotes, no explanation."
    )

    user = f"{style_instruction}\n\nOriginal feedback:\n{content}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=500,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )

    return response.choices[0].message.content.strip()


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
        "You are an assistant that synthesizes employee or customer feedback into structured digests. "
        "Your output must be grounded strictly in the feedback provided — do not invent insights, "
        "actions, or themes that are not clearly supported by the actual feedback text. "
        "If the feedback is absent, too sparse, or too vague to support meaningful conclusions, "
        "say so honestly rather than fabricating content. "
        "Always respond with a single valid JSON object. "
        "Never include markdown code fences, prose, or any text outside the JSON object."
    )

    user = (
        f"Feedback for organization \"{org_name}\" ({period_start} to {period_end}):\n\n"
        f"{feedback_text}\n\n"
        "Produce a digest JSON object with exactly these keys:\n"
        "{\n"
        '  "summary": "<honest 1-3 sentence overview based only on what was actually said>",\n'
        '  "insights": ["<insight directly supported by the feedback>", ...],\n'
        '  "immediate_actions": ["<action clearly warranted by the feedback>", ...],\n'
        '  "long_term_goals": ["<strategic goal supported by the feedback>", ...]\n'
        "}\n\n"
        "Critical rules:\n"
        "- Only include insights, actions, and goals that are directly supported by the feedback text\n"
        "- If there is no feedback, or the feedback is too vague to draw conclusions from, "
        "set summary to explain this honestly and set insights, immediate_actions, and long_term_goals to empty arrays []\n"
        "- Never invent themes, problems, or recommendations not present in the actual feedback\n"
        "- Never attribute feedback to specific individuals\n"
        "- insights: 0-6 items depending on what the feedback actually supports\n"
        "- immediate_actions: 0-4 items\n"
        "- long_term_goals: 0-4 items"
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
