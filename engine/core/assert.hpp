#pragma once

#include "core/log.hpp"

#include <cstdlib>
#include <format>
#include <source_location>
#include <string_view>

namespace seraphim::core
{

[[noreturn]] inline void check_failed(std::string_view expression, std::string_view message,
                                      std::source_location location = std::source_location::current())
{
    log::write(log::level::error, std::format("check '{}' failed: {}", expression, message), location);
    std::abort();
}

} // namespace seraphim::core

#define SERAPHIM_CHECK(condition, message)                                                                             \
    ((condition) ? static_cast<void>(0) : ::seraphim::core::check_failed(#condition, message))

#ifdef NDEBUG
#define SERAPHIM_ASSERT(condition, message) static_cast<void>(0)
#else
#define SERAPHIM_ASSERT(condition, message) SERAPHIM_CHECK(condition, message)
#endif
