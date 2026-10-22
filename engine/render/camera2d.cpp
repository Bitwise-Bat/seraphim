#include "render/camera2d.hpp"

#include <glm/ext/matrix_clip_space.hpp>

namespace seraphim::render
{

glm::mat4 camera2d::view_projection(float aspect) const
{
    const glm::vec2 half_extent{view_height * aspect * 0.5F, view_height * 0.5F};
    const glm::vec2 min = position - half_extent;
    const glm::vec2 max = position + half_extent;
    return glm::ortho(min.x, max.x, min.y, max.y, -1.0F, 1.0F);
}

glm::vec2 camera2d::screen_to_world(glm::vec2 screen, glm::vec2 viewport) const
{
    // Screen y grows downwards while world y grows upwards.
    const glm::vec2 offset{screen.x - (viewport.x * 0.5F), (viewport.y * 0.5F) - screen.y};
    return position + (offset * (view_height / viewport.y));
}

} // namespace seraphim::render
