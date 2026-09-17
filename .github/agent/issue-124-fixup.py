from pathlib import Path

path = Path(".github/agent/issue-124-green.py")
text = path.read_text(encoding="utf-8")
replacements = [
    (
        '    \'import { buildStudioRouteUrl, type StudioCardKind, type StudioProjectInput } from "./studio-urls";\',',
        '    \'import { isStudioCardAvailable } from "./studio-card-availability";\',',
        1,
    ),
    (
        'import { buildStudioRouteUrl, type StudioCardKind, type StudioProjectInput } from "./studio-urls";\'\'\',',
        'import { isStudioCardAvailable } from "./studio-card-availability";\'\'\',',
        1,
    ),
    (
        '              <label><input type="radio" name="motion"',
        '            <label><input type="radio" name="motion"',
        5,
    ),
    (
        '  const { motion: _motion, ...withoutMotion } = rawConfig();\n'
        '  assert.equal(parseStaticConfig(withoutMotion).motion, "none");',
        '  const withoutMotion = rawConfig();\n'
        '  Reflect.deleteProperty(withoutMotion, "motion");\n'
        '  assert.equal(parseStaticConfig(withoutMotion).motion, "none");',
        1,
    ),
]
for old, new, expected in replacements:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"expected {expected} bootstrap patches, found {count}: {old!r}")
    text = text.replace(old, new)
path.write_text(text, encoding="utf-8")
