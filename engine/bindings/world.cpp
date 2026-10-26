#include "scene/world.hpp"

#include "core/assert.hpp"
#include "core/uuid.hpp"
#include "scene/components.hpp"

#include <emscripten/bind.h>
#include <optional>
#include <string>
#include <utility>

namespace
{

using seraphim::scene::g_world;

// Exposed to JavaScript as the World class: what the client and the server simulate alike.
struct world_api
{
    static std::string save_scene()
    {
        if (!g_world)
            return {};
        return g_world->save_scene();
    }

    static void set_tick_handler(emscripten::val handler)
    {
        if (g_world)
            g_world->tick_handler = std::move(handler);
    }

    // Returns null when the entity does not exist or has no transform.
    static emscripten::val get_transform(const std::string& id)
    {
        if (!g_world)
            return emscripten::val::null();
        const auto placement = g_world->get_transform(id);
        if (!placement)
            return emscripten::val::null();

        auto result = emscripten::val::object();
        result.set("x", placement->position.x);
        result.set("y", placement->position.y);
        result.set("rotation", placement->rotation);
        result.set("scale_x", placement->scale.x);
        result.set("scale_y", placement->scale.y);
        return result;
    }

    // Gives the entity a transform if it has none. Physics bodies are not moved along, so a dynamic body's next step
    // overwrites the change.
    static void set_transform(const std::string& id, float x, float y, float rotation, float scale_x, float scale_y)
    {
        if (g_world)
            g_world->set_transform(id, seraphim::scene::transform{{x, y}, rotation, {scale_x, scale_y}});
    }

    // Returns the id of the first entity with the name, or an empty string if there is none.
    static std::string find_entity(const std::string& name)
    {
        if (!g_world)
            return {};
        return g_world->find_entity(name).value_or("");
    }

    static emscripten::val get_velocity(const std::string& entity_id)
    {
        if (!g_world)
            return emscripten::val::null();
        const auto velocity = g_world->get_velocity(entity_id);
        if (!velocity)
            return emscripten::val::null();

        auto result = emscripten::val::object();
        result.set("x", velocity->x);
        result.set("y", velocity->y);
        return result;
    }

    static void set_velocity(const std::string& entity_id, float velocity_x, float velocity_y)
    {
        if (g_world)
            g_world->set_velocity(entity_id, {velocity_x, velocity_y});
    }

    static bool has_body(const std::string& id) { return g_world && g_world->has_body(id); }

    // Returns nothing when the entity does not exist or has no animator.
    static std::optional<std::string> get_clip(const std::string& id)
    {
        if (!g_world)
            return std::nullopt;
        return g_world->get_clip(id);
    }

    static void set_clip(const std::string& id, const std::string& clip)
    {
        if (g_world)
            g_world->set_clip(id, clip);
    }

    static bool has_animator(const std::string& id) { return g_world && g_world->has_animator(id); }

    static bool has_tilemap(const std::string& id) { return g_world && g_world->has_tilemap(id); }

    static emscripten::val find_path(const std::string& tilemap_id, unsigned blocking_layer, unsigned start_x,
                                     unsigned start_y, unsigned end_x, unsigned end_y)
    {
        if (!g_world)
            return emscripten::val::null();
        const auto waypoints = g_world->find_path(tilemap_id, blocking_layer, {start_x, start_y}, {end_x, end_y});
        if (!waypoints)
            return emscripten::val::null();

        auto result = emscripten::val::array();
        for (const auto& cell : *waypoints)
        {
            auto point = emscripten::val::object();
            point.set("x", cell.x);
            point.set("y", cell.y);
            result.call<void>("push", point);
        }
        return result;
    }

    static emscripten::val get_cell_at_coord(const std::string& tilemap_id, float world_x, float world_y)
    {
        if (!g_world)
            return emscripten::val::null();
        const auto cell = g_world->get_cell_at_coord(tilemap_id, {world_x, world_y});
        if (!cell)
            return emscripten::val::null();

        auto result = emscripten::val::object();
        result.set("x", cell->x);
        result.set("y", cell->y);
        return result;
    }

    static emscripten::val get_cell_center(const std::string& tilemap_id, unsigned cell_x, unsigned cell_y)
    {
        if (!g_world)
            return emscripten::val::null();
        const auto center = g_world->get_cell_center(tilemap_id, {cell_x, cell_y});
        if (!center)
            return emscripten::val::null();

        auto result = emscripten::val::object();
        result.set("x", center->x);
        result.set("y", center->y);
        return result;
    }

    static std::string make_snapshot(float min_x, float min_y, float max_x, float max_y)
    {
        if (!g_world)
            return "";
        return g_world->make_snapshot({min_x, min_y}, {max_x, max_y});
    }

    static std::string create_entity(const std::string& name)
    {
        if (!g_world)
            return "";

        const auto uuid = seraphim::core::generate_uuid();
        g_world->scene.create(uuid, name);

        return uuid;
    }

    static std::string create_entity_with_id(const std::string& name, const std::string& id)
    {
        if (!g_world)
            return "";

        const auto uuid = id.empty() ? seraphim::core::generate_uuid() : id;
        g_world->scene.create(uuid, name);

        return uuid;
    }

    static void add_component(const std::string& id, const std::string& component)
    {
        if (!g_world)
            return;

        const entt::entity entity = g_world->scene.find(id);
        if (entity == entt::null)
            return;

        auto& registry = g_world->scene.registry();

        if (component == "transform")
        {
            static_cast<void>(registry.get_or_emplace<seraphim::scene::transform>(entity));
        }
        else if (component == "rigidbody")
        {
            static_cast<void>(registry.get_or_emplace<seraphim::scene::rigidbody>(entity));
            static_cast<void>(registry.get_or_emplace<seraphim::scene::collider>(entity));
            g_world->physics->create_body(entity, g_world->scene);
        }
        else if (component == "sprite")
        {
            static_cast<void>(registry.get_or_emplace<seraphim::scene::sprite>(entity));
        }
        else if (component == "animator")
        {
            static_cast<void>(registry.get_or_emplace<seraphim::scene::animator>(entity));
        }
        else if (component == "networked")
        {
            static_cast<void>(registry.get_or_emplace<seraphim::scene::networked>(entity));
        }
    };

    static void set_sprite(const std::string& id, const std::string& sprite, uint8_t order = 0)
    {
        if (!g_world)
            return;
        const auto entity = g_world->scene.find(id);
        if (entity == entt::null)
            return;

        auto* sprite_component = g_world->scene.registry().try_get<seraphim::scene::sprite>(entity);
        if (!sprite_component)
            return;

        sprite_component->texture = sprite;
        sprite_component->handle = {};
        sprite_component->order = order;
    }

    static bool has_sprite(const std::string& id)
    {
        if (!g_world)
            return false;

        const auto entity = g_world->scene.find(id);
        return entity != entt::null && g_world->scene.registry().all_of<seraphim::scene::sprite>(entity);
    };

    static void set_animation_set(const std::string& id, const std::string& animation_set)
    {
        if (!g_world)
            return;

        const auto entity = g_world->scene.find(id);
        if (entity == entt::null)
            return;

        if (auto* animator = g_world->scene.registry().try_get<seraphim::scene::animator>(entity))
        {
            if (animator->animation_set != animation_set)
            {
                animator->animation_set = animation_set;
                animator->handle = {};
            }
        }
    }

    static std::optional<std::string> get_animation_set(const std::string& id)
    {
        if (!g_world)
            return std::nullopt;

        const auto& entity = g_world->scene.find(id);
        if (auto animator = g_world->scene.registry().try_get<seraphim::scene::animator>(entity))
        {
            return animator->animation_set;
        }

        return std::nullopt;
    }

    static bool is_local(const std::string& id)
    {
        if (!g_world)
            return false;

        const auto& entity = g_world->scene.find(id);
        if (entity == entt::null)
            return false;

        if (auto networked = g_world->scene.registry().try_get<seraphim::scene::networked>(entity))
        {
            if (networked->owner_id == seraphim::scene::invalid_player_id ||
                g_world->local_player_id == seraphim::scene::invalid_player_id)
                return false;
            return networked->owner_id == g_world->local_player_id;
        }

        return true;
    }

    static void set_local_id(std::uint32_t id)
    {
        if (!g_world)
            return;

        g_world->local_player_id = id;
    }

    static void set_owner_id(const std::string& id, std::uint32_t owner_id)
    {
        if (!g_world)
            return;

        const auto entity = g_world->scene.find(id);
        if (entity == entt::null)
            return;

        auto& networked = g_world->scene.registry().get_or_emplace<seraphim::scene::networked>(entity);
        networked.owner_id = owner_id;
    }

    static std::uint32_t get_owner_id(const std::string& id)
    {
        if (!g_world)
            return seraphim::scene::invalid_player_id;

        const auto entity = g_world->scene.find(id);
        if (entity == entt::null)
            return seraphim::scene::invalid_player_id;

        if (const auto* networked = g_world->scene.registry().try_get<seraphim::scene::networked>(entity))
            return networked->owner_id;

        return seraphim::scene::invalid_player_id;
    }
};

} // namespace

EMSCRIPTEN_BINDINGS(world)
{
    emscripten::register_optional<std::string>();

    emscripten::class_<world_api>("World")
        .class_function("save_scene", &world_api::save_scene)
        .class_function("set_tick_handler", &world_api::set_tick_handler)
        .class_function("get_transform", &world_api::get_transform)
        .class_function("set_transform", &world_api::set_transform)
        .class_function("find_entity", &world_api::find_entity)
        .class_function("get_velocity", &world_api::get_velocity)
        .class_function("set_velocity", &world_api::set_velocity)
        .class_function("has_body", &world_api::has_body)
        .class_function("get_clip", &world_api::get_clip)
        .class_function("set_clip", &world_api::set_clip)
        .class_function("has_animator", &world_api::has_animator)
        .class_function("has_tilemap", &world_api::has_tilemap)
        .class_function("find_path", &world_api::find_path)
        .class_function("get_cell_at_coord", &world_api::get_cell_at_coord)
        .class_function("get_cell_center", &world_api::get_cell_center)
        .class_function("make_snapshot", &world_api::make_snapshot)
        .class_function("create_entity", &world_api::create_entity)
        .class_function("add_component", &world_api::add_component)
        .class_function("set_sprite", &world_api::set_sprite)
        .class_function("has_sprite", &world_api::has_sprite)
        .class_function("set_animation_set", &world_api::set_animation_set)
        .class_function("get_animation_set", &world_api::get_animation_set)
        .class_function("is_local", &world_api::is_local)
        .class_function("set_local_id", &world_api::set_local_id)
        .class_function("create_entity_with_id", &world_api::create_entity_with_id)
        .class_function("set_owner_id", &world_api::set_owner_id)
        .class_function("get_owner_id", &world_api::get_owner_id);
}
