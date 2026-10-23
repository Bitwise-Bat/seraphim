#pragma once

#include <glm/mat4x4.hpp>
#include <glm/vec2.hpp>

namespace seraphim::render
{

// An axis-aligned area of world space.
struct bounds
{
    glm::vec2 min{0.0F};
    glm::vec2 max{0.0F};
};

// World space has y pointing up; one world unit has no fixed pixel size.
struct camera2d
{
    glm::vec2 position{0.0F};
    // World units visible from the bottom to the top of the viewport; the visible width follows the aspect ratio.
    float view_height = 10.0F;

    [[nodiscard]] bounds visible_bounds(float aspect) const;
    [[nodiscard]] glm::mat4 view_projection(float aspect) const;
    // Screen positions are in pixels from the top-left corner of a viewport of the given pixel size.
    [[nodiscard]] glm::vec2 screen_to_world(glm::vec2 screen, glm::vec2 viewport) const;
};

} // namespace seraphim::render
