#pragma once

#include "scene/components.hpp"
#include "scene/physics_system.hpp"
#include "scene/scene.hpp"
#include "scene/scene_file.hpp"

#include <cstddef>
#include <emscripten/val.h>
#include <glm/vec2.hpp>
#include <optional>
#include <string>
#include <vector>

namespace seraphim::scene
{

class world
{
  public:
    explicit world(seraphim::scene::scene scene);
    ~world();

    world(const world&) = delete;
    world& operator=(const world&) = delete;

    void start_simulation() { physics.emplace(scene); }

    void stop_simulation() { physics.reset(); }

    // Runs the scripts, then the physics, so physics acts on what the scripts changed this tick.
    void tick(float seconds);

    [[nodiscard]] std::string save_scene() const { return seraphim::scene::serialize_scene(scene); }

    [[nodiscard]] std::optional<std::string> find_entity(const std::string& name);

    [[nodiscard]] std::optional<transform> get_transform(const std::string& id) const;
    void set_transform(const std::string& id, transform transform);

    [[nodiscard]] std::optional<glm::vec2> get_velocity(const std::string& id) const;
    void set_velocity(const std::string& id, glm::vec2 velocity);
    [[nodiscard]] bool has_body(const std::string& id) const;

    [[nodiscard]] std::optional<std::string> get_clip(const std::string& id) const;
    void set_clip(const std::string& id, const std::string& clip);
    [[nodiscard]] bool has_animator(const std::string& id) const;

    [[nodiscard]] bool has_tilemap(const std::string& id) const;
    [[nodiscard]] std::optional<std::vector<glm::uvec2>>
    find_path(const std::string& tilemap_id, std::size_t blocking_layer, glm::uvec2 start, glm::uvec2 end) const;
    [[nodiscard]] std::optional<glm::uvec2> get_cell_at_coord(const std::string& tilemap_id, glm::vec2 point) const;
    [[nodiscard]] std::optional<glm::vec2> get_cell_center(const std::string& tilemap_id, glm::uvec2 cell) const;
    [[nodiscard]] std::string make_snapshot(glm::vec2 min, glm::vec2 max) const;

    seraphim::scene::scene scene;
    // Exists only while the scene is simulated, so the editor can edit a scene without it moving.
    std::optional<seraphim::scene::physics_system> physics;
    // The script host's function, called once per simulated tick; undefined or null when no scripts run.
    emscripten::val tick_handler = emscripten::val::undefined();

    std::uint32_t local_player_id{};
};

inline world* g_world{};

} // namespace seraphim::scene
