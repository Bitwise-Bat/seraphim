#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace seraphim::asset
{

using text_request = std::uint32_t;

struct finished_text
{
    text_request request;
    std::optional<std::string> result;
};

// Fetches the file as UTF-8 text without blocking; collect the result with take_finished_texts().
[[nodiscard]] text_request request_text(const std::string& url);

// Returns the requests completed since the previous call. A failed request has no result.
[[nodiscard]] std::vector<finished_text> take_finished_texts();

} // namespace seraphim::asset
