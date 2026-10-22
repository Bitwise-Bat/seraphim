#include "platform/window.hpp"

#include "core/log.hpp"

#include <SDL3/SDL_error.h>
#include <SDL3/SDL_properties.h>

namespace seraphim::platform
{

window create_window(const std::string& title)
{
    const SDL_PropertiesID properties = SDL_CreateProperties();
    SDL_SetStringProperty(properties, SDL_PROP_WINDOW_CREATE_TITLE_STRING, title.c_str());
    SDL_SetStringProperty(properties, SDL_PROP_WINDOW_CREATE_EMSCRIPTEN_CANVAS_ID_STRING, canvas_selector);
    SDL_SetBooleanProperty(properties, SDL_PROP_WINDOW_CREATE_RESIZABLE_BOOLEAN, true);
    SDL_SetBooleanProperty(properties, SDL_PROP_WINDOW_CREATE_HIGH_PIXEL_DENSITY_BOOLEAN, true);

    window result{SDL_CreateWindowWithProperties(properties)};
    SDL_DestroyProperties(properties);

    if (!result)
        log::error("Failed to create window: {}", SDL_GetError());
    return result;
}

} // namespace seraphim::platform
