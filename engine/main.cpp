#define SDL_MAIN_USE_CALLBACKS
#include "asset/asset_manager.hpp"
#include "core/fixed_timestep.hpp"
#include "core/log.hpp"
#include "core/version.hpp"
#include "platform/input.hpp"
#include "platform/window.hpp"
#include "render/renderer.hpp"
#include "scene/components.hpp"
#include "scene/physics_system.hpp"
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
    // Exists only while the scene is simulated, so the editor can edit a scene without it moving.
    std::optional<seraphim::scene::physics_system> physics;
    // The script host's function, called once per simulated tick; undefined or null when no scripts run.
    emscripten::val tick_handler = emscripten::val::undefined();
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
        // The bodies belong to the old scene's entities.
        g_app->physics.reset();
        g_app->scene = std::move(*scene);
        return {};
    }

    static void start_simulation()
    {
        if (!g_app)
            return;
        g_app->physics.emplace(g_app->scene);
    }

    static void stop_simulation()
    {
        if (!g_app)
            return;
        g_app->physics.reset();
    }

    // Ticks are fixed, so this is the same for every tick.
    static float tick_seconds()
    {
        if (!g_app)
            return 0.0F;
        return std::chrono::duration<float>(g_app->timestep.step()).count();
    }

    static void set_tick_handler(emscripten::val handler)
    {
        if (!g_app)
            return;
        g_app->tick_handler = std::move(handler);
    }

    // Returns null when the entity does not exist or has no transform.
    static emscripten::val get_transform(const std::string& id)
    {
        if (!g_app)
            return emscripten::val::null();
        const auto* placement = g_app->scene.registry().try_get<seraphim::scene::transform>(g_app->scene.find(id));
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
        if (!g_app)
            return;
        const entt::entity entity = g_app->scene.find(id);
        if (entity == entt::null)
            return;
        g_app->scene.registry().emplace_or_replace<seraphim::scene::transform>(
            entity, seraphim::scene::transform{{x, y}, rotation, {scale_x, scale_y}});
    }

    // Returns the id of the first entity with the name, or an empty string if there is none.
    static std::string find_entity(const std::string& name)
    {
        if (!g_app)
            return {};
        for (const auto [entity, entity_identity] :
             g_app->scene.registry().view<const seraphim::scene::identity>().each())
            if (entity_identity.name == name)
                return entity_identity.id;
        return {};
    }

    // Keys are SDL scancodes, which are USB HID usage ids.
    static bool is_key_down(int scancode)
    {
        return g_app && is_scancode(scancode) && g_app->input.is_down(static_cast<seraphim::platform::key>(scancode));
    }

    static bool was_key_pressed(int scancode)
    {
        return g_app && is_scancode(scancode) &&
               g_app->input.was_pressed(static_cast<seraphim::platform::key>(scancode));
    }

    static bool was_key_released(int scancode)
    {
        return g_app && is_scancode(scancode) &&
               g_app->input.was_released(static_cast<seraphim::platform::key>(scancode));
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

    static emscripten::val get_velocity(const std::string& entity_id)
    {
        const auto null = emscripten::val::null();

        if (!g_app || !g_app->physics)
            return null;

        const entt::entity entity = g_app->scene.find(entity_id);
        if (entity == entt::null)
            return null;

        auto velocity = g_app->physics->get_velocity(entity);
        if (!velocity)
            return null;

        auto result = emscripten::val::object();
        result.set("x", velocity->x);
        result.set("y", velocity->y);

        return result;
    }

    static void set_velocity(const std::string& entity_id, float velocity_x, float velocity_y)
    {
        if (!g_app || !g_app->physics)
            return;

        const entt::entity entity = g_app->scene.find(entity_id);
        if (entity == entt::null)
            return;

        g_app->physics->set_velocity(entity, {velocity_x, velocity_y});
    }

    static bool has_body(const std::string& id)
    {
        if (!g_app || !g_app->physics)
            return false;

        const entt::entity entity = g_app->scene.find(id);
        if (entity == entt::null)
            return false;

        return g_app->physics->has_body(entity);
    }

  private:
    static bool is_scancode(int value) { return value > SDL_SCANCODE_UNKNOWN && value < SDL_SCANCODE_COUNT; }
};

} // namespace

EMSCRIPTEN_BINDINGS(seraphim)
{
    emscripten::class_<engine_api>("Engine")
        .class_function("register_asset", &engine_api::register_asset)
        .class_function("load_scene", &engine_api::load_scene)
        .class_function("save_scene", &engine_api::save_scene)
        .class_function("tick_seconds", &engine_api::tick_seconds)
        .class_function("set_tick_handler", &engine_api::set_tick_handler)
        .class_function("get_transform", &engine_api::get_transform)
        .class_function("set_transform", &engine_api::set_transform)
        .class_function("find_entity", &engine_api::find_entity)
        .class_function("is_key_down", &engine_api::is_key_down)
        .class_function("was_key_pressed", &engine_api::was_key_pressed)
        .class_function("was_key_released", &engine_api::was_key_released)
        .class_function("start_simulation", &engine_api::start_simulation)
        .class_function("stop_simulation", &engine_api::stop_simulation)
        .class_function("screen_to_world", &engine_api::screen_to_world)
        .class_function("pick_entity", &engine_api::pick_entity)
        .class_function("get_camera", &engine_api::get_camera)
        .class_function("set_camera", &engine_api::set_camera)
        .class_function("get_velocity", &engine_api::get_velocity)
        .class_function("set_velocity", &engine_api::set_velocity)
        .class_function("has_body", &engine_api::has_body);
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
    const float tick_seconds = std::chrono::duration<float>(state.timestep.step()).count();
    for (int i = 0; i < ticks; ++i)
    {
        if (state.physics)
        {
            // Scripts run first, so physics acts on what they changed this tick.
            if (!state.tick_handler.isUndefined() && !state.tick_handler.isNull())
                state.tick_handler();
            state.physics->step(state.scene, tick_seconds);
        }
        // Edges belong to the first tick only, so a single press cannot fire twice when a slow frame runs several
        // ticks. With no tick this frame they are kept for the next one.
        if (i == 0)
            state.input.end_frame();
    }

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
