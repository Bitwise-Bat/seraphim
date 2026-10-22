#pragma once

#include "scene/scene.hpp"

#include <expected>
#include <string>
#include <string_view>

namespace seraphim::scene
{

// Reads and writes the *.scene.json format. The host passes file contents in and out, so the engine never touches the
// file system and runs the same in the editor, an exported game or a server.
[[nodiscard]] std::expected<scene, std::string> parse_scene(std::string_view json);
[[nodiscard]] std::string serialize_scene(const scene& scene);

} // namespace seraphim::scene
