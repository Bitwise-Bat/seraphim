#include "render/texture2d.hpp"

#include "core/assert.hpp"

namespace seraphim::render
{

texture2d::texture2d(const wgpu::Device& device, std::uint32_t width, std::uint32_t height,
                     std::span<const std::byte> rgba)
    : m_width(width), m_height(height)
{
    constexpr std::uint32_t bytes_per_pixel = 4;
    SERAPHIM_CHECK(rgba.size() == std::size_t{width} * height * bytes_per_pixel,
                   "pixel data does not match texture size");

    const wgpu::Extent3D size{width, height, 1};

    wgpu::TextureDescriptor descriptor{};
    descriptor.usage = wgpu::TextureUsage::TextureBinding | wgpu::TextureUsage::CopyDst;
    descriptor.dimension = wgpu::TextureDimension::e2D;
    descriptor.size = size;
    // Not the sRGB variant: the canvas surface is not sRGB either, so colors pass through unchanged.
    descriptor.format = wgpu::TextureFormat::RGBA8Unorm;
    m_texture = device.CreateTexture(&descriptor);

    wgpu::TexelCopyTextureInfo destination{};
    destination.texture = m_texture;
    wgpu::TexelCopyBufferLayout layout{};
    layout.bytesPerRow = width * bytes_per_pixel;
    layout.rowsPerImage = height;
    device.GetQueue().WriteTexture(&destination, rgba.data(), rgba.size(), &layout, &size);

    m_view = m_texture.CreateView();
}

} // namespace seraphim::render
