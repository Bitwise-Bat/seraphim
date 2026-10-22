#define SDL_MAIN_USE_CALLBACKS
#include "asset/asset_manager.hpp"
#include "core/fixed_timestep.hpp"
#include "core/log.hpp"
#include "core/version.hpp"
#include "platform/input.hpp"
#include "platform/window.hpp"
#include "render/renderer.hpp"

#include <chrono>
#include <cstdint>
#include <memory>
#include <optional>
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>

namespace
{

constexpr auto tick_rate = 60;

struct app_state
{
    seraphim::platform::window window;
    seraphim::platform::input input;
    seraphim::core::fixed_timestep timestep{std::chrono::nanoseconds{std::chrono::seconds{1}} / tick_rate};
    seraphim::render::renderer renderer{seraphim::platform::canvas_selector};
    // Created once the renderer has a device, since uploading textures needs one.
    std::optional<seraphim::asset::asset_manager> assets;
    seraphim::render::camera2d camera;
};

} // namespace

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
    *appstate = state.release();
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
        state.assets.emplace(state.renderer.device());
    if (!state.assets)
        return SDL_APP_CONTINUE;

    state.assets->update();
    state.renderer.begin(state.camera);
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
}
