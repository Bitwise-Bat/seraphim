#include "scene/picking.hpp"

#include "scene/components.hpp"
#include "scene/scene.hpp"

#include <cmath>
#include <cstdint>
#include <entt/entity/registry.hpp>
#include <glm/common.hpp>
#include <glm/vector_relational.hpp>
#include <tuple>

namespace seraphim::scene
{

entt::entity pick_sprite(const scene& scene, glm::vec2 world)
{
    entt::entity picked = entt::null;
    std::tuple<std::int32_t, entt::entity> picked_layer{};

    for (const auto [entity, placement, image] : scene.registry().view<const transform, const sprite>().each())
    {
        // Undoing the rotation turns the hit test into an axis-aligned box check in the sprite's own space.
        const glm::vec2 offset = world - placement.position;
        const float cosine = std::cos(-placement.rotation);
        const float sine = std::sin(-placement.rotation);
        const glm::vec2 local{(offset.x * cosine) - (offset.y * sine), (offset.x * sine) + (offset.y * cosine)};
        const glm::vec2 half_size = glm::abs(image.size * placement.scale) * 0.5F;
        if (glm::any(glm::greaterThan(glm::abs(local), half_size)))
            continue;

        const std::tuple layer{image.order, entity};
        if (picked == entt::null || layer > picked_layer)
        {
            picked = entity;
            picked_layer = layer;
        }
    }
    return picked;
}

} // namespace seraphim::scene
