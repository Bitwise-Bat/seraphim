#pragma once

#include "asset/tileset.hpp"

#include <expected>
#include <string>
#include <string_view>

namespace seraphim::asset
{

// Reads the tileset JSON format: {"texture", "tile_size": [width, height], "spacing", "margin"}, sizes in pixels.
[[nodiscard]] std::expected<tileset, std::string> parse_tileset(std::string_view json);

} // namespace seraphim::asset
