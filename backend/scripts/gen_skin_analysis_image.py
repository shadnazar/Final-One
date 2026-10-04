"""One-time: generate an original before/after skin image for the homepage
Skin Analysis card using Gemini Nano Banana, saved to uploads/assets."""
import asyncio
import os
import base64
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

OUT = Path(__file__).resolve().parent.parent / "uploads" / "assets" / "skin-analysis-ai.png"

PROMPT = (
    "A clean clinical split before-and-after beauty photograph of one anonymous "
    "young woman's cheek and face skin, centered, front-facing. LEFT half labelled "
    "feel: dull, uneven tone with a few mild acne spots and visible pores (before). "
    "RIGHT half: the same skin looking clear, smooth, hydrated and radiant (after). "
    "Soft even studio lighting, neutral light background, realistic skin texture, "
    "high quality dermatology marketing style, no text, no watermark, 4:3."
)


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("No EMERGENT_LLM_KEY"); return
    chat = LlmChat(api_key=api_key, session_id="skin-analysis-gen", system_message="You are an image generation API.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    print("text:", (text or "")[:80])
    if not images:
        print("No image returned"); return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = base64.b64decode(images[0]["data"])
    with open(OUT, "wb") as f:
        f.write(data)
    print("Saved:", OUT, len(data), "bytes")


if __name__ == "__main__":
    asyncio.run(main())
