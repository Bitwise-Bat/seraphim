#pragma once

#include <box2d/id.h>
#include <entt/entity/entity.hpp>
#include <entt/signal/fwd.hpp>
#include <glm/vec2.hpp>
#include <optional>
#include <unordered_map>

namespace seraphim::scene
{

class scene;

struct collision_enter
{
    entt::entity entity_a;
    entt::entity entity_b;
};

struct collision_leave
{
    entt::entity entity_a;
    entt::entity entity_b;
};

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

    // Advances the world, writes the moved bodies back to their transforms, and queues collision events.
    void step(scene& scene, float seconds, entt::dispatcher& dispatcher);

    [[nodiscard]] std::optional<glm::vec2> get_velocity(entt::entity entity) const;
    void set_velocity(entt::entity entity, glm::vec2 velocity);

    [[nodiscard]] bool has_body(entt::entity id) const;

    b2BodyId create_body(entt::entity entity, scene& scene);
    void set_fixed_rotation(entt::entity entity, bool enabled);
    [[nodiscard]] bool get_fixed_rotation(entt::entity entity);
    void set_layer(entt::entity entity, std::uint8_t category, std::uint8_t mask);

  private:
    b2WorldId m_world;
    std::unordered_map<entt::entity, b2BodyId> m_bodies;
};

} // namespace seraphim::scene
