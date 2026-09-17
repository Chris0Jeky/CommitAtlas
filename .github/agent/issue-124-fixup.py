from pathlib import Path

script_path = Path(".github/agent/issue-124-green.py")
script = script_path.read_text(encoding="utf-8")
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
]
for old, new, expected in replacements:
    count = script.count(old)
    if count != expected:
        raise RuntimeError(f"expected {expected} bootstrap patches, found {count}: {old!r}")
    script = script.replace(old, new)
script_path.write_text(script, encoding="utf-8")

static_test_path = Path("packages/static/tests/static.test.mjs")
static_test = static_test_path.read_text(encoding="utf-8")
old_default_check = '''  const { motion: _motion, ...withoutMotion } = rawConfig();
  assert.equal(parseStaticConfig(withoutMotion).motion, "none");'''
new_default_check = '''  const withoutMotion = rawConfig();
  Reflect.deleteProperty(withoutMotion, "motion");
  assert.equal(parseStaticConfig(withoutMotion).motion, "none");'''
count = static_test.count(old_default_check)
if count != 1:
    raise RuntimeError(f"expected one static default-motion test patch, found {count}")
static_test_path.write_text(static_test.replace(old_default_check, new_default_check), encoding="utf-8")
