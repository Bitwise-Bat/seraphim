#pragma once

#include <cstdint>
#include <format>
#include <functional>
#include <source_location>
#include <string_view>
#include <type_traits>
#include <utility>

namespace seraphim::log
{

enum class level : std::uint8_t
{
    trace,
    debug,
    info,
    warn,
    error,
};

struct record
{
    level severity;
    std::string_view message;
    std::source_location location;
};

using sink = std::function<void(const record&)>;

void console_sink(const record& entry);
void set_sink(sink output);
void set_level(level minimum);
[[nodiscard]] bool is_enabled(level severity);
void write(level severity, std::string_view message, std::source_location location = std::source_location::current());

// Carries the call site alongside the format string, since a defaulted parameter cannot follow a variadic pack.
template <typename... Args>
struct format_with_location
{
    std::format_string<Args...> format;
    std::source_location location;

    template <typename String>
    consteval format_with_location(const String& text, std::source_location where = std::source_location::current())
        : format(text), location(where)
    {
    }
};

#ifdef NDEBUG
inline constexpr level compiled_level = level::info;
#else
inline constexpr level compiled_level = level::trace;
#endif

template <level Severity, typename... Args>
void emit(format_with_location<std::type_identity_t<Args>...> format, Args&&... args)
{
    if constexpr (Severity >= compiled_level)
    {
        if (is_enabled(Severity))
            write(Severity, std::format(format.format, std::forward<Args>(args)...), format.location);
    }
}

template <typename... Args>
void trace(format_with_location<std::type_identity_t<Args>...> format, Args&&... args)
{
    emit<level::trace>(format, std::forward<Args>(args)...);
}

template <typename... Args>
void debug(format_with_location<std::type_identity_t<Args>...> format, Args&&... args)
{
    emit<level::debug>(format, std::forward<Args>(args)...);
}

template <typename... Args>
void info(format_with_location<std::type_identity_t<Args>...> format, Args&&... args)
{
    emit<level::info>(format, std::forward<Args>(args)...);
}

template <typename... Args>
void warn(format_with_location<std::type_identity_t<Args>...> format, Args&&... args)
{
    emit<level::warn>(format, std::forward<Args>(args)...);
}

template <typename... Args>
void error(format_with_location<std::type_identity_t<Args>...> format, Args&&... args)
{
    emit<level::error>(format, std::forward<Args>(args)...);
}

} // namespace seraphim::log
