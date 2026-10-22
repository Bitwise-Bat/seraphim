#define SDL_MAIN_USE_CALLBACKS
#include "asset/asset_manager.hpp"
#include "core/fixed_timestep.hpp"
#include "core/log.hpp"
#include "core/version.hpp"
#include "platform/input.hpp"
#include "platform/window.hpp"
#include "render/renderer.hpp"
#include "scene/components.hpp"
#include "scene/picking.hpp"
#include "scene/scene.hpp"
#include "scene/scene_file.hpp"
#include "scene/sprite_system.hpp"

#include <chrono>
#include <cstdint>
#include <emscripten/bind.h>
#include <memory>
#include <optional>
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <string>
#include <utility>

namespace
{

constexpr auto tick_rate = 60;

struct app_state
{
    seraphim::platform::window window;
    seraphim::platform::input input;
    seraphim::core::fixed_timestep timestep{std::chrono::nanoseconds{std::chrono::seconds{1}} / tick_rate};
    seraphim::render::renderer renderer{seraphim::platform::canvas_selector};
    seraphim::asset::asset_sources sources;
    // Created once the renderer has a device, since uploading textures needs one.
    std::optional<seraphim::asset::asset_manager> assets;
    seraphim::render::camera2d camera;
    seraphim::scene::scene scene;
    seraphim::scene::sprite_system sprites;
};

// SDL owns the app state, but the host page reaches the engine through embind, so the running app is published here.
app_state* g_app = nullptr;

// Exposed to JavaScript as the Engine class.
struct engine_api
{
    static void register_asset(std::string id, std::string url)
    {
        if (!g_app)
        {
            seraphim::log::error("Asset '{}' registered before the engine started", id);
            return;
        }
        g_app->sources.set(std::move(id), std::move(url));
    }

    // Replaces the running scene. Returns why the scene was rejected, or an empty string once it is loaded; a rejected
    // scene leaves the running one untouched.
    static std::string load_scene(const std::string& json)
    {
        if (!g_app)
            return "The engine has not started yet";
        auto scene = seraphim::scene::parse_scene(json);
        if (!scene)
            return std::move(scene.error());
        g_app->scene = std::move(*scene);
        return {};
    }

    static std::string save_scene()
    {
        if (!g_app)
            return {};
        return seraphim::scene::serialize_scene(g_app->scene);
    }

    // Takes pixels from the top-left corner of the canvas backing store, not CSS pixels.
    static emscripten::val screen_to_world(float x, float y)
    {
        if (!g_app)
            return emscripten::val::null();
        const glm::vec2 world = g_app->camera.screen_to_world({x, y}, g_app->renderer.viewport_size());
        auto result = emscripten::val::object();
        result.set("x", world.x);
        result.set("y", world.y);
        return result;
    }

    // Returns the id of the topmost sprite entity at a canvas pixel, or an empty string if there is none.
    static std::string pick_entity(float x, float y)
    {
        if (!g_app)
            return {};
        const glm::vec2 world = g_app->camera.screen_to_world({x, y}, g_app->renderer.viewport_size());
        const entt::entity entity = seraphim::scene::pick_sprite(g_app->scene, world);
        if (entity == entt::null)
            return {};
        return g_app->scene.registry().get<seraphim::scene::identity>(entity).id;
    }

    static emscripten::val get_camera()
    {
        if (!g_app)
            return {};
        auto& camera = g_app->camera;
        auto obj = emscripten::val::object();
        obj.set("x", camera.position.x);
        obj.set("y", camera.position.y);
        obj.set("view_height", camera.view_height);
        return obj;
    }

    static void set_camera(float x, float y, float view_height = -1)
    {
        if (!g_app)
            return;
        auto& camera = g_app->camera;
        camera.position = {x, y};

        if (view_height > 0)
            camera.view_height = view_height;
    }
};

} // namespace

EMSCRIPTEN_BINDINGS(seraphim)
{
    emscripten::class_<engine_api>("Engine")
        .class_function("register_asset", &engine_api::register_asset)
        .class_function("load_scene", &engine_api::load_scene)
        .class_function("save_scene", &engine_api::save_scene)
        .class_function("screen_to_world", &engine_api::screen_to_world)
        .class_function("pick_entity", &engine_api::pick_entity)
        .class_function("get_camera", &engine_api::get_camera)
        .class_function("set_camera", &engine_api::set_camera);
}

SDL_AppResult SDL_AppInit(void** appstate, int, char*[])
{
    using namespace seraphim;

    log::info("Seraphim {} started", version::string);

    if (!SDL_Init(SDL_INIT_VIDEO))
    {
        log::error("Failed to initialize SDL: {}", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    auto window = platform::create_window("Seraphim");
    if (!window)
        return SDL_APP_FAILURE;

    int width = 0;
    int height = 0;
    SDL_GetWindowSizeInPixels(window.get(), &width, &height);
    log::info("Window created at {}x{} pixels", width, height);

    auto state = std::make_unique<app_state>(std::move(window));
    state->renderer.resize(static_cast<std::uint32_t>(width), static_cast<std::uint32_t>(height));
    g_app = state.release();
    *appstate = g_app;
    return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppIterate(void* appstate)
{
    auto& state = *static_cast<app_state*>(appstate);

    const int ticks = state.timestep.advance(std::chrono::nanoseconds{SDL_GetTicksNS()});

    // Edges belong to the first tick only, so a single press cannot fire twice when a slow frame runs several ticks.
    // With no tick this frame they are kept for the next one.
    if (ticks > 0)
        state.input.end_frame();

    state.renderer.poll();
    if (!state.assets && state.renderer.device())
        state.assets.emplace(state.renderer.device(), state.sources);
    if (!state.assets)
        return SDL_APP_CONTINUE;

    state.assets->update();
    state.renderer.begin(state.camera);
    state.sprites.draw(state.scene, *state.assets, state.renderer);
    state.renderer.end(*state.assets);
    return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppEvent(void* appstate, SDL_Event* event)
{
    if (event->type == SDL_EVENT_QUIT)
        return SDL_APP_SUCCESS;

    auto& state = *static_cast<app_state*>(appstate);
    if (event->type == SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED)
        state.renderer.resize(static_cast<std::uint32_t>(event->window.data1),
                              static_cast<std::uint32_t>(event->window.data2));

    state.input.handle(*event);
    return SDL_APP_CONTINUE;
}

void SDL_AppQuit(void* appstate, SDL_AppResult)
{
    // SDL hands ownership back here; SDL_Quit runs after this returns.
    std::unique_ptr<app_state> state{static_cast<app_state*>(appstate)};
    g_app = nullptr;
}
