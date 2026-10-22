#pragma once

#include "asset/texture_handle.hpp"

#include <cstdint>
#include <glm/vec2.hpp>
#include <glm/vec4.hpp>
#include <string>

namespace seraphim::scene
{

// Every entity has one. The id is a UUID that stays the same across saves, so scene files and the editor can refer to
// entities while their runtime handles change on every load.
struct identity
{
    std::string id;
    std::string name;
};

struct transform
{
    glm::vec2 position{0.0F};
    // Counter-clockwise, in radians.
    float rotation = 0.0F;
    glm::vec2 scale{1.0F};
};

struct sprite
{
    // Asset id of the texture.
    std::string texture;
    // Resolved from the asset id on first draw, since the asset manager only exists once the GPU is ready.
    asset::texture_handle handle;
    // In world units, before the transform's scale.
    glm::vec2 size{1.0F};
    // Texture region as (min u, min v, max u, max v), with v = 0 at the top row of the image.
    glm::vec4 uv_rect{0.0F, 0.0F, 1.0F, 1.0F};
    glm::vec4 color{1.0F};
    // Lower orders are drawn first, so higher ones end up on top.
    std::int32_t order = 0;
};

} // namespace seraphim::scene
