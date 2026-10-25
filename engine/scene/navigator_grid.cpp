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
    // A mover that ended up on a blocked cell must still be able to walk out of it.
    const auto walkable = [&](unsigned x, unsigned y) { return (x == start.x && y == start.y) || (*this)(x, y); };

    JPS::PathVector path;
    if (!JPS::findPath(path, walkable, start.x, start.y, end.x, end.y, 1))
        return std::nullopt;

    // JPS steps diagonally past a blocked corner when one side is open. A mover heading straight for the next cell
    // centre would clip that corner and end up inside the blocked cell, so such steps go around through the open side.
    std::vector<glm::uvec2> waypoints;
    waypoints.reserve(path.size() * 2);
    glm::uvec2 previous = start;
    for (const auto& position : path)
    {
        const glm::uvec2 cell{position.x, position.y};
        if (cell.x != previous.x && cell.y != previous.y)
        {
            if (!walkable(cell.x, previous.y))
                waypoints.emplace_back(previous.x, cell.y);
            else if (!walkable(previous.x, cell.y))
                waypoints.emplace_back(cell.x, previous.y);
        }
        waypoints.push_back(cell);
        previous = cell;
    }

    return waypoints;
}
} // namespace seraphim::scene
