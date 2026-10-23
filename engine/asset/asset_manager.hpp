#pragma once

#include "asset/animation_set.hpp"
#include "asset/asset_sources.hpp"
#include "asset/asset_store.hpp"
#include "asset/image_loader.hpp"
#include "asset/sound.hpp"
#include "asset/text_loader.hpp"
#include "asset/texture_handle.hpp"
#include "asset/tileset.hpp"
#include "platform/audio.hpp"
#include "render/texture2d.hpp"

#include <optional>
#include <string>
#include <unordered_map>
#include <variant>
#include <vector>
#include <webgpu/webgpu_cpp.h>

namespace seraphim::asset
{

class asset_manager
{
  public:
    asset_manager(wgpu::Device device, asset_sources& sources);

    // Returns at once; the texture streams in once its id has a source. Loading the same id again shares the handle.
    [[nodiscard]] texture_handle load_texture(const std::string& id);

    // Falls back to a placeholder while the texture is loading, if it failed, or if the handle is invalid.
    [[nodiscard]] const render::texture2d& texture(texture_handle handle) const;

    // Called once, when a scene loads, so ticks look animation sets up by handle. Works like load_texture.
    [[nodiscard]] animation_set_handle load_animation_set(const std::string& id);
    // Null while the set is loading, if it failed, or if the handle is invalid.
    [[nodiscard]] const animation_set* get_animation_set(animation_set_handle handle) const;

    // Also loads the tileset's texture once the tileset arrives. Works like load_texture.
    [[nodiscard]] tileset_handle load_tileset(const std::string& id);
    // Null while the tileset is loading, if it failed, or if the handle is invalid.
    [[nodiscard]] const tileset* get_tileset(tileset_handle handle) const;

    // Works like load_texture.
    [[nodiscard]] sound_handle load_sound(const std::string& id);
    // Null while the sound is loading, if it failed, or if the handle is invalid.
    [[nodiscard]] const sound* get_sound(sound_handle handle) const;

    // Requests assets whose source changed and stores the ones that finished loading since the last call.
    void update();

  private:
    // Assets parsed from text files, which all share one queue of text requests.
    template <typename T>
    struct text_assets
    {
        asset_store<T> store;
        // Indexed like the store's slots, for the same reason as m_texture_requests.
        std::vector<std::optional<text_request>> requests;
    };

    void request(texture_handle handle);
    void request(sound_handle handle);
    template <typename T>
    [[nodiscard]] handle<T> load(text_assets<T>& assets, const std::string& id);
    template <typename T>
    void request(text_assets<T>& assets, handle<T> handle);
    template <typename T>
    void request_changed(text_assets<T>& assets, const std::string& id);
    void finish_images();
    void finish_sounds();
    void finish_texts();
    // Returns whether the request is the newest one for the asset, and so may replace it.
    template <typename T>
    [[nodiscard]] bool take_latest(text_assets<T>& assets, handle<T> handle, text_request finished);
    void finish(animation_set_handle handle, text_request finished, const std::optional<std::string>& text);
    void finish(tileset_handle handle, text_request finished, const std::optional<std::string>& text);

    wgpu::Device m_device;
    asset_sources& m_sources;
    render::texture2d m_placeholder;
    asset_store<render::texture2d> m_textures;
    // Indexed like the texture slots. Only the newest request may replace a texture, so a slow reload cannot overwrite
    // a newer one.
    std::vector<std::optional<image_request>> m_texture_requests;
    std::unordered_map<image_request, texture_handle> m_pending_images;
    asset_store<sound> m_sounds;
    // Indexed like the sound slots, for the same reason as m_texture_requests.
    std::vector<std::optional<platform::sound_request>> m_sound_requests;
    std::unordered_map<platform::sound_request, sound_handle> m_pending_sounds;
    text_assets<animation_set> m_animation_sets;
    text_assets<tileset> m_tilesets;
    std::unordered_map<text_request, std::variant<animation_set_handle, tileset_handle>> m_pending_texts;
};

} // namespace seraphim::asset
