#pragma once

#include "asset/texture_handle.hpp"

#include <glm/vec2.hpp>
#include <glm/vec4.hpp>
#include <string>

namespace seraphim::render
{

struct sprite
{
    asset::texture_handle texture;
    // Center of the sprite in world units.
    glm::vec2 position{0.0F};
    glm::vec2 size{1.0F};
    // Counter-clockwise, in radians.
    float rotation = 0.0F;
    // Texture region as (min u, min v, max u, max v), with v = 0 at the top row of the image.
    glm::vec4 uv_rect{0.0F, 0.0F, 1.0F, 1.0F};
    glm::vec4 color{1.0F};
};

} // namespace seraphim::render
