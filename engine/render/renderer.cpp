#include "render/renderer.hpp"

#include "core/log.hpp"

#include <string_view>
#include <utility>

namespace seraphim::render
{

namespace
{

constexpr wgpu::Color clear_color{0.05, 0.07, 0.10, 1.0};

} // namespace

renderer::renderer(const char* canvas_selector) : m_instance(wgpu::CreateInstance())
{
    wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector canvas{};
    canvas.selector = canvas_selector;
    wgpu::SurfaceDescriptor surface_descriptor{};
    surface_descriptor.nextInChain = &canvas;
    m_surface = m_instance.CreateSurface(&surface_descriptor);

    // AllowProcessEvents defers callbacks to render(), so they can never run after this object is gone.
    m_instance.RequestAdapter(nullptr, wgpu::CallbackMode::AllowProcessEvents,
                              [this](wgpu::RequestAdapterStatus status, wgpu::Adapter adapter, wgpu::StringView message)
                              {
                                  if (status != wgpu::RequestAdapterStatus::Success)
                                  {
                                      log::error("Failed to get GPU adapter: {}", std::string_view{message});
                                      return;
                                  }
                                  m_adapter = std::move(adapter);
                                  request_device();
                              });
}

void renderer::request_device()
{
    wgpu::DeviceDescriptor descriptor{};
    descriptor.SetDeviceLostCallback(wgpu::CallbackMode::AllowSpontaneous,
                                     [](const wgpu::Device&, wgpu::DeviceLostReason reason, wgpu::StringView message)
                                     {
                                         if (reason != wgpu::DeviceLostReason::Destroyed)
                                             log::error("GPU device lost: {}", std::string_view{message});
                                     });
    descriptor.SetUncapturedErrorCallback([](const wgpu::Device&, wgpu::ErrorType, wgpu::StringView message)
                                          { log::error("GPU error: {}", std::string_view{message}); });

    m_adapter.RequestDevice(&descriptor, wgpu::CallbackMode::AllowProcessEvents,
                            [this](wgpu::RequestDeviceStatus status, wgpu::Device device, wgpu::StringView message)
                            {
                                if (status != wgpu::RequestDeviceStatus::Success)
                                {
                                    log::error("Failed to get GPU device: {}", std::string_view{message});
                                    return;
                                }
                                m_device = std::move(device);

                                wgpu::SurfaceCapabilities capabilities;
                                m_surface.GetCapabilities(m_adapter, &capabilities);
                                m_format = capabilities.formats[0];

                                log::info("GPU device ready");
                                configure_surface();
                            });
}

void renderer::resize(std::uint32_t width, std::uint32_t height)
{
    m_width = width;
    m_height = height;
    configure_surface();
}

void renderer::configure_surface()
{
    if (!is_configured())
        return;

    wgpu::SurfaceConfiguration configuration{};
    configuration.device = m_device;
    configuration.format = m_format;
    configuration.width = m_width;
    configuration.height = m_height;
    m_surface.Configure(&configuration);
}

bool renderer::is_configured() const
{
    return m_device && m_width > 0 && m_height > 0;
}

void renderer::render()
{
    m_instance.ProcessEvents();
    if (!is_configured())
        return;

    wgpu::SurfaceTexture surface_texture;
    m_surface.GetCurrentTexture(&surface_texture);
    if (surface_texture.status != wgpu::SurfaceGetCurrentTextureStatus::SuccessOptimal &&
        surface_texture.status != wgpu::SurfaceGetCurrentTextureStatus::SuccessSuboptimal)
        return;

    wgpu::RenderPassColorAttachment color_attachment{};
    color_attachment.view = surface_texture.texture.CreateView();
    color_attachment.loadOp = wgpu::LoadOp::Clear;
    color_attachment.storeOp = wgpu::StoreOp::Store;
    color_attachment.clearValue = clear_color;

    wgpu::RenderPassDescriptor pass_descriptor{};
    pass_descriptor.colorAttachmentCount = 1;
    pass_descriptor.colorAttachments = &color_attachment;

    const wgpu::CommandEncoder encoder = m_device.CreateCommandEncoder();
    encoder.BeginRenderPass(&pass_descriptor).End();
    const wgpu::CommandBuffer commands = encoder.Finish();
    // No Present(): the browser shows the canvas once the animation frame callback returns.
    m_device.GetQueue().Submit(1, &commands);
}

} // namespace seraphim::render
