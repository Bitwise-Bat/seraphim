#include "scene/navigator_grid.hpp"

#include "scene/components.hpp"

#include <jps.hh>

namespace seraphim::scene
{
navigator_grid::navigator_grid(const tilemap& map, std::size_t blocking_layer)
    : m_width(map.size.x), m_height(map.size.y), m_walkable(std::size_t{m_width} * m_height, 1)
{
    if (blocking_layer >= map.layers.size())
        return;

    const auto& tiles = map.layers[blocking_layer];
    for (std::size_t i = 0; i < m_walkable.size() && i < tiles.size(); ++i)
        m_walkable[i] = tiles[i] == 0 ? 1 : 0;
}

std::optional<std::vector<glm::uvec2>> navigator_grid::find_path(glm::uvec2 start, glm::uvec2 end) const
{
    JPS::PathVector path;
    if (!JPS::findPath(path, *this, start.x, start.y, end.x, end.y))
        return std::nullopt;

    std::vector<glm::uvec2> waypoints;
    waypoints.reserve(path.size());
    for (const auto& position : path)
        waypoints.emplace_back(position.x, position.y);

    return waypoints;
}
} // namespace seraphim::scene
