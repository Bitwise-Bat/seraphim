#pragma once

#include <entt/entity/registry.hpp>
#include <string>

namespace seraphim::scene
{

class scene
{
  public:
    // The entity starts with an identity component.
    entt::entity create(std::string id, std::string name);

    [[nodiscard]] entt::registry& registry() { return m_registry; }
    [[nodiscard]] const entt::registry& registry() const { return m_registry; }

  private:
    entt::registry m_registry;
};

} // namespace seraphim::scene
