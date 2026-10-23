#include "asset/animation_set_file.hpp"

#include <format>
#include <nlohmann/json.hpp>
#include <utility>

namespace seraphim::asset
{

namespace
{

using json = nlohmann::json;

std::expected<glm::vec4, std::string> read_frame(const json& value)
{
    if (!value.is_array() || value.size() != 4)
        return std::unexpected("A frame is not an array of four numbers");
    glm::vec4 out;
    for (glm::length_t i = 0; i < 4; ++i)
    {
        const json& component = value[static_cast<std::size_t>(i)];
        if (!component.is_number())
            return std::unexpected("A frame is not an array of four numbers");
        out[i] = component.get<float>();
    }
    return out;
}

std::expected<animation_clip, std::string> read_clip(const json& value)
{
    if (!value.is_object())
        return std::unexpected("A clip is not a JSON object");

    animation_clip out;
    const auto name = value.find("name");
    if (name == value.end() || !name->is_string() || name->get_ref<const std::string&>().empty())
        return std::unexpected("A clip has no name");
    out.name = name->get<std::string>();

    const auto frames = value.find("frames");
    if (frames == value.end() || !frames->is_array())
        return std::unexpected(std::format("Clip '{}' has no frame list", out.name));
    for (const json& frame : *frames)
    {
        auto parsed = read_frame(frame);
        if (!parsed)
            return std::unexpected(std::format("Clip '{}': {}", out.name, parsed.error()));
        out.frames.push_back(*parsed);
    }

    if (const auto duration = value.find("frame_duration"); duration != value.end())
    {
        if (!duration->is_number() || duration->get<float>() <= 0.0F)
            return std::unexpected(std::format("Clip '{}' needs a positive frame_duration", out.name));
        out.frame_duration = duration->get<float>();
    }
    if (const auto loop = value.find("loop"); loop != value.end())
    {
        if (!loop->is_boolean())
            return std::unexpected(std::format("Clip '{}' has an invalid loop", out.name));
        out.loop = loop->get<bool>();
    }
    return out;
}

} // namespace

std::expected<animation_set, std::string> parse_animation_set(std::string_view text)
{
    // Exceptions are disabled in the wasm build, so parse errors come back as a discarded value instead.
    const json root = json::parse(text, nullptr, false);
    if (root.is_discarded() || !root.is_object())
        return std::unexpected("The animation set is not a valid JSON object");

    const auto clips = root.find("clips");
    if (clips == root.end() || !clips->is_array())
        return std::unexpected("The animation set has no clip list");

    animation_set out;
    for (const json& clip : *clips)
    {
        auto parsed = read_clip(clip);
        if (!parsed)
            return std::unexpected(std::move(parsed.error()));
        out.clips.push_back(std::move(*parsed));
    }
    return out;
}

} // namespace seraphim::asset
