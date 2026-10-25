#pragma once

#include <format>
#include <random>

namespace seraphim::core
{
[[nodiscard]] inline std::string generate_uuid()
{
    static std::mt19937_64 engine{std::random_device{}()};
    static std::uniform_int_distribution<std::uint64_t> dist;

    std::uint64_t high = dist(engine);
    std::uint64_t low = dist(engine);

    high = (high & 0xFFFFFFFFFFFF0FFFULL) | 0x0000000000004000ULL;
    low = (low & 0x3FFFFFFFFFFFFFFFULL) | 0x8000000000000000ULL;

    return std::format("{:08x}-{:04x}-{:04x}-{:04x}-{:012x}", static_cast<std::uint32_t>(high >> 32),
                       static_cast<std::uint16_t>((high >> 16) & 0xFFFF), static_cast<std::uint16_t>(high & 0xFFFF),
                       static_cast<std::uint16_t>(low >> 48), low & 0xFFFFFFFFFFFFULL);
}
}; // namespace seraphim::core
