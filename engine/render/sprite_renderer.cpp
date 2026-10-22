#include "render/sprite_renderer.hpp"

#include "asset/asset_manager.hpp"
#include "render/shaders/sprite.hpp"

#include <array>
#include <bit>
#include <cstddef>

namespace seraphim::render
{

namespace
{

constexpr std::uint32_t vertices_per_sprite = 6;

wgpu::BindGroupLayout create_frame_layout(const wgpu::Device& device)
{
    std::array<wgpu::BindGroupLayoutEntry, 2> entries{};
    entries[0].binding = 0;
    entries[0].visibility = wgpu::ShaderStage::Vertex;
    entries[0].buffer.type = wgpu::BufferBindingType::Uniform;
    entries[1].binding = 1;
    entries[1].visibility = wgpu::ShaderStage::Fragment;
    entries[1].sampler.type = wgpu::SamplerBindingType::Filtering;

    wgpu::BindGroupLayoutDescriptor descriptor{};
    descriptor.entryCount = entries.size();
    descriptor.entries = entries.data();
    return device.CreateBindGroupLayout(&descriptor);
}

wgpu::BindGroupLayout create_texture_layout(const wgpu::Device& device)
{
    wgpu::BindGroupLayoutEntry entry{};
    entry.binding = 0;
    entry.visibility = wgpu::ShaderStage::Fragment;
    entry.texture.sampleType = wgpu::TextureSampleType::Float;
    entry.texture.viewDimension = wgpu::TextureViewDimension::e2D;

    wgpu::BindGroupLayoutDescriptor descriptor{};
    descriptor.entryCount = 1;
    descriptor.entries = &entry;
    return device.CreateBindGroupLayout(&descriptor);
}

} // namespace

wgpu::RenderPipeline sprite_renderer::create_pipeline(const wgpu::Device& device, wgpu::TextureFormat target_format,
                                                      const wgpu::BindGroupLayout& frame_layout,
                                                      const wgpu::BindGroupLayout& texture_layout)
{
    wgpu::ShaderSourceWGSL source{};
    source.code = shaders::sprite;
    wgpu::ShaderModuleDescriptor module_descriptor{};
    module_descriptor.nextInChain = &source;
    const wgpu::ShaderModule module = device.CreateShaderModule(&module_descriptor);

    const std::array layouts{frame_layout, texture_layout};
    wgpu::PipelineLayoutDescriptor layout_descriptor{};
    layout_descriptor.bindGroupLayoutCount = layouts.size();
    layout_descriptor.bindGroupLayouts = layouts.data();

    // Locations follow the instance struct in sprite.wgsl.
    const std::array<wgpu::VertexAttribute, 5> attributes{{
        {.format = wgpu::VertexFormat::Float32x4, .offset = offsetof(instance, uv_rect), .shaderLocation = 0},
        {.format = wgpu::VertexFormat::Float32x4, .offset = offsetof(instance, color), .shaderLocation = 1},
        {.format = wgpu::VertexFormat::Float32x2, .offset = offsetof(instance, position), .shaderLocation = 2},
        {.format = wgpu::VertexFormat::Float32x2, .offset = offsetof(instance, size), .shaderLocation = 3},
        {.format = wgpu::VertexFormat::Float32, .offset = offsetof(instance, rotation), .shaderLocation = 4},
    }};

    wgpu::VertexBufferLayout instance_layout{};
    instance_layout.stepMode = wgpu::VertexStepMode::Instance;
    instance_layout.arrayStride = sizeof(instance);
    instance_layout.attributeCount = attributes.size();
    instance_layout.attributes = attributes.data();

    // Straight (not premultiplied) alpha, matching how textures are decoded and uploaded.
    wgpu::BlendState blend{};
    blend.color = {wgpu::BlendOperation::Add, wgpu::BlendFactor::SrcAlpha, wgpu::BlendFactor::OneMinusSrcAlpha};
    blend.alpha = {wgpu::BlendOperation::Add, wgpu::BlendFactor::One, wgpu::BlendFactor::OneMinusSrcAlpha};

    wgpu::ColorTargetState target{};
    target.format = target_format;
    target.blend = &blend;

    wgpu::FragmentState fragment{};
    fragment.module = module;
    fragment.entryPoint = "fs_main";
    fragment.targetCount = 1;
    fragment.targets = &target;

    wgpu::RenderPipelineDescriptor descriptor{};
    descriptor.layout = device.CreatePipelineLayout(&layout_descriptor);
    descriptor.vertex.module = module;
    descriptor.vertex.entryPoint = "vs_main";
    descriptor.vertex.bufferCount = 1;
    descriptor.vertex.buffers = &instance_layout;
    descriptor.primitive.topology = wgpu::PrimitiveTopology::TriangleList;
    descriptor.fragment = &fragment;
    return device.CreateRenderPipeline(&descriptor);
}

sprite_renderer::sprite_renderer(const wgpu::Device& device, wgpu::TextureFormat target_format)
    : m_device(device), m_texture_layout(create_texture_layout(device))
{
    const wgpu::BindGroupLayout frame_layout = create_frame_layout(device);
    m_pipeline = create_pipeline(device, target_format, frame_layout, m_texture_layout);

    wgpu::BufferDescriptor camera_descriptor{};
    camera_descriptor.usage = wgpu::BufferUsage::Uniform | wgpu::BufferUsage::CopyDst;
    camera_descriptor.size = sizeof(glm::mat4);
    m_camera_buffer = device.CreateBuffer(&camera_descriptor);

    wgpu::SamplerDescriptor sampler_descriptor{};
    sampler_descriptor.addressModeU = wgpu::AddressMode::ClampToEdge;
    sampler_descriptor.addressModeV = wgpu::AddressMode::ClampToEdge;
    sampler_descriptor.addressModeW = wgpu::AddressMode::ClampToEdge;
    sampler_descriptor.magFilter = wgpu::FilterMode::Linear;
    sampler_descriptor.minFilter = wgpu::FilterMode::Linear;
    sampler_descriptor.mipmapFilter = wgpu::MipmapFilterMode::Nearest;

    std::array<wgpu::BindGroupEntry, 2> entries{};
    entries[0].binding = 0;
    entries[0].buffer = m_camera_buffer;
    entries[1].binding = 1;
    entries[1].sampler = device.CreateSampler(&sampler_descriptor);

    wgpu::BindGroupDescriptor group_descriptor{};
    group_descriptor.layout = frame_layout;
    group_descriptor.entryCount = entries.size();
    group_descriptor.entries = entries.data();
    m_frame_group = device.CreateBindGroup(&group_descriptor);
}

void sprite_renderer::begin(const glm::mat4& view_projection)
{
    m_instances.clear();
    m_batches.clear();
    m_device.GetQueue().WriteBuffer(m_camera_buffer, 0, &view_projection, sizeof(view_projection));
}

void sprite_renderer::draw(const sprite& item)
{
    const auto index = static_cast<std::uint32_t>(m_instances.size());
    m_instances.push_back({item.uv_rect, item.color, item.position, item.size, item.rotation});

    if (!m_batches.empty() && m_batches.back().texture == item.texture)
        ++m_batches.back().instance_count;
    else
        m_batches.push_back({item.texture, index, 1});
}

void sprite_renderer::flush(const wgpu::RenderPassEncoder& pass, const asset::asset_manager& assets)
{
    if (m_instances.empty())
        return;

    reserve_instances(m_instances.size());
    m_device.GetQueue().WriteBuffer(m_instance_buffer, 0, m_instances.data(), m_instances.size() * sizeof(instance));

    pass.SetPipeline(m_pipeline);
    pass.SetBindGroup(0, m_frame_group);
    pass.SetVertexBuffer(0, m_instance_buffer);

    for (const batch& run : m_batches)
    {
        // Rebuilt every frame instead of cached: a texture can be unloaded and its slot reused at any time.
        wgpu::BindGroupEntry entry{};
        entry.binding = 0;
        entry.textureView = assets.texture(run.texture).view();

        wgpu::BindGroupDescriptor descriptor{};
        descriptor.layout = m_texture_layout;
        descriptor.entryCount = 1;
        descriptor.entries = &entry;

        pass.SetBindGroup(1, m_device.CreateBindGroup(&descriptor));
        pass.Draw(vertices_per_sprite, run.instance_count, 0, run.first_instance);
    }
}

void sprite_renderer::reserve_instances(std::size_t count)
{
    if (count <= m_instance_capacity)
        return;

    m_instance_capacity = std::bit_ceil(count);
    wgpu::BufferDescriptor descriptor{};
    descriptor.usage = wgpu::BufferUsage::Vertex | wgpu::BufferUsage::CopyDst;
    descriptor.size = m_instance_capacity * sizeof(instance);
    m_instance_buffer = m_device.CreateBuffer(&descriptor);
}

} // namespace seraphim::render
