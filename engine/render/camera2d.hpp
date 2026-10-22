#pragma once

#include <glm/mat4x4.hpp>
#include <glm/vec2.hpp>

namespace seraphim::render
{

// World space has y pointing up; one world unit has no fixed pixel size.
struct camera2d
{
    glm::vec2 position{0.0F};
    // World units visible from the bottom to the top of the viewport; the visible width follows the aspect ratio.
    float view_height = 10.0F;

    [[nodiscard]] glm::mat4 view_projection(float aspect) const;
};

} // namespace seraphim::render
