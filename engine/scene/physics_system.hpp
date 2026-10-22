#pragma once

#include <box2d/id.h>

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

  private:
    b2WorldId m_world;
};

} // namespace seraphim::scene
