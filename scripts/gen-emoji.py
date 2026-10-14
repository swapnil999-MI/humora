#!/usr/bin/env python3
"""Builds the Pulse emoji picker data from Unicode's emoji-test.txt.

Usage: python3 scripts/gen-emoji.py [path/to/emoji-test.txt]
Without a path it downloads the pinned Unicode version. Writes:
  web/src/pulse/emojiData.json
  android/app/src/main/assets/emoji.json
Each is [{"group": "...", "emojis": [["😀", "grinning face"], ...]}, ...]: fully-qualified
emojis only, without skin-tone variants and without the "Component" group.
"""
import json
import os
import sys
import urllib.request

UNICODE_VERSION = "15.1"  # widely supported by current browsers, iOS, Android and Windows
URL = f"https://unicode.org/Public/emoji/{UNICODE_VERSION}/emoji-test.txt"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUTS = [
    os.path.join(ROOT, "web", "src", "pulse", "emojiData.json"),
    os.path.join(ROOT, "android", "app", "src", "main", "assets", "emoji.json"),
]


def main() -> None:
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            text = f.read()
    else:
        with urllib.request.urlopen(URL, timeout=30) as r:
            text = r.read().decode("utf-8")

    groups: list[dict] = []
    for line in text.splitlines():
        if line.startswith("# group:"):
            name = line.split(":", 1)[1].strip()
            groups.append({"group": name, "emojis": []})
            continue
        if not line or line.startswith("#") or not groups:
            continue
        data, _, comment = line.partition("#")
        if "; fully-qualified" not in data:
            continue
        # comment: " 😀 E1.0 grinning face"
        parts = comment.strip().split(" ", 2)
        if len(parts) < 3:
            continue
        char, name = parts[0], parts[2]
        if "skin tone" in name:
            continue
        groups[-1]["emojis"].append([char, name])

    groups = [g for g in groups if g["group"] != "Component" and g["emojis"]]
    for out in OUTPUTS:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(groups, f, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(g["emojis"]) for g in groups)
    print(f"{total} emojis in {len(groups)} groups (Unicode {UNICODE_VERSION}) -> {', '.join(OUTPUTS)}")


if __name__ == "__main__":
    main()
