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
struct bounds;
struct camera2d;
} // namespace seraphim::render

namespace seraphim::scene
{

class scene;
struct tilemap;
struct transform;

// Submits every entity with a transform and a sprite or a tilemap to the renderer, ordered by their order fields.
class sprite_system
{
  public:
    void draw(scene& scene, asset::asset_manager& assets, render::renderer& renderer, const render::camera2d& camera);

  private:
    struct draw_item
    {
        std::int32_t order = 0;
        entt::entity entity = entt::null;
        bool is_tilemap = false;
        // Unused for tilemaps, which are expanded into one sprite per visible cell when drawn.
        render::sprite sprite;
    };

    static void draw_tilemap(const transform& placement, const tilemap& map, const asset::asset_manager& assets,
                             render::renderer& renderer, const render::bounds& visible);

    // Kept between frames to avoid reallocating every frame.
    std::vector<draw_item> m_items;
};

} // namespace seraphim::scene
