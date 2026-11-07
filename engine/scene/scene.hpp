#pragma once

#include <entt/entity/registry.hpp>
#include <glm/vec2.hpp>
#include <string>
#include <string_view>

#include "core/color.hpp"

namespace seraphim::scene
{

class scene
{
  public:
    // The entity starts with an identity component.
    entt::entity create(std::string id, std::string name);

    // Returns entt::null when no entity has the id.
    [[nodiscard]] entt::entity find(std::string_view id) const;
    [[nodiscard]] std::optional<std::string> get_uuid(entt::entity entity) const;

    [[nodiscard]] entt::registry& registry() { return m_registry; }
    [[nodiscard]] const entt::registry& registry() const { return m_registry; }

    // In meters per second squared. Zero by default, since the default view is top-down.
    [[nodiscard]] glm::vec2& gravity() { return m_gravity; }
    [[nodiscard]] const glm::vec2& gravity() const { return m_gravity; }

    [[nodiscard]] core::color& clear_color() { return m_clear_color; }
    [[nodiscard]] const core::color& clear_color() const { return m_clear_color; }
  
  private:
    entt::registry m_registry;
    glm::vec2 m_gravity{0.0F};
    core::color m_clear_color = core::color::black;
};

} // namespace seraphim::scene
