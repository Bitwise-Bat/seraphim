#pragma once

#include "asset/animation_set.hpp"

#include <expected>
#include <string>
#include <string_view>

namespace seraphim::asset
{

// Reads the animation set JSON format: {"clips": [{"name", "frames": [[u0, v0, u1, v1], ...], "frame_duration",
// "loop"}]}.
[[nodiscard]] std::expected<animation_set, std::string> parse_animation_set(std::string_view json);

} // namespace seraphim::asset
