#include "scene/sprite_system.hpp"

#include "asset/asset_manager.hpp"
#include "render/renderer.hpp"
#include "scene/components.hpp"
#include "scene/scene.hpp"

#include <algorithm>
#include <entt/entity/registry.hpp>
#include <tuple>

namespace seraphim::scene
{

void sprite_system::draw(scene& scene, asset::asset_manager& assets, render::renderer& renderer)
{
    auto& registry = scene.registry();
    const auto view = registry.view<const transform, sprite>();

    m_items.clear();
    for (const auto [entity, transform, sprite] : view.each())
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

    // View iteration order shifts as entities come and go, so equal orders fall back to the entity value to keep the
    // layering the same from frame to frame.
    std::ranges::sort(m_items, {}, [](const draw_item& item) { return std::tuple{item.order, item.entity}; });

    for (const draw_item& item : m_items)
        renderer.draw(item.sprite);
}

} // namespace seraphim::scene
