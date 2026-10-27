#include "scene/scene_file.hpp"

#include "core/log.hpp"
#include "scene/components.hpp"

#include <array>
#include <charconv>
#include <cstddef>
#include <cstdint>
#include <format>
#include <glm/vec2.hpp>
#include <glm/vec4.hpp>
#include <limits>
#include <map>
#include <nlohmann/json.hpp>
#include <optional>
#include <string_view>
#include <utility>
#include <vector>

namespace seraphim::scene
{

namespace
{

// Keeps keys in the order they were written and stores numbers as float, so saved files diff cleanly and print
// 0.1 instead of the double closest to 0.1f.
using json =
    nlohmann::basic_json<nlohmann::ordered_map, std::vector, std::string, bool, std::int64_t, std::uint64_t, float>;

constexpr int format_version = 1;

// The readers return false only when a value has the wrong type. A missing key keeps the component's default, so
// files stay small and new fields do not break old files.
bool read(const json& value, float& out)
{
    if (!value.is_number())
        return false;
    out = value.get<float>();
    return true;
}

bool read(const json& value, bool& out)
{
    if (!value.is_boolean())
        return false;
    out = value.get<bool>();
    return true;
}

bool read(const json& value, std::int32_t& out)
{
    if (!value.is_number_integer())
        return false;
    out = value.get<std::int32_t>();
    return true;
}

bool read(const json& value, std::uint32_t& out)
{
    if (!value.is_number_unsigned() || value.get<std::uint64_t>() > std::numeric_limits<std::uint32_t>::max())
        return false;
    out = value.get<std::uint32_t>();
    return true;
}

bool read(const json& value, std::string& out)
{
    if (!value.is_string())
        return false;
    out = value.get<std::string>();
    return true;
}

bool read(const json& value, std::vector<std::string>& out)
{
    if (!value.is_array())
        return false;
    out.clear();
    for (const json& item : value)
        if (!read(item, out.emplace_back()))
            return false;
    return true;
}

template <glm::length_t Length, typename T>
bool read(const json& value, glm::vec<Length, T>& out)
{
    if (!value.is_array() || value.size() != Length)
        return false;
    for (glm::length_t i = 0; i < Length; ++i)
        if (!read(value[static_cast<std::size_t>(i)], out[i]))
            return false;
    return true;
}

template <typename Enum>
struct enum_name
{
    Enum value;
    const char* name;
};

constexpr std::array body_type_names{
    enum_name{body_type::static_body, "static"},
    enum_name{body_type::kinematic, "kinematic"},
    enum_name{body_type::dynamic, "dynamic"},
};

constexpr std::array collider_shape_names{
    enum_name{collider_shape::box, "box"},
    enum_name{collider_shape::circle, "circle"},
};

constexpr std::array tilemap_orientation_names{
    enum_name{tilemap_orientation::orthogonal, "orthogonal"},
    enum_name{tilemap_orientation::isometric, "isometric"},
};

template <typename Enum, std::size_t Count>
bool read(const json& value, Enum& out, const std::array<enum_name<Enum>, Count>& names)
{
    if (!value.is_string())
        return false;
    for (const auto& [candidate, name] : names)
        if (value.get_ref<const std::string&>() == name)
        {
            out = candidate;
            return true;
        }
    return false;
}

template <typename Enum, std::size_t Count>
const char* name_of(Enum value, const std::array<enum_name<Enum>, Count>& names)
{
    for (const auto& [candidate, name] : names)
        if (candidate == value)
            return name;
    return names.front().name;
}

bool read(const json& value, body_type& out)
{
    return read(value, out, body_type_names);
}

bool read(const json& value, collider_shape& out)
{
    return read(value, out, collider_shape_names);
}

bool read(const json& value, tilemap_orientation& out)
{
    return read(value, out, tilemap_orientation_names);
}

template <typename T>
bool read_field(const json& object, const char* key, T& out)
{
    const auto field = object.find(key);
    return field == object.end() || read(*field, out);
}

template <glm::length_t Length, typename T>
json write(const glm::vec<Length, T>& value)
{
    json array = json::array();
    for (glm::length_t i = 0; i < Length; ++i)
        array.push_back(value[i]);
    return array;
}

std::optional<transform> read_transform(const json& value)
{
    transform out;
    if (!value.is_object() || !read_field(value, "position", out.position) ||
        !read_field(value, "rotation", out.rotation) || !read_field(value, "scale", out.scale))
        return std::nullopt;
    return out;
}

std::optional<sprite> read_sprite(const json& value)
{
    sprite out;
    if (!value.is_object() || !read_field(value, "texture", out.texture) || !read_field(value, "size", out.size) ||
        !read_field(value, "uv_rect", out.uv_rect) || !read_field(value, "color", out.color) ||
        !read_field(value, "order", out.order))
        return std::nullopt;
    return out;
}

std::optional<rigidbody> read_rigidbody(const json& value)
{
    rigidbody out;
    if (!value.is_object() || !read_field(value, "type", out.type) ||
        !read_field(value, "gravity_scale", out.gravity_scale) ||
        !read_field(value, "fixed_rotation", out.fixed_rotation))
        return std::nullopt;
    return out;
}

std::optional<collider> read_collider(const json& value)
{
    collider out;
    if (!value.is_object() || !read_field(value, "shape", out.shape) || !read_field(value, "size", out.size) ||
        !read_field(value, "radius", out.radius) || !read_field(value, "offset", out.offset) ||
        !read_field(value, "density", out.density) || !read_field(value, "friction", out.friction) ||
        !read_field(value, "restitution", out.restitution) || !read_field(value, "sensor", out.sensor))
        return std::nullopt;
    return out;
}

std::optional<animator> read_animator(const json& value)
{
    animator out;
    if (!value.is_object() || !read_field(value, "animation_set", out.animation_set) ||
        !read_field(value, "clip", out.clip))
        return std::nullopt;
    return out;
}

std::optional<audio_source> read_audio_source(const json& value)
{
    audio_source out;
    if (!value.is_object() || !read_field(value, "sound", out.sound) || !read_field(value, "volume", out.volume) ||
        !read_field(value, "loop", out.loop) || !read_field(value, "play_on_start", out.play_on_start) ||
        !read_field(value, "spatial", out.spatial))
        return std::nullopt;
    return out;
}

// A row is the tile numbers of one line of the map, separated by spaces.
bool read_row(std::string_view text, std::uint32_t width, std::vector<std::uint16_t>& out)
{
    const char* it = text.data();
    const char* const end = it + text.size();
    const auto skip_spaces = [&]
    {
        while (it != end && *it == ' ')
            ++it;
    };

    for (std::uint32_t x = 0; x < width; ++x)
    {
        skip_spaces();
        std::uint16_t tile = 0;
        const auto [next, error] = std::from_chars(it, end, tile);
        if (error != std::errc{})
            return false;
        out.push_back(tile);
        it = next;
    }
    skip_spaces();
    return it == end;
}

bool read_layer(const json& value, glm::uvec2 size, std::vector<std::uint16_t>& out)
{
    if (!value.is_object())
        return false;
    const auto rows = value.find("rows");
    if (rows == value.end() || !rows->is_array() || rows->size() != size.y)
        return false;

    out.reserve(static_cast<std::size_t>(size.x) * size.y);
    for (const json& row : *rows)
        if (!row.is_string() || !read_row(row.get_ref<const std::string&>(), size.x, out))
            return false;
    return true;
}

std::optional<tilemap> read_tilemap(const json& value)
{
    tilemap out;
    if (!value.is_object() || !read_field(value, "tileset", out.tileset) ||
        !read_field(value, "orientation", out.orientation) || !read_field(value, "cell_size", out.cell_size) ||
        !read_field(value, "size", out.size) || !read_field(value, "order", out.order))
        return std::nullopt;

    const auto layers = value.find("layers");
    if (layers == value.end())
        return out;
    if (!layers->is_array())
        return std::nullopt;
    for (const json& layer : *layers)
        if (!read_layer(layer, out.size, out.layers.emplace_back()))
            return std::nullopt;
    return out;
}

json write_layer(const std::vector<std::uint16_t>& tiles, glm::uvec2 size)
{
    json rows = json::array();
    for (std::uint32_t y = 0; y < size.y; ++y)
    {
        std::string row;
        for (std::uint32_t x = 0; x < size.x; ++x)
        {
            if (x > 0)
                row += ' ';
            row += std::to_string(tiles[(static_cast<std::size_t>(y) * size.x) + x]);
        }
        rows.push_back(std::move(row));
    }
    return {{"rows", std::move(rows)}};
}

std::optional<scripts> read_scripts(const json& value)
{
    scripts out;
    if (!value.is_object() || !read_field(value, "assets", out.assets))
        return std::nullopt;
    return out;
}

std::expected<void, std::string> read_entity(scene& scene, const json& value)
{
    if (!value.is_object())
        return std::unexpected("An entity is not a JSON object");

    std::string id;
    std::string name;
    if (!read_field(value, "id", id) || id.empty())
        return std::unexpected("An entity has no id");
    if (!read_field(value, "name", name))
        return std::unexpected(std::format("Entity '{}' has an invalid name", id));

    auto& registry = scene.registry();
    const entt::entity entity = scene.create(id, std::move(name));

    const auto components = value.find("components");
    if (components == value.end())
        return {};
    if (!components->is_object())
        return std::unexpected(std::format("Entity '{}' has invalid components", id));

    for (const auto& [key, component] : components->items())
    {
        if (key == "transform")
        {
            const auto parsed = read_transform(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid transform", id));
            registry.emplace<transform>(entity, *parsed);
        }
        else if (key == "sprite")
        {
            auto parsed = read_sprite(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid sprite", id));
            registry.emplace<sprite>(entity, std::move(*parsed));
        }
        else if (key == "rigidbody")
        {
            const auto parsed = read_rigidbody(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid rigidbody", id));
            registry.emplace<rigidbody>(entity, *parsed);
        }
        else if (key == "collider")
        {
            const auto parsed = read_collider(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid collider", id));
            registry.emplace<collider>(entity, *parsed);
        }
        else if (key == "animator")
        {
            auto parsed = read_animator(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid animator", id));
            registry.emplace<animator>(entity, std::move(*parsed));
        }
        else if (key == "audio_source")
        {
            auto parsed = read_audio_source(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid audio source", id));
            registry.emplace<audio_source>(entity, std::move(*parsed));
        }
        else if (key == "tilemap")
        {
            auto parsed = read_tilemap(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid tilemap", id));
            registry.emplace<tilemap>(entity, std::move(*parsed));
        }
        else if (key == "networked")
        {
            if (!component.is_object())
                return std::unexpected(std::format("Entity '{}' has an invalid networked component", id));
            registry.emplace<networked>(entity);
        }
        else if (key == "scripts")
        {
            auto parsed = read_scripts(component);
            if (!parsed)
                return std::unexpected(std::format("Entity '{}' has an invalid script list", id));
            registry.emplace<scripts>(entity, std::move(*parsed));
        }
        else
        {
            // Saving drops it, but refusing the whole scene over it would lock the user out of their work.
            log::warn("Entity '{}' has an unknown component '{}', which is ignored", id, key);
        }
    }
    return {};
}

} // namespace

std::expected<scene, std::string> parse_scene(std::string_view text)
{
    // Exceptions are disabled in the wasm build, so parse errors come back as a discarded value instead.
    const json root = json::parse(text, nullptr, false);
    if (root.is_discarded() || !root.is_object())
        return std::unexpected("The scene is not a valid JSON object");

    const auto version = root.find("format_version");
    if (version == root.end() || *version != format_version)
        return std::unexpected(std::format("The scene format version is not {}", format_version));

    const auto entities = root.find("entities");
    if (entities == root.end() || !entities->is_array())
        return std::unexpected("The scene has no entity list");

    scene out;
    if (!read_field(root, "gravity", out.gravity()))
        return std::unexpected("The scene has an invalid gravity");
    for (const json& entity : *entities)
        if (auto added = read_entity(out, entity); !added)
            return std::unexpected(std::move(added.error()));
    return out;
}

std::string serialize_scene(const scene& scene)
{
    const auto& registry = scene.registry();
    json entities = json::array();

    // Views iterate newest first, so walking backwards writes entities in the order they were loaded or created.
    const auto view = registry.view<const identity>();
    for (auto it = view.rbegin(); it != view.rend(); ++it)
    {
        const entt::entity entity = *it;
        const auto& [id, name] = view.get<const identity>(entity);

        json components = json::object();
        if (const auto* placement = registry.try_get<transform>(entity))
            components["transform"] = {
                {"position", write(placement->position)},
                {"rotation", placement->rotation},
                {"scale", write(placement->scale)},
            };
        if (const auto* image = registry.try_get<sprite>(entity))
            components["sprite"] = {
                {"texture", image->texture},    {"size", write(image->size)}, {"uv_rect", write(image->uv_rect)},
                {"color", write(image->color)}, {"order", image->order},
            };
        if (const auto* body = registry.try_get<rigidbody>(entity))
            components["rigidbody"] = {
                {"type", name_of(body->type, body_type_names)},
                {"gravity_scale", body->gravity_scale},
                {"fixed_rotation", body->fixed_rotation},
            };
        if (const auto* shape = registry.try_get<collider>(entity))
            components["collider"] = {
                {"shape", name_of(shape->shape, collider_shape_names)},
                {"size", write(shape->size)},
                {"radius", shape->radius},
                {"offset", write(shape->offset)},
                {"density", shape->density},
                {"friction", shape->friction},
                {"restitution", shape->restitution},
                {"sensor", shape->sensor},
            };
        if (const auto* player = registry.try_get<animator>(entity))
            components["animator"] = {{"animation_set", player->animation_set}, {"clip", player->clip}};
        if (const auto* source = registry.try_get<audio_source>(entity))
            components["audio_source"] = {
                {"sound", source->sound},     {"volume", source->volume},
                {"loop", source->loop},       {"play_on_start", source->play_on_start},
                {"spatial", source->spatial},
            };
        if (const auto* map = registry.try_get<tilemap>(entity))
        {
            json layers = json::array();
            for (const auto& tiles : map->layers)
                layers.push_back(write_layer(tiles, map->size));
            components["tilemap"] = {
                {"tileset", map->tileset},
                {"orientation", name_of(map->orientation, tilemap_orientation_names)},
                {"cell_size", write(map->cell_size)},
                {"size", write(map->size)},
                {"layers", std::move(layers)},
                {"order", map->order},
            };
        }
        if (registry.all_of<networked>(entity))
            components["networked"] = json::object();
        if (const auto* list = registry.try_get<scripts>(entity))
            components["scripts"] = {{"assets", list->assets}};

        entities.push_back({{"id", id}, {"name", name}, {"components", std::move(components)}});
    }

    const json root = {
        {"format_version", format_version},
        {"gravity", write(scene.gravity())},
        {"entities", std::move(entities)},
    };
    return root.dump(2) + '\n';
}

} // namespace seraphim::scene
