#pragma once

#include <cstdint>
#include <webgpu/webgpu_cpp.h>

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
    void render();

    // Null until the browser has granted a device.
    [[nodiscard]] const wgpu::Device& device() const { return m_device; }

  private:
    void request_device();
    void configure_surface();
    [[nodiscard]] bool is_configured() const;

    wgpu::Instance m_instance;
    wgpu::Surface m_surface;
    wgpu::Adapter m_adapter;
    wgpu::Device m_device;
    wgpu::TextureFormat m_format = wgpu::TextureFormat::Undefined;
    std::uint32_t m_width = 0;
    std::uint32_t m_height = 0;
};

} // namespace seraphim::render
