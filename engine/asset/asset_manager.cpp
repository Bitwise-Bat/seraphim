#include "asset/asset_manager.hpp"

#include "asset/animation_set_file.hpp"
#include "asset/tileset_file.hpp"
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

animation_set_handle asset_manager::load_animation_set(const std::string& id)
{
    return load(m_animation_sets, id);
}

const animation_set* asset_manager::get_animation_set(animation_set_handle handle) const
{
    return m_animation_sets.store.get(handle);
}

tileset_handle asset_manager::load_tileset(const std::string& id)
{
    return load(m_tilesets, id);
}

const tileset* asset_manager::get_tileset(tileset_handle handle) const
{
    return m_tilesets.store.get(handle);
}

sound_handle asset_manager::load_sound(const std::string& id)
{
    if (const sound_handle existing = m_sounds.find(id); existing.valid())
        return existing;

    const sound_handle handle = m_sounds.add(id);
    m_sound_requests.resize(handle.index + 1);
    request(handle);
    return handle;
}

const sound* asset_manager::get_sound(sound_handle handle) const
{
    return m_sounds.get(handle);
}

void asset_manager::update()
{
    for (const std::string& id : m_sources.take_changed())
    {
        if (const texture_handle handle = m_textures.find(id); handle.valid())
            request(handle);
        if (const sound_handle handle = m_sounds.find(id); handle.valid())
            request(handle);
        request_changed(m_animation_sets, id);
        request_changed(m_tilesets, id);
    }
    finish_images();
    finish_sounds();
    finish_texts();
}

void asset_manager::finish_images()
{
    for (auto& [finished, result] : take_finished_images())
    {
        const auto pending = m_pending_images.find(finished);
        if (pending == m_pending_images.end())
            continue;

        const texture_handle handle = pending->second;
        m_pending_images.erase(pending);
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

void asset_manager::finish_sounds()
{
    for (const auto [finished, loaded] : platform::take_finished_sounds())
    {
        const auto pending = m_pending_sounds.find(finished);
        if (pending == m_pending_sounds.end())
            continue;

        const sound_handle handle = pending->second;
        m_pending_sounds.erase(pending);
        std::optional<platform::sound_request>& latest = m_sound_requests[handle.index];
        const bool newest = latest == finished;
        if (newest)
            latest.reset();

        // Like textures, a failed reload keeps the previous sound.
        if (!newest || !loaded)
        {
            if (loaded)
                platform::release_sound(finished);
            continue;
        }

        if (const sound* previous = m_sounds.get(handle))
            platform::release_sound(previous->samples);
        m_sounds.set(handle, {finished});
        log::info("Loaded sound '{}'", m_sounds.uuid(handle));
    }
}

void asset_manager::finish_texts()
{
    for (auto& [finished, result] : take_finished_texts())
    {
        const auto pending = m_pending_texts.find(finished);
        if (pending == m_pending_texts.end())
            continue;

        const auto asset = pending->second;
        m_pending_texts.erase(pending);
        std::visit([&](auto handle) { finish(handle, finished, result); }, asset);
    }
}

void asset_manager::finish(animation_set_handle handle, text_request finished, const std::optional<std::string>& text)
{
    // Like textures, a failed or invalid reload keeps the previous asset.
    if (!take_latest(m_animation_sets, handle, finished) || !text)
        return;

    auto parsed = parse_animation_set(*text);
    if (!parsed)
    {
        log::error("Animation set '{}' is invalid: {}", m_animation_sets.store.uuid(handle), parsed.error());
        return;
    }

    log::info("Loaded animation set '{}' ({} clips)", m_animation_sets.store.uuid(handle), parsed->clips.size());
    m_animation_sets.store.set(handle, std::move(*parsed));
}

void asset_manager::finish(tileset_handle handle, text_request finished, const std::optional<std::string>& text)
{
    if (!take_latest(m_tilesets, handle, finished) || !text)
        return;

    auto parsed = parse_tileset(*text);
    if (!parsed)
    {
        log::error("Tileset '{}' is invalid: {}", m_tilesets.store.uuid(handle), parsed.error());
        return;
    }

    parsed->handle = load_texture(parsed->texture);
    log::info("Loaded tileset '{}' ({}x{} px tiles)", m_tilesets.store.uuid(handle), parsed->tile_size.x,
              parsed->tile_size.y);
    m_tilesets.store.set(handle, std::move(*parsed));
}

void asset_manager::request(texture_handle handle)
{
    // Without a source yet, the texture is requested once the host registers one.
    const std::string* url = m_sources.find(m_textures.uuid(handle));
    if (!url)
        return;

    std::optional<image_request>& latest = m_texture_requests[handle.index];
    latest = request_image(*url);
    m_pending_images.emplace(*latest, handle);
}

void asset_manager::request(sound_handle handle)
{
    const std::string* url = m_sources.find(m_sounds.uuid(handle));
    if (!url)
        return;

    std::optional<platform::sound_request>& latest = m_sound_requests[handle.index];
    latest = platform::request_sound(*url);
    m_pending_sounds.emplace(*latest, handle);
}

template <typename T>
handle<T> asset_manager::load(text_assets<T>& assets, const std::string& id)
{
    if (const handle<T> existing = assets.store.find(id); existing.valid())
        return existing;

    const handle<T> added = assets.store.add(id);
    assets.requests.resize(added.index + 1);
    request(assets, added);
    return added;
}

template <typename T>
void asset_manager::request(text_assets<T>& assets, handle<T> handle)
{
    const std::string* url = m_sources.find(assets.store.uuid(handle));
    if (!url)
        return;

    std::optional<text_request>& latest = assets.requests[handle.index];
    latest = request_text(*url);
    m_pending_texts.emplace(*latest, handle);
}

template <typename T>
bool asset_manager::take_latest(text_assets<T>& assets, handle<T> handle, text_request finished)
{
    std::optional<text_request>& latest = assets.requests[handle.index];
    if (latest != finished)
        return false;
    latest.reset();
    return true;
}

template <typename T>
void asset_manager::request_changed(text_assets<T>& assets, const std::string& id)
{
    if (const handle<T> changed = assets.store.find(id); changed.valid())
        request(assets, changed);
}

} // namespace seraphim::asset
