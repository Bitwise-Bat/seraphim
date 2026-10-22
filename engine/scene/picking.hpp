#pragma once

#include <entt/entity/entity.hpp>
#include <glm/vec2.hpp>

namespace seraphim::scene
{

class scene;

// Returns the topmost sprite under a world position, or entt::null. Matches the layering of sprite_system, so the
// sprite that is drawn last wins.
[[nodiscard]] entt::entity pick_sprite(const scene& scene, glm::vec2 world);

} // namespace seraphim::scene
