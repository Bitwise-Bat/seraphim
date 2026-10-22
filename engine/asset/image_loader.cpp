#include "asset/image_loader.hpp"

#include <emscripten/em_js.h>
#include <emscripten/emscripten.h>
#include <unordered_map>
#include <utility>

namespace
{

using seraphim::asset::finished_image;
using seraphim::asset::image;
using seraphim::asset::image_request;

image_request g_next_request = 0;
std::unordered_map<image_request, image> g_in_flight;
std::vector<finished_image> g_finished;

} // namespace

// The browser's decoder handles every format it supports and keeps decoding off the wasm side.
// clang-format off
EM_JS(void, seraphim_fetch_image, (const char* url, std::uint32_t request), {
    const path = UTF8ToString(url);
    fetch(path)
        .then((response) => {
            if (!response.ok)
                throw new Error(response.status + ' ' + response.statusText);
            return response.blob();
        })
        .then((blob) => createImageBitmap(blob, {premultiplyAlpha: 'none', colorSpaceConversion: 'none'}))
        .then((bitmap) => {
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext('2d');
            context.drawImage(bitmap, 0, 0);
            const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
            const destination = _seraphim_image_buffer(request, pixels.length);
            HEAPU8.set(pixels, destination);
            _seraphim_image_loaded(request, bitmap.width, bitmap.height);
        })
        .catch((error) => {
            console.error('Failed to load image ' + path + ':', error);
            _seraphim_image_failed(request);
        });
});
// clang-format on

extern "C"
{
    EMSCRIPTEN_KEEPALIVE std::byte* seraphim_image_buffer(image_request request, std::size_t size)
    {
        auto& pixels = g_in_flight[request].rgba;
        pixels.resize(size);
        return pixels.data();
    }

    EMSCRIPTEN_KEEPALIVE void seraphim_image_loaded(image_request request, std::uint32_t width, std::uint32_t height)
    {
        auto node = g_in_flight.extract(request);
        node.mapped().width = width;
        node.mapped().height = height;
        g_finished.push_back({request, std::move(node.mapped())});
    }

    EMSCRIPTEN_KEEPALIVE void seraphim_image_failed(image_request request)
    {
        g_in_flight.erase(request);
        g_finished.push_back({request, std::nullopt});
    }
}

namespace seraphim::asset
{

image_request request_image(const std::string& url)
{
    const image_request request = g_next_request++;
    seraphim_fetch_image(url.c_str(), request);
    return request;
}

std::vector<finished_image> take_finished_images()
{
    return std::exchange(g_finished, {});
}

} // namespace seraphim::asset
