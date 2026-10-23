#include "asset/text_loader.hpp"

#include <emscripten/em_js.h>
#include <emscripten/emscripten.h>
#include <unordered_map>
#include <utility>

namespace
{

using seraphim::asset::finished_text;
using seraphim::asset::text_request;

text_request g_next_request = 0;
std::unordered_map<text_request, std::string> g_in_flight;
std::vector<finished_text> g_finished;

} // namespace

// clang-format off
EM_JS(void, seraphim_fetch_text, (const char* url, std::uint32_t request), {
    const path = UTF8ToString(url);
    fetch(path)
        .then((response) => {
            if (!response.ok)
                throw new Error(response.status + ' ' + response.statusText);
            return response.arrayBuffer();
        })
        .then((buffer) => {
            const bytes = new Uint8Array(buffer);
            const destination = _seraphim_text_buffer(request, bytes.length);
            HEAPU8.set(bytes, destination);
            _seraphim_text_loaded(request);
        })
        .catch((error) => {
            console.error('Failed to load ' + path + ':', error);
            _seraphim_text_failed(request);
        });
});
// clang-format on

extern "C"
{
    EMSCRIPTEN_KEEPALIVE char* seraphim_text_buffer(text_request request, std::size_t size)
    {
        auto& text = g_in_flight[request];
        text.resize(size);
        return text.data();
    }

    EMSCRIPTEN_KEEPALIVE void seraphim_text_loaded(text_request request)
    {
        auto node = g_in_flight.extract(request);
        g_finished.push_back({request, std::move(node.mapped())});
    }

    EMSCRIPTEN_KEEPALIVE void seraphim_text_failed(text_request request)
    {
        g_in_flight.erase(request);
        g_finished.push_back({request, std::nullopt});
    }
}

namespace seraphim::asset
{

text_request request_text(const std::string& url)
{
    const text_request request = g_next_request++;
    seraphim_fetch_text(url.c_str(), request);
    return request;
}

std::vector<finished_text> take_finished_texts()
{
    return std::exchange(g_finished, {});
}

} // namespace seraphim::asset
