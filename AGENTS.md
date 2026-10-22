# AGENTS.md

Guidelines for AI agents working on Seraphim 2D.

## Project

Seraphim 2D is a web-only 2D game engine.

- Language: C++23
- Platform layer: SDL3
- Renderer: WebGPU
- Target: WebAssembly via Emscripten (no native builds)
- Editor/UI: React

## Build

Requires the `EMSDK` environment variable pointing to an installed Emscripten SDK.

```sh
cmake --preset web-debug
cmake --build --preset web-debug
```

Use `web-release` for optimized builds. Output goes to `build/<preset>/`.

## Code style

- Keep code clean, minimal, and focused on the task.
- Prefer modern C++23 idioms; avoid raw `new`/`delete`.
- Do not add comments that restate what the code does. Comment only non-obvious intent.
- No dead code, placeholder stubs, or speculative abstractions.
- Match the naming and structure of surrounding code.
- Naming is STL-style `snake_case` for types, functions, variables and namespaces; private/protected members use the `m_` prefix (`m_frame_count`); template parameters are `PascalCase`; macros are `UPPER_CASE`. Enforced by `.clang-tidy`.
- Format with `.clang-format` before committing.

## Git

- Use Conventional Commits: `type(scope): summary`.
  - Types: `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `build`, `ci`, `chore`.
  - Scope is the affected area, e.g. `core`, `log`, `editor`, `cmake`.
  - Summary in English, imperative mood, lowercase, no trailing period, max ~72 characters.
  - Example: `feat(log): add console sink with runtime level filter`.
- Never add AI/Claude attribution, `Co-Authored-By` lines, or generated-by footers to commits or PRs.
- Do not commit build output (`build/`, `cmake-build-*/`) or IDE files.
- Only commit or push when asked.
