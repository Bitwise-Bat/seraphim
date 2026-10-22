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
    if (const auto existing = m_handles_by_id.find(id); existing != m_handles_by_id.end())
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
    slot.id = id;
    slot.in_use = true;

    const texture_handle handle{index, slot.generation};
    m_handles_by_id.emplace(id, handle);
    request(handle);
    return handle;
}

void asset_manager::unload(texture_handle handle)
{
    if (!find(handle))
        return;

    texture_slot& slot = m_slots[handle.index];
    m_handles_by_id.erase(slot.id);
    std::erase_if(m_pending, [handle](const auto& entry) { return entry.second == handle; });

    slot.id.clear();
    slot.texture.reset();
    slot.request.reset();
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
    for (const std::string& id : m_sources.take_changed())
    {
        if (const auto handle = m_handles_by_id.find(id); handle != m_handles_by_id.end())
            request(handle->second);
    }

    for (auto& [finished, result] : take_finished_images())
    {
        const auto pending = m_pending.find(finished);
        // Unloaded while the request was in flight.
        if (pending == m_pending.end())
            continue;

        const texture_handle handle = pending->second;
        m_pending.erase(pending);
        texture_slot& slot = m_slots[handle.index];

        if (slot.request != finished)
            continue;
        slot.request.reset();

        // A failed reload keeps showing the previous texture rather than the placeholder.
        if (!result)
            continue;

        slot.texture.emplace(m_device, result->width, result->height, result->rgba);
        log::info("Loaded texture '{}' ({}x{})", slot.id, result->width, result->height);
    }
}

void asset_manager::request(texture_handle handle)
{
    texture_slot& slot = m_slots[handle.index];
    // Without a source yet, the texture is requested once the host registers one.
    const std::string* url = m_sources.find(slot.id);
    if (!url)
        return;

    slot.request = request_image(*url);
    m_pending.emplace(*slot.request, handle);
}

const asset_manager::texture_slot* asset_manager::find(texture_handle handle) const
{
    if (handle.index >= m_slots.size())
        return nullptr;

    const texture_slot& slot = m_slots[handle.index];
    return slot.in_use && slot.generation == handle.generation ? &slot : nullptr;
}

} // namespace seraphim::asset
