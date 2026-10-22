#pragma once

#include "render/sprite.hpp"

#include <cstdint>
#include <entt/entity/entity.hpp>
#include <vector>

namespace seraphim::asset
{
class asset_manager;
}

namespace seraphim::render
{
class renderer;
}

namespace seraphim::scene
{

class scene;

// Submits every entity with a transform and a sprite to the renderer, ordered by sprite order.
class sprite_system
{
  public:
    void draw(scene& scene, asset::asset_manager& assets, render::renderer& renderer);

  private:
    struct draw_item
    {
        std::int32_t order = 0;
        entt::entity entity = entt::null;
        render::sprite sprite;
    };

    // Kept between frames to avoid reallocating every frame.
    std::vector<draw_item> m_items;
};

} // namespace seraphim::scene
