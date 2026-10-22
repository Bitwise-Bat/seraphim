#pragma once

#include "asset/asset_sources.hpp"
#include "asset/image_loader.hpp"
#include "asset/texture_handle.hpp"
#include "render/texture2d.hpp"

#include <cstdint>
#include <optional>
#include <string>
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
    void unload(texture_handle handle);

    // Falls back to a placeholder while the texture is loading, if it failed, or if the handle is stale.
    [[nodiscard]] const render::texture2d& texture(texture_handle handle) const;

    // Requests textures whose source changed and uploads images that finished decoding since the last call.
    void update();

  private:
    struct texture_slot
    {
        std::string id;
        std::optional<render::texture2d> texture;
        // Only the newest request may replace the texture, so a slow reload cannot overwrite a newer one.
        std::optional<image_request> request;
        std::uint32_t generation = 1;
        bool in_use = false;
    };

    void request(texture_handle handle);
    [[nodiscard]] const texture_slot* find(texture_handle handle) const;

    wgpu::Device m_device;
    asset_sources& m_sources;
    render::texture2d m_placeholder;
    std::vector<texture_slot> m_slots;
    std::vector<std::uint32_t> m_free_slots;
    std::unordered_map<std::string, texture_handle> m_handles_by_id;
    std::unordered_map<image_request, texture_handle> m_pending;
};

} // namespace seraphim::asset
