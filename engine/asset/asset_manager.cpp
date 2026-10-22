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

asset_manager::asset_manager(wgpu::Device device)
    : m_device(std::move(device)), m_placeholder(make_placeholder(m_device))
{
}

texture_handle asset_manager::load_texture(const std::string& url)
{
    if (const auto existing = m_handles_by_url.find(url); existing != m_handles_by_url.end())
        return existing->second;

    std::uint32_t index = 0;
    if (m_free_slots.empty())
    {
        index = static_cast<std::uint32_t>(m_slots.size());
        m_slots.emplace_back();
    }
    else
    {
        index = m_free_slots.back();
        m_free_slots.pop_back();
    }

    texture_slot& slot = m_slots[index];
    slot.url = url;
    slot.in_use = true;

    const texture_handle handle{index, slot.generation};
    m_handles_by_url.emplace(url, handle);
    m_pending.emplace(request_image(url), handle);
    return handle;
}

void asset_manager::unload(texture_handle handle)
{
    if (!find(handle))
        return;

    texture_slot& slot = m_slots[handle.index];
    m_handles_by_url.erase(slot.url);
    std::erase_if(m_pending, [handle](const auto& entry) { return entry.second == handle; });

    slot.url.clear();
    slot.texture.reset();
    slot.in_use = false;
    ++slot.generation;
    m_free_slots.push_back(handle.index);
}

const render::texture2d& asset_manager::texture(texture_handle handle) const
{
    const texture_slot* slot = find(handle);
    return slot && slot->texture ? *slot->texture : m_placeholder;
}

void asset_manager::update()
{
    for (auto& [request, result] : take_finished_images())
    {
        const auto pending = m_pending.find(request);
        // Unloaded while the request was in flight.
        if (pending == m_pending.end())
            continue;

        const texture_handle handle = pending->second;
        m_pending.erase(pending);
        texture_slot& slot = m_slots[handle.index];

        if (!result)
            continue;

        slot.texture.emplace(m_device, result->width, result->height, result->rgba);
        log::info("Loaded texture '{}' ({}x{})", slot.url, result->width, result->height);
    }
}

const asset_manager::texture_slot* asset_manager::find(texture_handle handle) const
{
    if (handle.index >= m_slots.size())
        return nullptr;

    const texture_slot& slot = m_slots[handle.index];
    return slot.in_use && slot.generation == handle.generation ? &slot : nullptr;
}

} // namespace seraphim::asset
