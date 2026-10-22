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

} // namespace seraphim::render
