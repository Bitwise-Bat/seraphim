#pragma once

#include <unordered_map>
#include <vector>
#include "scene/spatial_grid.hpp"
#include "scene/scene.hpp"

namespace seraphim::server
{
    struct visibility_event
    {
        entt::entity observer;
        entt::entity target;
        bool entered;
    };

    class visibility                                                                                                                                                                                                                                                                                                                                                                                                                       
    {                                                                                                                                                                                                                                                                                                                                                                                                                                      
    public:                                                                                                                                                                                                                                                                                                                                                                                                                                
        void add_observer(entt::entity observer) { m_previous.try_emplace(observer); }                                                                                                                                                                                                                                                                                                                                                     
        void remove_observer(entt::entity observer) { m_previous.erase(observer); }                                                                                                                                                                                                                                                                                                                                                        
        void tick(const scene::scene& scene, const scene::spatial_grid& grid, std::vector<visibility_event>& out);                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                                                                                                                                                                                                                         
    private:                                                                                                                                                                                                                                                                                                                                                                                                                               
        static constexpr float view_radius = 10.0f;                                                                                                                                                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                                                                                                                                                                                         
        std::unordered_map<entt::entity, std::vector<entt::entity>> m_previous;                                                                                                                                                                                                                                                                                                                                                            
        std::vector<entt::entity> m_current;                                                                                                                                                                                                                                                                                                                                                                                               
    };
}