#pragma once

#include <box2d/id.h>
#include <entt/entity/entity.hpp>
#include <glm/vec2.hpp>
#include <optional>
#include <unordered_map>

namespace seraphim::scene
{

class scene;

// Simulates the scene with Box2D. Every entity with a collider becomes a body, static unless it has a rigidbody. Bodies
// are created once, at construction, so components edited afterwards take effect only in a new physics system.
class physics_system
{
  public:
    explicit physics_system(scene& scene);
    ~physics_system();

    physics_system(const physics_system&) = delete;
    physics_system& operator=(const physics_system&) = delete;
    physics_system(physics_system&&) = delete;
    physics_system& operator=(physics_system&&) = delete;

    // Advances the world and writes the moved bodies back to their transforms.
    void step(scene& scene, float seconds);

    [[nodiscard]] std::optional<glm::vec2> get_velocity(entt::entity entity) const;
    void set_velocity(entt::entity entity, glm::vec2 velocity);

    [[nodiscard]] bool has_body(entt::entity id) const;

  private:
    b2WorldId m_world;
    std::unordered_map<entt::entity, b2BodyId> m_bodies;
};

} // namespace seraphim::scene
