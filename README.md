# Seraphim 2D

A web-first 2D game engine built in C++23, compiled to WebAssembly with WebGPU rendering and an in-browser React editor.

## Architecture

- **Engine (`engine/`)**: C++23 core compiled to WebAssembly via Emscripten. Uses SDL3 for windowing/input, WebGPU (`emdawnwebgpu`) for rendering, Box2D for physics, EnTT for ECS, and JPS for tilemap pathfinding.
- **Editor (`editor/`)**: Web editor built with React, Zustand, and Vite. Interacts directly with local project directories via the File System Access API.
- **Runtime (`runtime/`)**: Shared world API and script host for running gameplay scripts in the editor, in standalone builds, and on the headless server.
- **Server (`server/`)**: Headless Node.js server runner using the same C++ simulation core (`seraphim_sim`) for multiplayer networking.

## Prerequisites

- **Emscripten SDK**: `EMSDK` environment variable set.
- **vcpkg**: `VCPKG_ROOT` environment variable set (provides Box2D, EnTT, GLM, nlohmann-json).
- **CMake**: 3.25+ with Ninja.
- **Node.js**: 20+ and npm.
- **Browser**: Chromium-based browser (Chrome, Edge, Brave, Opera) with WebGPU enabled. The editor uses the File System Access API (`showDirectoryPicker`), which is currently unsupported in Firefox and Safari.

## Building the Engine

Configure and compile the WebAssembly runtime:

```sh
# Debug build (output goes to build/web-debug/)
cmake --preset web-debug
cmake --build --preset web-debug

# Optimized release build (output goes to build/web-release/)
cmake --preset web-release
cmake --build --preset web-release
```

## Running the Editor

```sh
cd editor
npm install
npm run dev
```

Open the printed localhost URL in a Chromium-based browser.

To build the editor for production:

```sh
cd editor
npm run build
```

## Running the Dedicated Server

The headless server runs compiled server scripts and syncs world state across clients:

```sh
cd server
npm install
npm start -- <path/to/project/folder>
```

## Project Format

Each game project created or opened in the editor is a folder on disk with the following layout:

```text
my-game/
├── project.json       # Project manifest and format version
├── assets/            # Sprites, audio, tilesets, animations (with .meta files)
├── scripts/           # TypeScript game scripts extending seraphim.Script
├── scenes/            # Scene definitions (main.scene.json)
└── .seraphim/         # Generated type declarations and server bundle (gitignored)
```

Scripts use modern TypeScript and import `seraphim` for entity manipulation, physics bodies, animation, audio, and UI overlays.

## Web Export

The editor includes an **Export** button in the main toolbar. Clicking it bundles:

- Optimized release WebAssembly engine (`seraphim.wasm`, `seraphim.js`)
- Standalone HTML5 player (`index.html`, `player.js`)
- Compiled script bundle (`scripts.bundle.js` via esbuild-wasm)
- Scene definition (`scene.json`) and asset manifest (`manifest.json`)
- All project assets (`assets/`)

into a single `<project_name>-web.zip` file ready to deploy directly to itch.io or any static web server.
