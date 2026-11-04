#include <iostream>

#include "core/uuid.hpp"
#include "scene/scene_file.hpp"
#include "scene/world.hpp"
#include "visibility.hpp"

#include <emscripten/bind.h>
#include <optional>
#include <string>
#include <utility>

namespace
{

// Empty until the host loads a scene; the World bindings check for that through g_world.
std::optional<seraphim::scene::world> g_server_world;
seraphim::server::visibility g_visibility;

emscripten::val g_visibility_enter_handler;
emscripten::val g_visibility_leave_handler;

// Exposed to JavaScript as the Server class: what only the world's owner on the server does. The host drives the ticks.
struct server_api
{
    // Replaces the running world. Returns why the scene was rejected, or an empty string once it is loaded; a rejected
    // scene leaves the running one untouched.
    static std::string load_scene(const std::string& json)
    {
        auto scene = seraphim::scene::parse_scene(json);
        if (!scene)
            return std::move(scene.error());
        g_server_world.emplace(std::move(*scene));
        return {};
    }

    static void start_simulation()
    {
        if (g_server_world)
            g_server_world->start_simulation();
    }

    static void stop_simulation()
    {
        if (g_server_world)
            g_server_world->stop_simulation();
    }

    static void tick(float seconds)
    {
        if (g_server_world)
        {
            g_server_world->tick(seconds);
            
            std::vector<seraphim::server::visibility_event> visibility_events;
            g_visibility.tick(g_server_world->scene, g_server_world->grid(), visibility_events);
            
            for (const auto& event : visibility_events)
            {
                auto& handler = event.entered ? g_visibility_enter_handler : g_visibility_leave_handler;
                if (handler.isUndefined() || handler.isNull())
                    continue;

                const auto* observer_id = g_server_world->scene.registry().try_get<seraphim::scene::identity>(event.observer);
                const auto* target_id = g_server_world->scene.registry().try_get<seraphim::scene::identity>(event.target);
                if (!observer_id || !target_id)
                    continue;

                static_cast<void>(handler(observer_id->id, target_id->id));
            }
        }
    }

    static std::optional<std::string> create_entity(const std::string& name)
    {
        if (!g_server_world)
            return std::nullopt;

        const auto& uuid = seraphim::core::generate_uuid();
        const auto entity = g_server_world->scene.create(uuid, name.empty() ? uuid : name);
        if (entity == entt::null)
            return std::nullopt;

        return uuid;
    }
    
    static void set_visibility_enter_handler(emscripten::val cb)
    {
        g_visibility_enter_handler = cb;
    }
    
    static void set_visibility_leave_handler(emscripten::val cb)
    {
        g_visibility_leave_handler = cb;
    }
    
    static void add_observer(const std::string& id)
    {
        if (!g_server_world) 
            return;
        auto entity = g_server_world->scene.find(id);
        if (entity == entt::null)
            return;
        g_visibility.add_observer(entity);
    }
    
    static void remove_observer(const std::string& id)
    {
        if (!g_server_world) 
            return;
        
        auto entity = g_server_world->scene.find(id);
        if (entity == entt::null)
            return;
        g_visibility.remove_observer(entity);
    }
};

} // namespace

EMSCRIPTEN_BINDINGS(server)
{
    emscripten::class_<server_api>("Server")
        .class_function("load_scene", &server_api::load_scene)
        .class_function("start_simulation", &server_api::start_simulation)
        .class_function("stop_simulation", &server_api::stop_simulation)
        .class_function("tick", &server_api::tick)
        .class_function("create_entity", &server_api::create_entity)
        .class_function("set_visibility_enter_handler", &server_api::set_visibility_enter_handler)
        .class_function("set_visibility_leave_handler", &server_api::set_visibility_leave_handler)
        .class_function("add_observer", &server_api::add_observer)
        .class_function("remove_observer", &server_api::remove_observer);
}
