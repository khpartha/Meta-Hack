"""Muse Spark + SAM 3.1 calls via the Meta Model API (OpenAI-compatible).

Request formats follow https://dev.meta.ai/docs/sam/segmenting and
https://dev.meta.ai/docs/sam/reading-segmentation (see scripts/test_api.py).
"""

import json
import re
from dataclasses import dataclass
from typing import Optional

from openai import AsyncOpenAI

from . import config

# One SAM record: "<id><|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..[;c=..]|><|mask;...|>".
# Box coords are source pixels; wire x2/y2 are inclusive.
BOX_RE = re.compile(
    r"(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>"
)


class MetaAPIError(RuntimeError):
    """A Meta API call failed or returned something we can't use."""


@dataclass
class SamBox:
    box: tuple[int, int, int, int]  # half-open [x1, y1, x2, y2] in the image sent to SAM
    confidence: Optional[float]


def parse_sam_output(raw: str) -> list[SamBox]:
    out = []
    for m in BOX_RE.finditer(raw or ""):
        _, x1, y1, x2, y2, _w, _h, conf = m.groups()
        out.append(
            SamBox(
                box=(int(x1), int(y1), int(x2) + 1, int(y2) + 1),
                confidence=float(conf) if conf else None,
            )
        )
    return out


class MetaClient:
    def __init__(self, api_key: str | None = None):
        key = api_key or config.META_API_KEY
        if not key:
            raise MetaAPIError("META_API_KEY is not set in backend/.env")
        self._client = AsyncOpenAI(
            base_url=config.META_BASE_URL,
            api_key=key,
            timeout=config.REQUEST_TIMEOUT_S,
            max_retries=2,
        )

    async def muse_json(self, system: str, text: str, image_data_url: str, name: str, schema: dict) -> dict:
        """One Muse Spark call with an image, constrained to a JSON schema."""
        try:
            resp = await self._client.chat.completions.create(
                model=config.REASONING_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": text},
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                        ],
                    },
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": name, "schema": schema, "strict": True},
                },
            )
            return json.loads(resp.choices[0].message.content)
        except json.JSONDecodeError as e:
            raise MetaAPIError(f"Muse returned invalid JSON for {name}: {e}") from e
        except Exception as e:  # openai.APIError and network errors
            raise MetaAPIError(f"Muse call '{name}' failed: {e}") from e

    async def segment(self, image_data_url: str, prompt: str) -> list[SamBox]:
        """SAM 3.1 text-prompted segmentation. Returns every matching instance."""
        try:
            resp = await self._client.responses.create(
                model=config.SAM_MODEL,
                input=[
                    {
                        "type": "message",
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": prompt},
                            {"type": "input_image", "image_url": image_data_url},
                        ],
                    }
                ],
                metadata={"mask_encoding": "one_bit", "include_confidence": "true"},
            )
        except Exception as e:
            raise MetaAPIError(f"SAM call '{prompt}' failed: {e}") from e
        return parse_sam_output(resp.output_text)
