#pragma once

#include "asset/handle.hpp"

#include <glm/vec4.hpp>
#include <string>
#include <string_view>
#include <vector>

namespace seraphim::asset
{

struct animation_clip
{
    std::string name;
    // Texture regions as (min u, min v, max u, max v), like sprite::uv_rect.
    std::vector<glm::vec4> frames;
    // In seconds.
    float frame_duration = 0.1F;
    bool loop = true;
};

struct animation_set
{
    std::vector<animation_clip> clips;

    [[nodiscard]] const animation_clip* find(std::string_view name) const
    {
        for (const animation_clip& clip : clips)
            if (clip.name == name)
                return &clip;
        return nullptr;
    }
};

using animation_set_handle = handle<animation_set>;

} // namespace seraphim::asset
