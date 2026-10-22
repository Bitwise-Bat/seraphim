#pragma once

#include "asset/texture_handle.hpp"
#include "render/sprite.hpp"

#include <cstddef>
#include <cstdint>
#include <glm/mat4x4.hpp>
#include <glm/vec2.hpp>
#include <glm/vec4.hpp>
#include <vector>
#include <webgpu/webgpu_cpp.h>

namespace seraphim::asset
{
class asset_manager;
}

namespace seraphim::render
{

// Collects sprites for one frame and draws them instanced, one draw call per run of sprites sharing a texture.
// Sprites are drawn in submission order, so the caller controls layering.
class sprite_renderer
{
  public:
    sprite_renderer(const wgpu::Device& device, wgpu::TextureFormat target_format);

    void begin(const glm::mat4& view_projection);
    void draw(const sprite& item);
    void flush(const wgpu::RenderPassEncoder& pass, const asset::asset_manager& assets);

  private:
    // Matches the vertex attributes of the instance struct in sprite.wgsl.
    struct instance
    {
        glm::vec4 uv_rect;
        glm::vec4 color;
        glm::vec2 position;
        glm::vec2 size;
        float rotation = 0.0F;
    };

    struct batch
    {
        asset::texture_handle texture;
        std::uint32_t first_instance = 0;
        std::uint32_t instance_count = 0;
    };

    [[nodiscard]] static wgpu::RenderPipeline create_pipeline(const wgpu::Device& device,
                                                              wgpu::TextureFormat target_format,
                                                              const wgpu::BindGroupLayout& frame_layout,
                                                              const wgpu::BindGroupLayout& texture_layout);
    void reserve_instances(std::size_t count);

    wgpu::Device m_device;
    wgpu::RenderPipeline m_pipeline;
    wgpu::BindGroupLayout m_texture_layout;
    wgpu::Buffer m_camera_buffer;
    wgpu::BindGroup m_frame_group;
    wgpu::Buffer m_instance_buffer;
    std::size_t m_instance_capacity = 0;
    std::vector<instance> m_instances;
    std::vector<batch> m_batches;
};

} // namespace seraphim::render
