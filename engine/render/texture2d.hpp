#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <webgpu/webgpu_cpp.h>

namespace seraphim::render
{

class texture2d
{
  public:
    // Expects tightly packed 8-bit RGBA rows, top row first.
    texture2d(const wgpu::Device& device, std::uint32_t width, std::uint32_t height, std::span<const std::byte> rgba);

    [[nodiscard]] std::uint32_t width() const { return m_width; }
    [[nodiscard]] std::uint32_t height() const { return m_height; }
    [[nodiscard]] const wgpu::TextureView& view() const { return m_view; }

  private:
    wgpu::Texture m_texture;
    wgpu::TextureView m_view;
    std::uint32_t m_width;
    std::uint32_t m_height;
};

} // namespace seraphim::render
