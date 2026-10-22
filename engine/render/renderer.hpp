#pragma once

#include "render/camera2d.hpp"
#include "render/sprite.hpp"
#include "render/sprite_renderer.hpp"

#include <cstdint>
#include <glm/vec2.hpp>
#include <optional>
#include <webgpu/webgpu_cpp.h>

namespace seraphim::asset
{
class asset_manager;
}

namespace seraphim::render
{

// Owns the WebGPU device and the canvas surface. The browser hands out the device asynchronously, so frames are
// skipped until it arrives. Not movable: pending GPU callbacks hold a pointer to it.
class renderer
{
  public:
    explicit renderer(const char* canvas_selector);
    renderer(const renderer&) = delete;
    renderer& operator=(const renderer&) = delete;

    void resize(std::uint32_t width, std::uint32_t height);

    // Delivers pending GPU callbacks, including the device once the browser grants it.
    void poll();

    void begin(const camera2d& camera);
    void draw(const sprite& item);
    // Clears the canvas and draws everything submitted since begin().
    void end(const asset::asset_manager& assets);

    // Null until the browser has granted a device.
    [[nodiscard]] const wgpu::Device& device() const { return m_device; }
    // In pixels, as last passed to resize().
    [[nodiscard]] glm::vec2 viewport_size() const { return {m_width, m_height}; }

  private:
    void request_device();
    void configure_surface();
    [[nodiscard]] bool is_configured() const;

    wgpu::Instance m_instance;
    wgpu::Surface m_surface;
    wgpu::Adapter m_adapter;
    wgpu::Device m_device;
    wgpu::TextureFormat m_format = wgpu::TextureFormat::Undefined;
    std::optional<sprite_renderer> m_sprites;
    std::uint32_t m_width = 0;
    std::uint32_t m_height = 0;
};

} // namespace seraphim::render
