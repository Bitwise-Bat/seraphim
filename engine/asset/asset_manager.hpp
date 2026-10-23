#pragma once

#include "asset/animation_set.hpp"
#include "asset/asset_sources.hpp"
#include "asset/asset_store.hpp"
#include "asset/image_loader.hpp"
#include "asset/texture_handle.hpp"
#include "render/texture2d.hpp"

#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
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

    // Resolves the id once, when a scene loads, so ticks look animation sets up by handle.
    [[nodiscard]] animation_set_handle find_animation_set(std::string_view uuid) const;
    [[nodiscard]] const animation_set* get_animation_set(animation_set_handle handle) const;

    // Requests textures whose source changed and uploads images that finished decoding since the last call.
    void update();

  private:
    void request(texture_handle handle);

    wgpu::Device m_device;
    asset_sources& m_sources;
    render::texture2d m_placeholder;
    asset_store<render::texture2d> m_textures;
    // Indexed like the texture slots. Only the newest request may replace a texture, so a slow reload cannot overwrite
    // a newer one.
    std::vector<std::optional<image_request>> m_texture_requests;
    std::unordered_map<image_request, texture_handle> m_pending;
    asset_store<animation_set> m_animation_sets;
};

} // namespace seraphim::asset
