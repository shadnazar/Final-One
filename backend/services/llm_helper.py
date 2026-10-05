"""Shared LLM text helper.

Uses the DIRECT Gemini API key (GEMINI_API_KEY) by default — this works from the
deployed app. Falls back to the Emergent universal key only when no Gemini key is
present. This keeps every AI text feature working in production.
"""
import os
import asyncio
import logging
import uuid as _uuid

logger = logging.getLogger(__name__)

GEMINI_TEXT_MODEL = os.environ.get("GEMINI_TEXT_MODEL", "gemini-flash-latest")


async def llm_text(prompt: str, system: str = "") -> str:
    """Generate text. Prefers the direct Gemini key; falls back to Emergent.

    Returns the model's text response (string).
    """
    gkey = os.environ.get("GEMINI_API_KEY", "")
    if gkey:
        from google import genai
        client = genai.Client(api_key=gkey)
        contents = (system.strip() + "\n\n" + prompt) if system else prompt
        # Try the configured model, then known-good fallbacks (model names vary
        # by project/region — e.g. gemini-2.5-flash is unavailable to some keys).
        candidates = []
        for m in (GEMINI_TEXT_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"):
            if m and m not in candidates:
                candidates.append(m)
        for model in candidates:
            try:
                def _gen():
                    return client.models.generate_content(model=model, contents=contents)

                resp = await asyncio.to_thread(_gen)
                text = getattr(resp, "text", "") or ""
                if text:
                    return text
            except Exception as e:
                logger.warning(f"[llm] Gemini '{model}' failed: {str(e)[:110]}")
                continue

    ek = os.environ.get("EMERGENT_LLM_KEY", "")
    if ek:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=ek,
            session_id=f"llm-{_uuid.uuid4().hex[:8]}",
            system_message=system or "You are a helpful assistant.",
        )
        chat.with_model("gemini", GEMINI_TEXT_MODEL)
        return await chat.send_message(UserMessage(text=prompt))

    raise ValueError("No LLM key configured (set GEMINI_API_KEY or EMERGENT_LLM_KEY)")
