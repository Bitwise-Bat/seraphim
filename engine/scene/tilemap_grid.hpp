#pragma once

#include "scene/components.hpp"

#include <glm/vec2.hpp>

namespace seraphim::scene
{

// Converts between a map's local space (relative to its transform's position, unrotated, y up) and continuous grid
// space, where cell (x, y) covers [x, x + 1) × [y, y + 1). Both orientations are linear in grid space, so a cell is
// always a unit square there, whatever shape it has on screen.

[[nodiscard]] inline glm::vec2 local_to_grid(tilemap_orientation orientation, glm::vec2 cell, glm::vec2 local)
{
    const glm::vec2 scaled{local.x / cell.x, -local.y / cell.y};
    if (orientation == tilemap_orientation::orthogonal)
        return scaled;
    return {scaled.y + scaled.x, scaled.y - scaled.x};
}

[[nodiscard]] inline glm::vec2 grid_to_local(tilemap_orientation orientation, glm::vec2 cell, glm::vec2 grid)
{
    if (orientation == tilemap_orientation::orthogonal)
        return {grid.x * cell.x, -grid.y * cell.y};
    return {(grid.x - grid.y) * cell.x * 0.5F, -(grid.x + grid.y) * cell.y * 0.5F};
}

} // namespace seraphim::scene
