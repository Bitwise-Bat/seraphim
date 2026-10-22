#pragma once

#include <memory>
#include <SDL3/SDL_video.h>
#include <string>

namespace seraphim::platform
{

struct window_deleter
{
    void operator()(SDL_Window* handle) const noexcept { SDL_DestroyWindow(handle); }
};

using window = std::unique_ptr<SDL_Window, window_deleter>;

// Emscripten resolves selectors with document.querySelector, so the host page must give its canvas this id.
inline constexpr const char* canvas_selector = "#seraphim-canvas";

[[nodiscard]] window create_window(const std::string& title);

} // namespace seraphim::platform
