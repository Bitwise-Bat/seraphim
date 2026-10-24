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
#include "scene/navigator_grid.hpp"
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
        // The bodies and voices belong to the old scene's entities.
        g_app->physics.reset();
        seraphim::platform::stop_all_voices();
        g_app->scene = std::move(*scene);
        if (g_app->assets)
        {
            seraphim::scene::animation_system::resolve(g_app->scene.registry(), *g_app->assets);
            seraphim::scene::audio_system::resolve(g_app->scene.registry(), *g_app->assets);
        }
        return {};
    }

    static void start_simulation()
    {
        if (!g_app)
            return;
        g_app->physics.emplace(g_app->scene);
        if (g_app->assets)
            seraphim::scene::audio_system::start(g_app->scene.registry(), *g_app->assets);
    }

    static void stop_simulation()
    {
        if (!g_app)
            return;
        g_app->physics.reset();
        seraphim::platform::stop_all_voices();
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

    // Returns nothing when the entity does not exist or has no animator.
    static std::optional<std::string> get_clip(const std::string& id)
    {
        if (!g_app)
            return std::nullopt;
        const auto* player = g_app->scene.registry().try_get<seraphim::scene::animator>(g_app->scene.find(id));
        if (!player)
            return std::nullopt;
        return player->clip;
    }

    static void set_clip(const std::string& id, const std::string& clip)
    {
        if (!g_app)
            return;
        auto* player = g_app->scene.registry().try_get<seraphim::scene::animator>(g_app->scene.find(id));
        // Setting the playing clip again, as scripts do every tick, must not restart it.
        if (!player || player->clip == clip)
            return;
        player->clip = clip;
        player->frame = 0;
        player->elapsed = 0.0F;
    }

    static bool has_animator(const std::string& id)
    {
        return g_app && g_app->scene.registry().all_of<seraphim::scene::animator>(g_app->scene.find(id));
    }

    static bool has_audio_source(const std::string& id)
    {
        return g_app && g_app->scene.registry().all_of<seraphim::scene::audio_source>(g_app->scene.find(id));
    }

    static void play_audio(const std::string& id)
    {
        if (!g_app || !g_app->assets)
            return;
        if (auto* source = g_app->scene.registry().try_get<seraphim::scene::audio_source>(g_app->scene.find(id)))
            seraphim::scene::audio_system::play(*source, *g_app->assets);
    }

    static void stop_audio(const std::string& id)
    {
        if (!g_app)
            return;
        if (auto* source = g_app->scene.registry().try_get<seraphim::scene::audio_source>(g_app->scene.find(id)))
            seraphim::scene::audio_system::stop(*source);
    }

    static bool is_audio_playing(const std::string& id)
    {
        if (!g_app)
            return false;
        const auto* source = g_app->scene.registry().try_get<seraphim::scene::audio_source>(g_app->scene.find(id));
        return source && seraphim::scene::audio_system::is_playing(*source);
    }

    static float get_audio_volume(const std::string& id)
    {
        if (!g_app)
            return 0.0F;
        const auto* source = g_app->scene.registry().try_get<seraphim::scene::audio_source>(g_app->scene.find(id));
        return source ? source->volume : 0.0F;
    }

    static void set_audio_volume(const std::string& id, float volume)
    {
        if (!g_app)
            return;
        if (auto* source = g_app->scene.registry().try_get<seraphim::scene::audio_source>(g_app->scene.find(id)))
            seraphim::scene::audio_system::set_volume(*source, volume);
    }

    static bool has_tilemap(const std::string& id)
    {
        return g_app && g_app->scene.registry().all_of<seraphim::scene::tilemap>(g_app->scene.find(id));
    }

    static emscripten::val find_path(const std::string& tilemap_id, unsigned blocking_layer, unsigned start_x,
                                     unsigned start_y, unsigned end_x, unsigned end_y)
    {
        const auto null = emscripten::val::null();

        if (!g_app)
            return null;

        const auto* map = g_app->scene.registry().try_get<seraphim::scene::tilemap>(g_app->scene.find(tilemap_id));
        if (!map)
            return null;

        const seraphim::scene::navigator_grid grid(*map, blocking_layer);
        const auto waypoints = grid.find_path({start_x, start_y}, {end_x, end_y});
        if (!waypoints)
            return null;

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
        const auto null = emscripten::val::null();

        if (!g_app)
            return null;

        const entt::entity entity = g_app->scene.find(tilemap_id);
        const auto* map = g_app->scene.registry().try_get<seraphim::scene::tilemap>(entity);
        const auto* placement = g_app->scene.registry().try_get<seraphim::scene::transform>(entity);
        if (!map || !placement)
            return null;

        const glm::vec2 cell = map->cell_size * placement->scale;
        if (cell.x == 0.0F || cell.y == 0.0F)
            return null;

        // Same mapping as sprite_system::draw_tilemap: rows run downwards from the transform's position.
        const float cosine = std::cos(placement->rotation);
        const float sine = std::sin(placement->rotation);
        const glm::vec2 offset = glm::vec2{world_x, world_y} - placement->position;
        const glm::vec2 local{(offset.x * cosine) + (offset.y * sine), (offset.y * cosine) - (offset.x * sine)};
        const glm::vec2 grid = glm::floor(glm::vec2{local.x / cell.x, -local.y / cell.y});
        if (grid.x < 0.0F || grid.y < 0.0F || grid.x >= static_cast<float>(map->size.x) ||
            grid.y >= static_cast<float>(map->size.y))
            return null;

        auto result = emscripten::val::object();
        result.set("x", static_cast<unsigned>(grid.x));
        result.set("y", static_cast<unsigned>(grid.y));
        return result;
    }

    // The inverse of get_cell_at_coord: the world position of a cell's centre, so movers aim at the middle of a tile.
    static emscripten::val get_cell_center(const std::string& tilemap_id, unsigned cell_x, unsigned cell_y)
    {
        const auto null = emscripten::val::null();

        if (!g_app)
            return null;

        const entt::entity entity = g_app->scene.find(tilemap_id);
        const auto* map = g_app->scene.registry().try_get<seraphim::scene::tilemap>(entity);
        const auto* placement = g_app->scene.registry().try_get<seraphim::scene::transform>(entity);
        if (!map || !placement || cell_x >= map->size.x || cell_y >= map->size.y)
            return null;

        const glm::vec2 cell = map->cell_size * placement->scale;
        const float cosine = std::cos(placement->rotation);
        const float sine = std::sin(placement->rotation);
        const glm::vec2 local{(static_cast<float>(cell_x) + 0.5F) * cell.x,
                              -(static_cast<float>(cell_y) + 0.5F) * cell.y};
        const glm::vec2 world = placement->position +
                                glm::vec2{(local.x * cosine) - (local.y * sine), (local.x * sine) + (local.y * cosine)};

        auto result = emscripten::val::object();
        result.set("x", world.x);
        result.set("y", world.y);
        return result;
    }

  private:
    static bool is_scancode(int value) { return value > SDL_SCANCODE_UNKNOWN && value < SDL_SCANCODE_COUNT; }
    static bool is_mouse_button(int value) { return value >= SDL_BUTTON_LEFT && value <= SDL_BUTTON_X2; }
};

} // namespace

EMSCRIPTEN_BINDINGS(seraphim)
{
    emscripten::register_optional<std::string>();

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
        .class_function("has_body", &engine_api::has_body)
        .class_function("set_clip", &engine_api::set_clip)
        .class_function("get_clip", &engine_api::get_clip)
        .class_function("has_animator", &engine_api::has_animator)
        .class_function("find_path", &engine_api::find_path)
        .class_function("has_tilemap", &engine_api::has_tilemap)
        .class_function("get_cell_at_coord", &engine_api::get_cell_at_coord)
        .class_function("get_cell_center", &engine_api::get_cell_center)
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
            if (state.assets)
            {
                seraphim::scene::animation_system::update(state.scene.registry(), *state.assets, tick_seconds);
                seraphim::scene::audio_system::update(state.scene.registry(), *state.assets, state.camera);
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
        seraphim::scene::animation_system::resolve(state.scene.registry(), *state.assets);
        seraphim::scene::audio_system::resolve(state.scene.registry(), *state.assets);
    }
    if (!state.assets)
        return SDL_APP_CONTINUE;

    state.assets->update();
    state.renderer.begin(state.camera);
    state.sprites.draw(state.scene, *state.assets, state.renderer, state.camera);
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
