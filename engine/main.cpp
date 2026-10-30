#define SDL_MAIN_USE_CALLBACKS
#include "asset/asset_manager.hpp"
#include "core/fixed_timestep.hpp"
#include "core/log.hpp"
#include "core/version.hpp"
#include "platform/audio.hpp"
#include "platform/input.hpp"
#include "platform/window.hpp"
#include "render/renderer.hpp"
#include "scene/animation_system.hpp"
#include "scene/audio_system.hpp"
#include "scene/components.hpp"
#include "scene/physics_system.hpp"
#include "scene/picking.hpp"
#include "scene/scene.hpp"
#include "scene/scene_file.hpp"
#include "scene/sprite_system.hpp"
#include "scene/world.hpp"

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
    // Id of the entity the camera sits on. Applied right before drawing, so the camera sees the same position as the
    // sprite even though networked entities move every frame and not every tick.
    std::string camera_target;
    seraphim::scene::sprite_system sprites;
    std::optional<seraphim::scene::world> world;
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

        // The voices belong to the old scene's entities.
        seraphim::platform::stop_all_voices();
        g_app->camera_target.clear();
        g_app->world.emplace(std::move(*scene));
        seraphim::scene::g_world = &*g_app->world;

        if (g_app->assets)
        {
            seraphim::scene::animation_system::resolve(g_app->world->scene.registry(), *g_app->assets);
            seraphim::scene::audio_system::resolve(g_app->world->scene.registry(), *g_app->assets);
        }

        return {};
    }

    static void start_simulation()
    {
        if (!g_app || !g_app->world)
            return;
        g_app->world->start_simulation();
        if (g_app->assets)
            seraphim::scene::audio_system::start(g_app->world->scene.registry(), *g_app->assets);
    }

    static void stop_simulation()
    {
        if (!g_app || !g_app->world)
            return;
        g_app->world->stop_simulation();
        seraphim::platform::stop_all_voices();
        g_app->camera_target.clear();
    }

    // Ticks are fixed, so this is the same for every tick.
    static float tick_seconds()
    {
        if (!g_app)
            return 0.0F;
        return std::chrono::duration<float>(g_app->timestep.step()).count();
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

    static bool is_mouse_down(int button)
    {
        return g_app && is_mouse_button(button) &&
               g_app->input.is_down(static_cast<seraphim::platform::mouse_button>(button));
    }

    static bool was_mouse_pressed(int button)
    {
        return g_app && is_mouse_button(button) &&
               g_app->input.was_pressed(static_cast<seraphim::platform::mouse_button>(button));
    }

    static bool was_mouse_released(int button)
    {
        return g_app && is_mouse_button(button) &&
               g_app->input.was_released(static_cast<seraphim::platform::mouse_button>(button));
    }

    // SDL reports the cursor in window coordinates, while the camera maps canvas pixels, which differ on high-DPI
    // screens.
    static emscripten::val get_mouse_position()
    {
        const auto null = emscripten::val::null();

        if (!g_app)
            return null;

        int width = 0;
        int height = 0;
        if (!SDL_GetWindowSize(g_app->window.get(), &width, &height) || width == 0 || height == 0)
            return null;

        const glm::vec2 viewport = g_app->renderer.viewport_size();
        const glm::vec2 cursor{g_app->input.mouse_x(), g_app->input.mouse_y()};
        const glm::vec2 world = g_app->camera.screen_to_world(cursor * viewport / glm::vec2{width, height}, viewport);

        auto result = emscripten::val::object();
        result.set("x", world.x);
        result.set("y", world.y);
        return result;
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
        const entt::entity entity = seraphim::scene::pick_sprite(g_app->world->scene, world);
        if (entity == entt::null)
            return {};
        return g_app->world->scene.registry().get<seraphim::scene::identity>(entity).id;
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

    // An empty id stops following.
    static void follow_camera(std::string id)
    {
        if (g_app)
            g_app->camera_target = std::move(id);
    }

    static bool has_audio_source(const std::string& id)
    {
        if (!g_app)
            return false;
        auto& scene = g_app->world->scene;
        return scene.registry().all_of<seraphim::scene::audio_source>(scene.find(id));
    }

    static void play_audio(const std::string& id)
    {
        if (!g_app || !g_app->assets)
            return;
        auto& scene = g_app->world->scene;
        if (auto* source = scene.registry().try_get<seraphim::scene::audio_source>(scene.find(id)))
            seraphim::scene::audio_system::play(*source, *g_app->assets);
    }

    static void stop_audio(const std::string& id)
    {
        if (!g_app)
            return;
        auto& scene = g_app->world->scene;
        if (auto* source = scene.registry().try_get<seraphim::scene::audio_source>(scene.find(id)))
            seraphim::scene::audio_system::stop(*source);
    }

    static bool is_audio_playing(const std::string& id)
    {
        if (!g_app)
            return false;
        const auto& scene = g_app->world->scene;
        const auto* source = scene.registry().try_get<seraphim::scene::audio_source>(scene.find(id));
        return source && seraphim::scene::audio_system::is_playing(*source);
    }

    static float get_audio_volume(const std::string& id)
    {
        if (!g_app)
            return 0.0F;
        const auto& scene = g_app->world->scene;
        const auto* source = scene.registry().try_get<seraphim::scene::audio_source>(scene.find(id));
        return source ? source->volume : 0.0F;
    }

    static void set_audio_volume(const std::string& id, float volume)
    {
        if (!g_app)
            return;
        auto& scene = g_app->world->scene;
        if (auto* source = scene.registry().try_get<seraphim::scene::audio_source>(scene.find(id)))
            seraphim::scene::audio_system::set_volume(*source, volume);
    }

  private:
    static bool is_scancode(int value) { return value > SDL_SCANCODE_UNKNOWN && value < SDL_SCANCODE_COUNT; }
    static bool is_mouse_button(int value) { return value >= SDL_BUTTON_LEFT && value <= SDL_BUTTON_X2; }
};

} // namespace

EMSCRIPTEN_BINDINGS(seraphim)
{
    emscripten::class_<engine_api>("Engine")
        .class_function("register_asset", &engine_api::register_asset)
        .class_function("load_scene", &engine_api::load_scene)
        .class_function("tick_seconds", &engine_api::tick_seconds)
        .class_function("is_key_down", &engine_api::is_key_down)
        .class_function("was_key_pressed", &engine_api::was_key_pressed)
        .class_function("was_key_released", &engine_api::was_key_released)
        .class_function("start_simulation", &engine_api::start_simulation)
        .class_function("stop_simulation", &engine_api::stop_simulation)
        .class_function("screen_to_world", &engine_api::screen_to_world)
        .class_function("pick_entity", &engine_api::pick_entity)
        .class_function("get_camera", &engine_api::get_camera)
        .class_function("set_camera", &engine_api::set_camera)
        .class_function("follow_camera", &engine_api::follow_camera)
        .class_function("was_mouse_pressed", &engine_api::was_mouse_pressed)
        .class_function("was_mouse_released", &engine_api::was_mouse_released)
        .class_function("is_mouse_down", &engine_api::is_mouse_down)
        .class_function("get_mouse_position", &engine_api::get_mouse_position)
        .class_function("has_audio_source", &engine_api::has_audio_source)
        .class_function("play_audio", &engine_api::play_audio)
        .class_function("stop_audio", &engine_api::stop_audio)
        .class_function("is_audio_playing", &engine_api::is_audio_playing)
        .class_function("get_audio_volume", &engine_api::get_audio_volume)
        .class_function("set_audio_volume", &engine_api::set_audio_volume);
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
    // The bindings reach the world through g_app, so it exists before g_app is published.
    state->world.emplace(scene::scene{});
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
        if (state.world->physics)
        {
            state.world->tick(tick_seconds);
            if (state.assets)
            {
                auto& registry = state.world->scene.registry();
                seraphim::scene::animation_system::update(registry, *state.assets, tick_seconds);
                seraphim::scene::audio_system::update(registry, *state.assets, state.camera);
            }
        }
        // Edges belong to the first tick only, so a single press cannot fire twice when a slow frame runs several
        // ticks. With no tick this frame they are kept for the next one.
        if (i == 0)
            state.input.end_frame();
    }

    state.renderer.poll();
    if (!state.assets && state.renderer.device())
    {
        state.assets.emplace(state.renderer.device(), state.sources);
        // A scene loaded before the GPU was ready has not been resolved yet.
        seraphim::scene::animation_system::resolve(state.world->scene.registry(), *state.assets);
        seraphim::scene::audio_system::resolve(state.world->scene.registry(), *state.assets);
    }
    if (!state.assets)
        return SDL_APP_CONTINUE;

    state.assets->update();
    if (!state.camera_target.empty())
    {
        const auto& scene = state.world->scene;
        if (const auto* placement =
                scene.registry().try_get<seraphim::scene::transform>(scene.find(state.camera_target)))
            state.camera.position = placement->position;
    }
    state.renderer.begin(state.camera);
    state.sprites.draw(state.world->scene, *state.assets, state.renderer, state.camera);
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
