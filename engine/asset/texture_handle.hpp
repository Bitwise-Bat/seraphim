#pragma once

#include "asset/handle.hpp"

namespace seraphim::render
{
class texture2d;
}

namespace seraphim::asset
{

using texture_handle = handle<render::texture2d>;

} // namespace seraphim::asset
