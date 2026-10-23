#pragma once

#include <cstdint>
#include <limits>

namespace seraphim::asset
{

// The type parameter only keeps handles of different asset types apart.
template <typename T>
struct handle
{
    static constexpr std::uint32_t invalid = std::numeric_limits<std::uint32_t>::max();

    std::uint32_t index = invalid;

    [[nodiscard]] bool valid() const { return index != invalid; }

    friend bool operator==(const handle&, const handle&) = default;
};

} // namespace seraphim::asset
