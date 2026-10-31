#pragma once

#include <algorithm>
#include <cstdint>
#include <format>
#include <glm/vec4.hpp>
#include <optional>
#include <string>
#include <string_view>

namespace seraphim::core
{

struct color
{
    float r = 0.0F;
    float g = 0.0F;
    float b = 0.0F;
    float a = 1.0F;

    constexpr color() = default;
    constexpr color(float r, float g, float b, float a = 1.0F) : r(r), g(g), b(b), a(a) {}

    constexpr bool operator==(const color&) const = default;

    [[nodiscard]] constexpr glm::vec4 to_vec4() const { return {r, g, b, a}; }
    constexpr operator glm::vec4() const { return {r, g, b, a}; }

    [[nodiscard]] static constexpr color from_rgba8(std::uint8_t r, std::uint8_t g, std::uint8_t b,
                                                    std::uint8_t a = 255)
    {
        return {static_cast<float>(r) / 255.0F, static_cast<float>(g) / 255.0F, static_cast<float>(b) / 255.0F,
                static_cast<float>(a) / 255.0F};
    }

    // Parses "#RGB", "#RGBA", "#RRGGBB", or "#RRGGBBAA" (with or without a leading '#').
    [[nodiscard]] static constexpr std::optional<color> try_from_hex(std::string_view hex);

    // Parses a hex color string, returning fallback (black by default) if the string is invalid.
    [[nodiscard]] static constexpr color from_hex(std::string_view hex);
    [[nodiscard]] static constexpr color from_hex(std::string_view hex, const color& fallback);

    // Unpacks a 24-bit 0xRRGGBB integer literal.
    [[nodiscard]] static constexpr color from_hex(std::uint32_t rgb)
    {
        return from_rgba8(static_cast<std::uint8_t>((rgb >> 16U) & 0xFFU),
                          static_cast<std::uint8_t>((rgb >> 8U) & 0xFFU), static_cast<std::uint8_t>(rgb & 0xFFU));
    }

    [[nodiscard]] std::string to_hex(bool include_alpha = false) const
    {
        const auto to_byte = [](float channel)
        { return static_cast<std::uint8_t>(std::clamp(channel, 0.0F, 1.0F) * 255.0F + 0.5F); };

        if (include_alpha)
            return std::format("#{:02x}{:02x}{:02x}{:02x}", to_byte(r), to_byte(g), to_byte(b), to_byte(a));
        return std::format("#{:02x}{:02x}{:02x}", to_byte(r), to_byte(g), to_byte(b));
    }

    static const color white;
    static const color black;
    static const color transparent;
    static const color red;
    static const color green;
    static const color blue;
    static const color yellow;
    static const color cyan;
    static const color magenta;
    static const color orange;
    static const color purple;
    static const color gray;
    static const color grey;
    static const color light_gray;
    static const color dark_gray;

  private:
    [[nodiscard]] static constexpr std::optional<std::uint8_t> hex_digit(char c)
    {
        if (c >= '0' && c <= '9')
            return static_cast<std::uint8_t>(c - '0');
        if (c >= 'a' && c <= 'f')
            return static_cast<std::uint8_t>(c - 'a' + 10);
        if (c >= 'A' && c <= 'F')
            return static_cast<std::uint8_t>(c - 'A' + 10);
        return std::nullopt;
    }

    [[nodiscard]] static constexpr std::optional<std::uint8_t> hex_byte(char high, char low)
    {
        const auto h = hex_digit(high);
        const auto l = hex_digit(low);
        if (!h || !l)
            return std::nullopt;
        return static_cast<std::uint8_t>((*h << 4U) | *l);
    }
};

inline constexpr color color::white{1.0F, 1.0F, 1.0F, 1.0F};
inline constexpr color color::black{0.0F, 0.0F, 0.0F, 1.0F};
inline constexpr color color::transparent{0.0F, 0.0F, 0.0F, 0.0F};
inline constexpr color color::red{1.0F, 0.0F, 0.0F, 1.0F};
inline constexpr color color::green{0.0F, 1.0F, 0.0F, 1.0F};
inline constexpr color color::blue{0.0F, 0.0F, 1.0F, 1.0F};
inline constexpr color color::yellow{1.0F, 1.0F, 0.0F, 1.0F};
inline constexpr color color::cyan{0.0F, 1.0F, 1.0F, 1.0F};
inline constexpr color color::magenta{1.0F, 0.0F, 1.0F, 1.0F};
inline constexpr color color::orange{1.0F, 0.5F, 0.0F, 1.0F};
inline constexpr color color::purple{0.5F, 0.0F, 0.5F, 1.0F};
inline constexpr color color::gray{0.5F, 0.5F, 0.5F, 1.0F};
inline constexpr color color::grey{0.5F, 0.5F, 0.5F, 1.0F};
inline constexpr color color::light_gray{0.75F, 0.75F, 0.75F, 1.0F};
inline constexpr color color::dark_gray{0.25F, 0.25F, 0.25F, 1.0F};

constexpr std::optional<color> color::try_from_hex(std::string_view hex)
{
    if (!hex.empty() && hex.front() == '#')
        hex.remove_prefix(1);
    else if (hex.size() >= 2 && hex[0] == '0' && (hex[1] == 'x' || hex[1] == 'X'))
        hex.remove_prefix(2);

    if (hex.size() == 3 || hex.size() == 4)
    {
        const auto r = hex_byte(hex[0], hex[0]);
        const auto g = hex_byte(hex[1], hex[1]);
        const auto b = hex_byte(hex[2], hex[2]);
        const auto a = hex.size() == 4 ? hex_byte(hex[3], hex[3]) : std::optional<std::uint8_t>{255};
        if (!r || !g || !b || !a)
            return std::nullopt;
        return from_rgba8(*r, *g, *b, *a);
    }

    if (hex.size() == 6 || hex.size() == 8)
    {
        const auto r = hex_byte(hex[0], hex[1]);
        const auto g = hex_byte(hex[2], hex[3]);
        const auto b = hex_byte(hex[4], hex[5]);
        const auto a = hex.size() == 8 ? hex_byte(hex[6], hex[7]) : std::optional<std::uint8_t>{255};
        if (!r || !g || !b || !a)
            return std::nullopt;
        return from_rgba8(*r, *g, *b, *a);
    }

    return std::nullopt;
}

constexpr color color::from_hex(std::string_view hex, const color& fallback)
{
    return try_from_hex(hex).value_or(fallback);
}

constexpr color color::from_hex(std::string_view hex)
{
    return from_hex(hex, color::black);
}

} // namespace seraphim::core
