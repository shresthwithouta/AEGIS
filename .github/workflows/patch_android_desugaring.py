#!/usr/bin/env python3
"""
Enables Java 8+ core library desugaring in the freshly `flutter create`-d
Android project, and adds the desugar_jdk_libs dependency.

flutter_local_notifications requires this below API 26; a bare `flutter
create` scaffold does not turn it on. Handles both Gradle DSLs Flutter's
template has shipped (Groovy `build.gradle` and Kotlin `build.gradle.kts`)
by anchoring on the `android {` / `dependencies {` block openers, which are
spelled identically in both.

Run from mobile/ with android/ already scaffolded:
    python3 ../.github/workflows/patch_android_desugaring.py
"""
import re
import sys
from pathlib import Path

DESUGAR_VERSION = "2.1.4"

app_dir = Path("android/app")
groovy = app_dir / "build.gradle"
kotlin = app_dir / "build.gradle.kts"

if kotlin.exists():
    path, is_kts = kotlin, True
elif groovy.exists():
    path, is_kts = groovy, False
else:
    sys.exit(f"No android/app/build.gradle(.kts) found under {app_dir.resolve()} — was `flutter create` run first?")

text = path.read_text(encoding="utf-8")

if "coreLibraryDesugaring" in text or "isCoreLibraryDesugaringEnabled" in text:
    print(f"{path}: desugaring already configured, leaving as-is.")
    sys.exit(0)

if is_kts:
    compile_options_block = (
        "\n    compileOptions {\n"
        "        isCoreLibraryDesugaringEnabled = true\n"
        "    }\n"
    )
    dependency_line = f'    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:{DESUGAR_VERSION}")\n'
else:
    compile_options_block = (
        "\n    compileOptions {\n"
        "        coreLibraryDesugaringEnabled true\n"
        "    }\n"
    )
    dependency_line = f"    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:{DESUGAR_VERSION}'\n"

# Insert the compileOptions block right after the top-level `android {` opener.
android_match = re.search(r"\bandroid\s*\{", text)
if not android_match:
    sys.exit(f"{path}: could not find an `android {{` block to patch.")
insert_at = android_match.end()
text = text[:insert_at] + compile_options_block + text[insert_at:]

# Add the dependency inside the `dependencies { ... }` block if one exists,
# otherwise append a new one at the end of the file.
deps_match = re.search(r"\bdependencies\s*\{", text)
if deps_match:
    insert_at = deps_match.end()
    text = text[:insert_at] + "\n" + dependency_line + text[insert_at:]
else:
    text += "\ndependencies {\n" + dependency_line + "}\n"

path.write_text(text, encoding="utf-8")
print(f"{path}: desugaring enabled, desugar_jdk_libs {DESUGAR_VERSION} added.")
