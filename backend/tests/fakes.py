from app.meta_client import MetaAPIError, SamBox


class FakeMeta:
    """Scripted stand-in for MetaClient. Records calls."""

    def __init__(self, detect: dict, verify: dict | None = None, sam: dict | None = None,
                 fail_sam: set[str] | None = None, fail_muse: bool = False):
        self.detect, self.verify = detect, verify or {"decisions": []}
        self.sam = sam or {}
        self.fail_sam = fail_sam or set()
        self.fail_muse = fail_muse
        self.muse_calls: list[str] = []
        self.sam_calls: list[str] = []

    async def muse_json(self, system, text, image_data_url, name, schema):
        self.muse_calls.append(name)
        if self.fail_muse:
            raise MetaAPIError("boom")
        return self.detect if name == "detect" else self.verify

    async def segment(self, image_data_url, prompt):
        self.sam_calls.append(prompt)
        if prompt in self.fail_sam:
            raise MetaAPIError("sam down")
        return [SamBox(tuple(b), c) for b, c in self.sam.get(prompt, [])]


def finding(obj="cardboard box", prompts=("cardboard box",), box=(10, 10, 50, 50), severity="medium"):
    return {
        "object": obj, "observation": "on floor", "evidence": "center", "severity": severity,
        "recommendation": "", "sam_prompts": list(prompts),
        "approx_box": dict(zip(("x1", "y1", "x2", "y2"), box)),
    }
