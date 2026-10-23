#include "asset/asset_manager.hpp"

#include "core/log.hpp"

#include <array>
#include <utility>

namespace seraphim::asset
{

namespace
{

// A magenta and black checkerboard stands out, so missing textures are noticed instead of looking intentional.
render::texture2d make_placeholder(const wgpu::Device& device)
{
    constexpr std::byte on{0xff};
    constexpr std::byte off{0x00};
    constexpr std::array pixels{
        on,  off, on,  on, off, off, off, on, //
        off, off, off, on, on,  off, on,  on, //
    };
    return {device, 2, 2, pixels};
}

} // namespace

asset_manager::asset_manager(wgpu::Device device, asset_sources& sources)
    : m_device(std::move(device)), m_sources(sources), m_placeholder(make_placeholder(m_device))
{
}

texture_handle asset_manager::load_texture(const std::string& id)
{
    if (const texture_handle existing = m_textures.find(id); existing.valid())
        return existing;

    const texture_handle handle = m_textures.add(id);
    m_texture_requests.resize(handle.index + 1);
    request(handle);
    return handle;
}

const render::texture2d& asset_manager::texture(texture_handle handle) const
{
    const render::texture2d* loaded = m_textures.get(handle);
    return loaded ? *loaded : m_placeholder;
}

void asset_manager::update()
{
    for (const std::string& id : m_sources.take_changed())
    {
        if (const texture_handle handle = m_textures.find(id); handle.valid())
            request(handle);
    }

    for (auto& [finished, result] : take_finished_images())
    {
        const auto pending = m_pending.find(finished);
        if (pending == m_pending.end())
            continue;

        const texture_handle handle = pending->second;
        m_pending.erase(pending);
        std::optional<image_request>& latest = m_texture_requests[handle.index];

        if (latest != finished)
            continue;
        latest.reset();

        // A failed reload keeps showing the previous texture rather than the placeholder.
        if (!result)
            continue;

        m_textures.set(handle, {m_device, result->width, result->height, result->rgba});
        log::info("Loaded texture '{}' ({}x{})", m_textures.uuid(handle), result->width, result->height);
    }
}

void asset_manager::request(texture_handle handle)
{
    // Without a source yet, the texture is requested once the host registers one.
    const std::string* url = m_sources.find(m_textures.uuid(handle));
    if (!url)
        return;

    std::optional<image_request>& latest = m_texture_requests[handle.index];
    latest = request_image(*url);
    m_pending.emplace(*latest, handle);
}

} // namespace seraphim::asset
