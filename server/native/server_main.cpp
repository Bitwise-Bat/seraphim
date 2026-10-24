#include "scene/scene_file.hpp"
#include "scene/world.hpp"

#include <emscripten/bind.h>
#include <optional>
#include <string>
#include <utility>

namespace
{

// Empty until the host loads a scene; the World bindings check for that through g_world.
std::optional<seraphim::scene::world> g_server_world;

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
            g_server_world->tick(seconds);
    }
};

} // namespace

EMSCRIPTEN_BINDINGS(server)
{
    emscripten::class_<server_api>("Server")
        .class_function("load_scene", &server_api::load_scene)
        .class_function("start_simulation", &server_api::start_simulation)
        .class_function("stop_simulation", &server_api::stop_simulation)
        .class_function("tick", &server_api::tick);
}
