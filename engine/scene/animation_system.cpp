#include "scene/animation_system.hpp"

#include "asset/asset_manager.hpp"
#include "scene/components.hpp"

#include <entt/entity/registry.hpp>

namespace seraphim::scene
{

void animation_system::resolve(entt::registry& registry, const asset::asset_manager& assets)
{
    for (const auto [entity, state] : registry.view<animator>().each())
        state.handle = assets.find_animation_set(state.animation_set);
}

void animation_system::update(entt::registry& registry, const asset::asset_manager& assets, float dt)
{
    for (const auto [entity, state, image] : registry.view<animator, sprite>().each())
    {
        const asset::animation_set* set = assets.get_animation_set(state.handle);
        const asset::animation_clip* clip = set ? set->find(state.clip) : nullptr;
        if (!clip || clip->frames.empty() || clip->frame_duration <= 0.0F)
            continue;

        const std::size_t last = clip->frames.size() - 1;
        state.elapsed += dt;
        while (state.elapsed >= clip->frame_duration)
        {
            state.elapsed -= clip->frame_duration;
            if (state.frame < last)
                ++state.frame;
            else if (clip->loop)
                state.frame = 0;
        }
        // The clip may have changed to a shorter one since the last tick.
        if (state.frame > last)
            state.frame = 0;
        image.uv_rect = clip->frames[state.frame];
    }
}

} // namespace seraphim::scene
