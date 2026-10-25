#pragma once

#include <entt/entity/fwd.hpp>

namespace seraphim::asset
{
class asset_manager;
}

namespace seraphim::scene
{

// Steps every entity with an animator and a sprite through its clip.
class animation_system
{
  public:
    // Loads the animation set of every animator, so update() does not search by id each tick.
    static void resolve(entt::registry& registry, asset::asset_manager& assets);

    static void update(entt::registry& registry, asset::asset_manager& assets, float dt);
};

} // namespace seraphim::scene
