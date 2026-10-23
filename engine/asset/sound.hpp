#pragma once

#include "asset/handle.hpp"
#include "platform/audio.hpp"

namespace seraphim::asset
{

// The samples stay with the browser, which plays them, so the asset only names them.
struct sound
{
    platform::sound_request samples = 0;
};

using sound_handle = handle<sound>;

} // namespace seraphim::asset
