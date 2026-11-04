#include "spatial_grid.hpp"

#include <list>

namespace seraphim::scene
{
    void spatial_grid::insert(entt::entity id, float x, float y)
    {
        const auto cell = to_cell(x, y);
        m_cells[key(cell.x, cell.y)].push_back(id);
        m_where[id] = cell;
    }

    void spatial_grid::query_radius(float x, float y, float r, std::vector<entt::entity>& out) const
    {
        const auto cell_r = static_cast<int32_t>(std::ceil(r / m_cell));
        const auto center = to_cell(x, y);

        for (int32_t dx = -cell_r; dx <= cell_r; ++dx)
            for (int32_t dy = -cell_r; dy <= cell_r; ++dy)
                if (auto cell = m_cells.find(key(center.x + dx, center.y + dy)); cell != m_cells.end())
                    out.insert(out.end(), cell->second.begin(), cell->second.end());
    }

    void spatial_grid::update(entt::entity id, float x, float y)
    {
        if (auto where = m_where.find(id); where != m_where.end() && where->second == to_cell(x, y))
            return;

        remove(id);
        insert(id, x, y);
    }

    void spatial_grid::remove(entt::entity id)
    {
        const auto where = m_where.find(id);
        if (where == m_where.end()) return;

        if (auto cell = m_cells.find(key(where->second.x, where->second.y)); cell != m_cells.end())
        {
            std::erase(cell->second, id);
            if (cell->second.empty())
                m_cells.erase(cell);
        }

        m_where.erase(where);
    }
}
