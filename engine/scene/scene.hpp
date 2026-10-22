#pragma once

#include <entt/entity/registry.hpp>
#include <glm/vec2.hpp>
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

    // In meters per second squared. Zero by default, since the default view is top-down.
    [[nodiscard]] glm::vec2& gravity() { return m_gravity; }
    [[nodiscard]] const glm::vec2& gravity() const { return m_gravity; }

  private:
    entt::registry m_registry;
    glm::vec2 m_gravity{0.0F};
};

} // namespace seraphim::scene
