#include "scene/sprite_system.hpp"

#include "asset/asset_manager.hpp"
#include "render/camera2d.hpp"
#include "render/renderer.hpp"
#include "scene/components.hpp"
#include "scene/scene.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <entt/entity/registry.hpp>
#include <glm/common.hpp>
#include <limits>
#include <tuple>

namespace seraphim::scene
{

void sprite_system::draw(scene& scene, asset::asset_manager& assets, render::renderer& renderer,
                         const render::camera2d& camera)
{
    auto& registry = scene.registry();

    m_items.clear();
    for (const auto [entity, transform, sprite] : registry.view<const transform, sprite>().each())
    {
        if (!sprite.handle.valid() && !sprite.texture.empty())
            sprite.handle = assets.load_texture(sprite.texture);
        m_items.push_back({
            .order = sprite.order,
            .entity = entity,
            .sprite =
                {
                    .texture = sprite.handle,
                    .position = transform.position,
                    .size = sprite.size * transform.scale,
                    .rotation = transform.rotation,
                    .uv_rect = sprite.uv_rect,
                    .color = sprite.color,
                },
        });
    }
    const auto tilemaps = registry.view<const transform, tilemap>();
    for (const entt::entity entity : tilemaps)
    {
        auto& map = tilemaps.get<tilemap>(entity);
        if (!map.handle.valid() && !map.tileset.empty())
            map.handle = assets.load_tileset(map.tileset);
        m_items.push_back({.order = map.order, .entity = entity, .is_tilemap = true});
    }

    // View iteration order shifts as entities come and go, so equal orders fall back to the entity value to keep the
    // layering the same from frame to frame.
    std::ranges::sort(m_items, {},
                      [](const draw_item& item) { return std::tuple{item.order, item.entity, item.is_tilemap}; });

    const render::bounds visible = camera.visible_bounds(renderer.aspect());
    for (const draw_item& item : m_items)
    {
        if (item.is_tilemap)
            draw_tilemap(registry.get<const transform>(item.entity), registry.get<const tilemap>(item.entity), assets,
                         renderer, visible);
        else
            renderer.draw(item.sprite);
    }
}

void sprite_system::draw_tilemap(const transform& placement, const tilemap& map, const asset::asset_manager& assets,
                                 render::renderer& renderer, const render::bounds& visible)
{
    const asset::tileset* tileset = assets.get_tileset(map.handle);
    const glm::vec2 cell = map.cell_size * placement.scale;
    if (!tileset || cell.x == 0.0F || cell.y == 0.0F)
        return;

    const float cosine = std::cos(placement.rotation);
    const float sine = std::sin(placement.rotation);

    // Only cells the camera can see are drawn. Mapping the corners of the view into grid space finds them without
    // visiting the others, and stays correct when the map is rotated or flipped.
    glm::vec2 first{std::numeric_limits<float>::max()};
    glm::vec2 last{std::numeric_limits<float>::lowest()};
    const std::array corners{visible.min, visible.max, glm::vec2{visible.min.x, visible.max.y},
                             glm::vec2{visible.max.x, visible.min.y}};
    for (const glm::vec2 corner : corners)
    {
        const glm::vec2 offset = corner - placement.position;
        const glm::vec2 local{(offset.x * cosine) + (offset.y * sine), (offset.y * cosine) - (offset.x * sine)};
        const glm::vec2 grid{local.x / cell.x, -local.y / cell.y};
        first = glm::min(first, grid);
        last = glm::max(last, grid);
    }
    const glm::vec2 limit{map.size};
    const glm::uvec2 begin{glm::clamp(glm::floor(first), glm::vec2{0.0F}, limit)};
    const glm::uvec2 end{glm::clamp(glm::ceil(last), glm::vec2{0.0F}, limit)};

    const render::texture2d& texture = assets.texture(tileset->handle);
    const glm::uvec2 texture_size{texture.width(), texture.height()};
    // Sampling half a texel inside the tile keeps linear filtering from bleeding in the neighbouring tiles' edges.
    const glm::vec2 inset = 0.5F / glm::vec2{texture_size};

    for (const auto& tiles : map.layers)
        for (std::uint32_t y = begin.y; y < end.y; ++y)
            for (std::uint32_t x = begin.x; x < end.x; ++x)
            {
                const auto uv_rect =
                    tileset->uv_rect(tiles[(static_cast<std::size_t>(y) * map.size.x) + x], texture_size);
                if (!uv_rect)
                    continue;

                const glm::vec2 center{(static_cast<float>(x) + 0.5F) * cell.x,
                                       -(static_cast<float>(y) + 0.5F) * cell.y};
                renderer.draw({
                    .texture = tileset->handle,
                    .position = placement.position + glm::vec2{(center.x * cosine) - (center.y * sine),
                                                               (center.x * sine) + (center.y * cosine)},
                    .size = cell,
                    .rotation = placement.rotation,
                    .uv_rect = *uv_rect + glm::vec4{inset, -inset},
                });
            }
}

} // namespace seraphim::scene
