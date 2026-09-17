from pathlib import Path

path = Path(".github/agent/issue-124-green.py")
text = path.read_text(encoding="utf-8")
replacements = [
    (
        '    \'import { buildStudioRouteUrl, type StudioCardKind, type StudioProjectInput } from "./studio-urls";\',',
        '    \'import { isStudioCardAvailable } from "./studio-card-availability";\',',
    ),
    (
        'import { buildStudioRouteUrl, type StudioCardKind, type StudioProjectInput } from "./studio-urls";\'\'\',',
        'import { isStudioCardAvailable } from "./studio-card-availability";\'\'\',',
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected one Studio Markdown bootstrap patch, found {count}: {old!r}")
    text = text.replace(old, new)
path.write_text(text, encoding="utf-8")
