#pragma once
#include <chrono>
#include <unordered_map>
#include <entt/entity/entity.hpp>
#include <vector>

namespace seraphim::scene
{
    class spatial_grid
    {
    public:
        explicit spatial_grid(float cell_size) : m_cell(cell_size) {}
        
        void insert(entt::entity id, float x, float y); 
        void remove(entt::entity id);
        void update(entt::entity id, float x, float y);
        
        void query_radius(float x, float y, float r, std::vector<entt::entity>& out) const;
    private:
        struct cell_coord { 
            int32_t x, y;
            bool operator==(const cell_coord& cell) const
            {
                return cell.x == x && cell.y == y;
            }
         };
    
        static uint64_t key(int32_t cx, int32_t cy)
        {
            return (static_cast<uint64_t>(static_cast<uint32_t>(cx)) << 32) | static_cast<uint32_t>(cy);
        }
        cell_coord to_cell(float x, float y) const
        {
            return {static_cast<int32_t>(std::floor(x / m_cell)), static_cast<int32_t>(std::floor(y / m_cell))};
        }
        
        float m_cell{};
        std::unordered_map<uint64_t, std::vector<entt::entity>> m_cells;
        std::unordered_map<entt::entity, cell_coord> m_where;
    };
}
