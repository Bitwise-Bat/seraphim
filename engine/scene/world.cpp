#include "scene/world.hpp"

#include "core/log.hpp"
#include "scene/navigator_grid.hpp"
#include "scene/tilemap_grid.hpp"

#include <cmath>
#include <glm/common.hpp>
#include <nlohmann/json.hpp>
#include <utility>

namespace seraphim::scene
{

world::world(seraphim::scene::scene scene) : scene(std::move(scene))
{
    g_world = this;
}

world::~world()
{
    if (g_world == this)
        g_world = nullptr;
}

void world::tick(float seconds)
{
    if (!physics)
        return;
    if (!tick_handler.isUndefined() && !tick_handler.isNull())
        tick_handler();
    physics->step(scene, seconds);
}

std::optional<std::string> world::find_entity(const std::string& name)
{
    for (const auto [entity, entity_identity] : scene.registry().view<const identity>().each())
        if (entity_identity.name == name)
            return entity_identity.id;
    return std::nullopt;
}

std::optional<transform> world::get_transform(const std::string& id) const
{
    const auto* placement = scene.registry().try_get<transform>(scene.find(id));
    if (!placement)
        return std::nullopt;
    return *placement;
}

void world::set_transform(const std::string& id, transform transform)
{
    const entt::entity entity = scene.find(id);
    if (entity == entt::null)
        return;
    scene.registry().emplace_or_replace<seraphim::scene::transform>(entity, transform);
}

std::optional<glm::vec2> world::get_velocity(const std::string& id) const
{
    if (!physics)
        return std::nullopt;
    const entt::entity entity = scene.find(id);
    if (entity == entt::null)
        return std::nullopt;
    return physics->get_velocity(entity);
}

void world::set_velocity(const std::string& id, glm::vec2 velocity)
{
    if (!physics)
        return;
    const entt::entity entity = scene.find(id);
    if (entity == entt::null)
        return;
    physics->set_velocity(entity, velocity);
}

bool world::has_body(const std::string& id) const
{
    if (!physics)
        return false;
    const entt::entity entity = scene.find(id);
    return entity != entt::null && physics->has_body(entity);
}

std::optional<std::string> world::get_clip(const std::string& id) const
{
    const auto* player = scene.registry().try_get<animator>(scene.find(id));
    if (!player)
        return std::nullopt;
    return player->clip;
}

void world::set_clip(const std::string& id, const std::string& clip)
{
    auto* player = scene.registry().try_get<animator>(scene.find(id));
    seraphim::log::info("PLAYER {} CLIP: {}", player != nullptr, clip);
    // Setting the playing clip again, as scripts do every tick, must not restart it.
    if (!player || player->clip == clip)
        return;
    player->clip = clip;
    player->frame = 0;
    player->elapsed = 0.0F;
}

bool world::has_animator(const std::string& id) const
{
    return scene.registry().all_of<animator>(scene.find(id));
}

bool world::has_tilemap(const std::string& id) const
{
    return scene.registry().all_of<tilemap>(scene.find(id));
}

std::optional<std::vector<glm::uvec2>> world::find_path(const std::string& tilemap_id, std::size_t blocking_layer,
                                                        glm::uvec2 start, glm::uvec2 end) const
{
    const auto* map = scene.registry().try_get<tilemap>(scene.find(tilemap_id));
    if (!map)
        return std::nullopt;
    return navigator_grid(*map, blocking_layer).find_path(start, end);
}

std::optional<glm::uvec2> world::get_cell_at_coord(const std::string& tilemap_id, glm::vec2 point) const
{
    const entt::entity entity = scene.find(tilemap_id);
    const auto* map = scene.registry().try_get<tilemap>(entity);
    const auto* placement = scene.registry().try_get<transform>(entity);
    if (!map || !placement)
        return std::nullopt;

    const glm::vec2 cell = map->cell_size * placement->scale;
    if (cell.x == 0.0F || cell.y == 0.0F)
        return std::nullopt;

    // Same mapping as sprite_system::draw_tilemap: rows run downwards from the transform's position.
    const float cosine = std::cos(placement->rotation);
    const float sine = std::sin(placement->rotation);
    const glm::vec2 offset = point - placement->position;
    const glm::vec2 local{(offset.x * cosine) + (offset.y * sine), (offset.y * cosine) - (offset.x * sine)};
    const glm::vec2 grid = glm::floor(local_to_grid(map->orientation, cell, local));
    if (grid.x < 0.0F || grid.y < 0.0F || grid.x >= static_cast<float>(map->size.x) ||
        grid.y >= static_cast<float>(map->size.y))
        return std::nullopt;
    return glm::uvec2{grid};
}

// The inverse of get_cell_at_coord: the world position of a cell's centre, so movers aim at the middle of a tile.
std::optional<glm::vec2> world::get_cell_center(const std::string& tilemap_id, glm::uvec2 cell) const
{
    const entt::entity entity = scene.find(tilemap_id);
    const auto* map = scene.registry().try_get<tilemap>(entity);
    const auto* placement = scene.registry().try_get<transform>(entity);
    if (!map || !placement || cell.x >= map->size.x || cell.y >= map->size.y)
        return std::nullopt;

    const glm::vec2 size = map->cell_size * placement->scale;
    const float cosine = std::cos(placement->rotation);
    const float sine = std::sin(placement->rotation);
    const glm::vec2 local = grid_to_local(map->orientation, size, glm::vec2{cell} + 0.5F);
    return placement->position +
           glm::vec2{(local.x * cosine) - (local.y * sine), (local.x * sine) + (local.y * cosine)};
}

std::string world::make_snapshot(glm::vec2 min, glm::vec2 max) const
{
    auto entities = nlohmann::json::array();
    const auto view = scene.registry().view<const identity, const transform, const networked, const animator>();
    for (const auto& [entity, id, tf, net, anim] : view.each())
    {
        const auto p = tf.position;
        if (p.x >= min.x && p.x <= max.x && p.y >= min.y && p.y <= max.y)
            entities.push_back(
                {{"id", id.id}, {"position", {p.x, p.y}}, {"rotation", tf.rotation}, {"clip", anim.clip}, {"scale", {tf.scale.x, tf.scale.y}}});
    }
    return nlohmann::json{{"type", "snapshot"}, {"entities", std::move(entities)}}.dump();
}

} // namespace seraphim::scene
