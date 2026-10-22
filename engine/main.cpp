#define SDL_MAIN_USE_CALLBACKS
#include "core/log.hpp"
#include "core/version.hpp"
#include "platform/input.hpp"
#include "platform/window.hpp"

#include <memory>
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>

namespace
{

struct app_state
{
    seraphim::platform::window window;
    seraphim::platform::input input;
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

    *appstate = std::make_unique<app_state>(std::move(window)).release();
    return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppIterate(void* appstate)
{
    static_cast<app_state*>(appstate)->input.end_frame();
    return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppEvent(void* appstate, SDL_Event* event)
{
    if (event->type == SDL_EVENT_QUIT)
        return SDL_APP_SUCCESS;

    static_cast<app_state*>(appstate)->input.handle(*event);
    return SDL_APP_CONTINUE;
}

void SDL_AppQuit(void* appstate, SDL_AppResult)
{
    // SDL hands ownership back here; SDL_Quit runs after this returns.
    std::unique_ptr<app_state> state{static_cast<app_state*>(appstate)};
}
