"""Make sure English and Ukrainian strings stay in sync."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent / "custom_components" / "battery_log"


def flatten(data, prefix=""):
    keys = set()
    for key, value in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            keys |= flatten(value, path)
        else:
            keys.add(path)
    return keys


def test_integration_translations_match():
    en = json.loads((ROOT / "translations" / "en.json").read_text(encoding="utf-8"))
    uk = json.loads((ROOT / "translations" / "uk.json").read_text(encoding="utf-8"))
    assert flatten(en) == flatten(uk)


def _panel_keys(language: str) -> set[str]:
    source = (ROOT / "frontend" / "battery-log-panel.js").read_text(encoding="utf-8")
    block = re.search(rf"\n  {language}: \{{(.*?)\n  \}},", source, re.S)
    assert block, f"no {language} block in the panel"
    keys = set(re.findall(r"\b([a-z0-9_]+): \"", block.group(1)))
    # plural variants differ per language; compare the base names
    return {re.sub(r"_(one|few|many|other)$", "", key) for key in keys}


def test_panel_translations_match():
    assert _panel_keys("en") == _panel_keys("uk")
    assert len(_panel_keys("en")) > 80


def test_panel_uses_only_known_keys():
    source = (ROOT / "frontend" / "battery-log-panel.js").read_text(encoding="utf-8")
    known = _panel_keys("en")
    used = set(re.findall(r"_t\(\"([a-z0-9_]+)\"", source)) | set(re.findall(r"_plural\(\"([a-z0-9_]+)\"", source))
    used |= set(re.findall(r"label: \"([a-z_]+)\"", source)) | set(re.findall(r"\[\"[a-z_]+\", \"([a-z_]+)\"\]", source))
    used.discard("")
    assert used <= known, used - known
