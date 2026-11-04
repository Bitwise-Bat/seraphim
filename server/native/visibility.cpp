#include "visibility.hpp"
#include "scene/components.hpp"

namespace seraphim::server
{
void visibility::tick(const scene::scene& scene, const scene::spatial_grid& grid, std::vector<visibility_event>& out)
{
    for (auto& [observer, previous] : m_previous)
    {
        const auto* tf = scene.registry().try_get<scene::transform>(observer);
        if (!tf)
            continue;
        const auto& position = tf->position;

        m_current.clear();
        grid.query_radius(position.x, position.y, view_radius, m_current);
        std::erase(m_current, observer);
        std::ranges::sort(m_current);

        for (const auto target : m_current)
            if (!std::ranges::binary_search(previous, target))
                out.push_back({observer, target, true});

        for (const auto target : previous)
            if (!std::ranges::binary_search(m_current, target))
                out.push_back({observer, target, false});

        previous.swap(m_current);
    }
}
}
