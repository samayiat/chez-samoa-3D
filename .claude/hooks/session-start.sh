#!/bin/bash
# SessionStart hook: install the vendored `img2threejs` skill into the user's
# skills dir so `/img2threejs` is available. Runs synchronously (no {"async":true})
# so it finishes BEFORE the session discovers skills. Idempotent, non-interactive,
# and failure-tolerant — a problem here must never block session start.
#
# The skill itself is vendored at tools/img2threejs/ (committed); this just mirrors
# it into ~/.claude/skills/ (which is ephemeral in the remote environment) each
# session and refreshes its manifest entry.

# Never let this hook fail the session: log to stderr, always exit 0.
{
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
  SRC="$PROJECT_DIR/tools/img2threejs"
  SKILLS_DIR="$HOME/.claude/skills"
  DEST="$SKILLS_DIR/img2threejs"

  if [ ! -f "$SRC/SKILL.md" ]; then
    echo "[img2threejs hook] vendored skill not found at $SRC — skipping" >&2
  else
    mkdir -p "$SKILLS_DIR"
    # exact mirror (overwrite-safe / idempotent)
    rm -rf "$DEST"
    cp -R "$SRC" "$DEST"
    echo "[img2threejs hook] installed skill -> $DEST" >&2

    # Upsert the manifest entry (name/description read from SKILL.md frontmatter).
    # Harmless if the harness owns/regenerates the manifest; makes the skill
    # register if it does not.
    python3 - "$SKILLS_DIR/manifest.json" "$DEST/SKILL.md" >&2 <<'PY' || echo "[img2threejs hook] manifest upsert skipped" >&2
import json, os, sys
manifest_path, skill_md = sys.argv[1], sys.argv[2]

# parse the leading YAML frontmatter (--- ... ---) for name/description
name, desc = "img2threejs", ""
try:
    with open(skill_md, "r", encoding="utf-8") as f:
        text = f.read()
    if text.startswith("---"):
        fm = text.split("---", 2)[1]
        for line in fm.splitlines():
            if line.startswith("name:"):
                name = line.split(":", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("description:"):
                desc = line.split(":", 1)[1].strip().strip('"').strip("'")
except Exception as e:
    print("[img2threejs hook] could not parse SKILL.md frontmatter:", e)

data = {"lastUpdated": 0, "skills": []}
if os.path.exists(manifest_path):
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {"lastUpdated": 0, "skills": []}
if not isinstance(data.get("skills"), list):
    data["skills"] = []

entry = {"skillId": name, "name": name, "description": desc, "source": "vendored"}
skills = [s for s in data["skills"] if s.get("skillId") != name]
skills.append(entry)
data["skills"] = skills

with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
print("[img2threejs hook] manifest upserted:", name)
PY
  fi
}

# stdout is left clean on purpose (SessionStart stdout is injected into the session
# as context); all diagnostics above go to stderr. Always succeed.
exit 0
