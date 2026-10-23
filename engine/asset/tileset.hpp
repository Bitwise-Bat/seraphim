#pragma once

#include "asset/handle.hpp"
#include "asset/texture_handle.hpp"

#include <cstdint>
#include <glm/vec2.hpp>
#include <glm/vec4.hpp>
#include <glm/vector_relational.hpp>
#include <optional>
#include <string>

namespace seraphim::asset
{

// A texture cut into a grid of equally sized tiles, numbered from 1 in reading order, so 0 can mean an empty cell.
struct tileset
{
    // Asset id of the texture.
    std::string texture;
    // Resolved by the asset manager once the tileset loads.
    texture_handle handle;
    // In pixels.
    glm::uvec2 tile_size{1};
    // In pixels, between neighbouring tiles.
    std::uint32_t spacing = 0;
    // In pixels, between the tiles and the edge of the image.
    std::uint32_t margin = 0;

    // Computed from the texture size rather than stored, so the tileset keeps working when the image is resized.
    // Null for tile 0 and for tiles that do not fit in the texture.
    [[nodiscard]] std::optional<glm::vec4> uv_rect(std::uint32_t tile, glm::uvec2 texture_size) const
    {
        if (tile == 0 || glm::any(glm::lessThan(texture_size, (2U * margin) + tile_size)))
            return std::nullopt;

        const glm::uvec2 stride = tile_size + spacing;
        const glm::uvec2 grid = (texture_size - (2U * margin) + spacing) / stride;
        const std::uint32_t index = tile - 1;
        if (index >= grid.x * grid.y)
            return std::nullopt;

        const glm::uvec2 cell{index % grid.x, index / grid.x};
        const glm::vec2 size{texture_size};
        const glm::vec2 min = glm::vec2(margin + (cell * stride)) / size;
        return glm::vec4{min, min + (glm::vec2(tile_size) / size)};
    }
};

using tileset_handle = handle<tileset>;

} // namespace seraphim::asset
