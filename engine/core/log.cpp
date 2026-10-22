#include "core/log.hpp"

#include <emscripten/console.h>
#include <string>

namespace seraphim::log
{
namespace
{

struct state
{
    level minimum = level::trace;
    sink output = console_sink;
};

state& current()
{
    static state instance;
    return instance;
}

std::string_view level_name(level severity)
{
    switch (severity)
    {
    case level::trace:
        return "trace";
    case level::debug:
        return "debug";
    case level::info:
        return "info";
    case level::warn:
        return "warn";
    case level::error:
        return "error";
    }
    return "unknown";
}

} // namespace

void console_sink(const record& entry)
{
    std::string_view file = entry.location.file_name();
    file.remove_prefix(file.find_last_of("/\\") + 1);
    const std::string line =
        std::format("[{}] {}:{}: {}", level_name(entry.severity), file, entry.location.line(), entry.message);

    switch (entry.severity)
    {
    case level::warn:
        emscripten_console_warn(line.c_str());
        break;
    case level::error:
        emscripten_console_error(line.c_str());
        break;
    default:
        emscripten_console_log(line.c_str());
        break;
    }
}

void set_sink(sink output)
{
    current().output = output ? std::move(output) : sink{console_sink};
}

void set_level(level minimum)
{
    current().minimum = minimum;
}

bool is_enabled(level severity)
{
    return severity >= current().minimum;
}

void write(level severity, std::string_view message, std::source_location location)
{
    if (is_enabled(severity))
        current().output(record{.severity = severity, .message = message, .location = location});
}

} // namespace seraphim::log
