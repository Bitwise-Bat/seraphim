#pragma once

#include <cstdint>

namespace seraphim::asset
{

// The generation detects handles that outlive an unload, even after their slot has been reused.
struct texture_handle
{
    std::uint32_t index = 0;
    std::uint32_t generation = 0;

    friend bool operator==(const texture_handle&, const texture_handle&) = default;
};

} // namespace seraphim::asset
