#pragma once

#include <cstddef>
#include <cstdint>
#include <glm/vec2.hpp>
#include <optional>
#include <vector>

namespace seraphim::scene
{
struct tilemap;

class navigator_grid
{
  public:
    navigator_grid(const tilemap& map, std::size_t blocking_layer);

    bool operator()(unsigned x, unsigned y) const
    {
        return x < m_width && y < m_height && m_walkable[(std::size_t{y} * m_width) + x] != 0;
    }

    [[nodiscard]] std::optional<std::vector<glm::uvec2>> find_path(glm::uvec2 start, glm::uvec2 end) const;

  private:
    unsigned m_width = 0;
    unsigned m_height = 0;
    std::vector<std::uint8_t> m_walkable;
};
} // namespace seraphim::scene
