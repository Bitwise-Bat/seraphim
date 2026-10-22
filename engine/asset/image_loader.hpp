#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace seraphim::asset
{

struct image
{
    std::uint32_t width = 0;
    std::uint32_t height = 0;
    std::vector<std::byte> rgba;
};

using image_request = std::uint32_t;

struct finished_image
{
    image_request request;
    std::optional<image> result;
};

// Fetches and decodes the image in the browser without blocking; collect the result with take_finished_images().
[[nodiscard]] image_request request_image(const std::string& url);

// Returns the requests completed since the previous call. A failed request has no result.
[[nodiscard]] std::vector<finished_image> take_finished_images();

} // namespace seraphim::asset
