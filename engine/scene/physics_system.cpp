#include "scene/physics_system.hpp"

#include "core/log.hpp"
#include "scene/components.hpp"
#include "scene/scene.hpp"

#include <algorithm>
#include <bit>
#include <box2d/box2d.h>
#include <cmath>
#include <cstdint>
#include <glm/common.hpp>

namespace seraphim::scene
{

namespace
{

// Box2D's recommended count: fewer makes stacks jittery, more costs time without visible gain.
constexpr int sub_steps = 4;

b2Vec2 to_b2(glm::vec2 value)
{
    return {value.x, value.y};
}

void* to_user_data(entt::entity entity)
{
    return std::bit_cast<void*>(static_cast<std::uintptr_t>(entt::to_integral(entity)));
}

entt::entity from_user_data(void* data)
{
    return static_cast<entt::entity>(static_cast<entt::id_type>(std::bit_cast<std::uintptr_t>(data)));
}

b2BodyType to_b2(body_type type)
{
    switch (type)
    {
    case body_type::static_body:
        return b2_staticBody;
    case body_type::kinematic:
        return b2_kinematicBody;
    case body_type::dynamic:
        return b2_dynamicBody;
    }
    return b2_staticBody;
}

// The transform's scale is baked into the shape, since Box2D bodies have no scale of their own.
void create_shape(b2BodyId body, const collider& shape, glm::vec2 scale)
{
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = shape.density;
    def.material.friction = shape.friction;
    def.material.restitution = shape.restitution;
    def.isSensor = shape.sensor;

    const glm::vec2 offset = shape.offset * scale;
    const glm::vec2 extent = glm::abs(scale);
    if (shape.shape == collider_shape::box)
    {
        const glm::vec2 half = shape.size * extent * 0.5F;
        const b2Polygon box = b2MakeOffsetBox(half.x, half.y, to_b2(offset), b2Rot_identity);
        b2CreatePolygonShape(body, &def, &box);
    }
    else
    {
        const b2Circle circle{to_b2(offset), shape.radius * std::max(extent.x, extent.y)};
        b2CreateCircleShape(body, &def, &circle);
    }
}

} // namespace

physics_system::physics_system(scene& scene)
{
    b2WorldDef world_def = b2DefaultWorldDef();
    world_def.gravity = to_b2(scene.gravity());
    m_world = b2CreateWorld(&world_def);

    auto& registry = scene.registry();
    for (const auto [entity, shape] : registry.view<const collider>().each())
    {
        const auto* placement = registry.try_get<transform>(entity);
        const transform pose = placement ? *placement : transform{};
        const auto* body = registry.try_get<rigidbody>(entity);

        b2BodyDef body_def = b2DefaultBodyDef();
        body_def.type = body ? to_b2(body->type) : b2_staticBody;
        body_def.position = to_b2(pose.position);
        body_def.rotation = b2MakeRot(pose.rotation);
        body_def.userData = to_user_data(entity);
        if (body)
        {
            body_def.gravityScale = body->gravity_scale;
            body_def.fixedRotation = body->fixed_rotation;
        }

        const b2BodyId id = b2CreateBody(m_world, &body_def);
        m_bodies.emplace(entity, id);

        create_shape(id, shape, pose.scale);
    }
}

physics_system::~physics_system()
{
    b2DestroyWorld(m_world);
}

void physics_system::step(scene& scene, float seconds)
{
    b2World_Step(m_world, seconds, sub_steps);

    auto& registry = scene.registry();
    const b2BodyEvents events = b2World_GetBodyEvents(m_world);
    for (int i = 0; i < events.moveCount; ++i)
    {
        const b2BodyMoveEvent& move = events.moveEvents[i];
        auto* placement = registry.try_get<transform>(from_user_data(move.userData));
        if (!placement)
            continue;
        placement->position = {move.transform.p.x, move.transform.p.y};
        placement->rotation = b2Rot_GetAngle(move.transform.q);
    }
}

std::optional<glm::vec2> physics_system::get_velocity(entt::entity entity) const
{
    const auto body = m_bodies.find(entity);
    if (body == m_bodies.end())
        return std::nullopt;

    const auto velocity = b2Body_GetLinearVelocity(body->second);
    return glm::vec2{velocity.x, velocity.y};
}

void physics_system::set_velocity(entt::entity entity, glm::vec2 velocity)
{
    const auto body = m_bodies.find(entity);
    if (body == m_bodies.end())
        return;

    b2Body_SetLinearVelocity(body->second, b2Vec2{velocity.x, velocity.y});
}

bool physics_system::has_body(entt::entity id) const
{
    const auto body = m_bodies.find(id);
    if (body == m_bodies.end())
        return false;

    return b2Body_IsValid(body->second);
}

b2BodyId physics_system::create_body(entt::entity entity, scene& scene)
{
    if (m_bodies.contains(entity))
        return b2_nullBodyId;

    auto& registry = scene.registry();
    const auto* placement = registry.try_get<transform>(entity);
    const transform pose = placement ? *placement : transform{};
    const auto* body = registry.try_get<rigidbody>(entity);
    const auto* shape = registry.try_get<collider>(entity);

    b2BodyDef body_def = b2DefaultBodyDef();
    body_def.type = body ? to_b2(body->type) : b2_staticBody;
    body_def.position = to_b2(pose.position);
    body_def.rotation = b2MakeRot(pose.rotation);
    body_def.userData = to_user_data(entity);
    if (body)
    {
        body_def.gravityScale = body->gravity_scale;
        body_def.fixedRotation = body->fixed_rotation;
    }

    const b2BodyId id = b2CreateBody(m_world, &body_def);
    m_bodies.emplace(entity, id);
    if (shape)
    {
        create_shape(id, *shape, pose.scale);
    }

    return id;
}

void physics_system::set_fixed_rotation(entt::entity entity, bool enabled)
{
    const auto body = m_bodies.find(entity);
    if (body == m_bodies.end())
        return;

    b2Body_SetFixedRotation(body->second, enabled);
}

bool physics_system::get_fixed_rotation(entt::entity entity)
{
    const auto body = m_bodies.find(entity);
    if (body == m_bodies.end())
        return false;
    return b2Body_IsFixedRotation(body->second);
}
} // namespace seraphim::scene
