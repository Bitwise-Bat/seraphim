#include "asset/tileset_file.hpp"

#include <cstdint>
#include <limits>
#include <nlohmann/json.hpp>

namespace seraphim::asset
{

namespace
{

using json = nlohmann::json;

bool read_pixels(const json& value, std::uint32_t& out)
{
    if (!value.is_number_integer() || value.get<std::int64_t>() < 0 ||
        value.get<std::int64_t>() > std::numeric_limits<std::uint16_t>::max())
        return false;
    out = value.get<std::uint32_t>();
    return true;
}

} // namespace

std::expected<tileset, std::string> parse_tileset(std::string_view text)
{
    // Exceptions are disabled in the wasm build, so parse errors come back as a discarded value instead.
    const json root = json::parse(text, nullptr, false);
    if (root.is_discarded() || !root.is_object())
        return std::unexpected("The tileset is not a valid JSON object");

    tileset out;
    const auto texture = root.find("texture");
    if (texture == root.end() || !texture->is_string() || texture->get_ref<const std::string&>().empty())
        return std::unexpected("The tileset has no texture");
    out.texture = texture->get<std::string>();

    const auto tile_size = root.find("tile_size");
    if (tile_size == root.end() || !tile_size->is_array() || tile_size->size() != 2 ||
        !read_pixels((*tile_size)[0], out.tile_size.x) || !read_pixels((*tile_size)[1], out.tile_size.y) ||
        out.tile_size.x == 0 || out.tile_size.y == 0)
        return std::unexpected("The tileset needs a tile_size of two positive integers");

    if (const auto spacing = root.find("spacing"); spacing != root.end() && !read_pixels(*spacing, out.spacing))
        return std::unexpected("The tileset has an invalid spacing");
    if (const auto margin = root.find("margin"); margin != root.end() && !read_pixels(*margin, out.margin))
        return std::unexpected("The tileset has an invalid margin");
    return out;
}

} // namespace seraphim::asset
