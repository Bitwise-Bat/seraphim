#pragma once

#include "asset/animation_set.hpp"
#include "asset/sound.hpp"
#include "asset/texture_handle.hpp"
#include "asset/tileset.hpp"

#include <cstddef>
#include <cstdint>
#include <glm/vec2.hpp>
#include <glm/vec4.hpp>
#include <limits>
#include <optional>
#include <string>
#include <vector>

namespace seraphim::scene
{

// Every entity has one. The id is a UUID that stays the same across saves, so scene files and the editor can refer to
// entities while their runtime handles change on every load.
struct identity
{
    std::string id;
    std::string name;
};

struct transform
{
    glm::vec2 position{0.0F};
    // Counter-clockwise, in radians.
    float rotation = 0.0F;
    glm::vec2 scale{1.0F};
};

struct sprite
{
    // Asset id of the texture.
    std::string texture;
    // Resolved from the asset id on first draw, since the asset manager only exists once the GPU is ready.
    asset::texture_handle handle;
    // In world units, before the transform's scale.
    glm::vec2 size{1.0F};
    // Texture region as (min u, min v, max u, max v), with v = 0 at the top row of the image.
    glm::vec4 uv_rect{0.0F, 0.0F, 1.0F, 1.0F};
    glm::vec4 color{1.0F};
    // Lower orders are drawn first, so higher ones end up on top.
    std::int32_t order = 0;
};

enum class body_type : std::uint8_t
{
    static_body,
    kinematic,
    dynamic,
};

struct rigidbody
{
    body_type type = body_type::dynamic;
    float gravity_scale = 1.0F;
    bool fixed_rotation = false;
};

enum class collider_shape : std::uint8_t
{
    box,
    circle,
};

// An entity with a collider but no rigidbody is static. Sizes are in world units before the transform's scale.
struct collider
{
    collider_shape shape = collider_shape::box;
    glm::vec2 size{1.0F};
    // Used by circles only.
    float radius = 0.5F;
    glm::vec2 offset{0.0F};
    // In kilograms per square meter; only dynamic bodies use it, to derive their mass.
    float density = 1.0F;
    float friction = 0.6F;
    float restitution = 0.0F;
    // Detects overlaps without colliding.
    bool sensor = false;
};

// Plays a clip of an animation set by rewriting the sprite's texture region.
struct animator
{
    // Asset id of the animation set.
    std::string animation_set;
    // Resolved from the asset id when the scene loads.
    asset::animation_set_handle handle;
    std::string clip;
    std::size_t frame = 0;
    // Seconds spent on the current frame.
    float elapsed = 0.0F;
};

enum class tilemap_orientation : std::uint8_t
{
    orthogonal,
    // Cells are diamonds: columns run down to the right and rows down to the left.
    isometric,
};

// A grid of cells filled from one tileset. The transform's position is the top-left corner of the map, or the top
// corner of an isometric one, and rows run downwards from there, so the scene file reads like the map looks.
struct tilemap
{
    // Asset id of the tileset.
    std::string tileset;
    // Resolved from the asset id when the scene loads.
    asset::tileset_handle handle;
    tilemap_orientation orientation = tilemap_orientation::orthogonal;
    // In world units, before the transform's scale. For isometric maps this is the diamond's full width and height.
    glm::vec2 cell_size{1.0F};
    // In cells.
    glm::uvec2 size{0};
    // Each layer holds size.x * size.y tile numbers row by row, where 0 is an empty cell. Later layers are drawn on
    // top.
    std::vector<std::vector<std::uint16_t>> layers;
    // Sorted together with sprite orders, so sprites can stand in front of or behind the whole map.
    std::int32_t order = 0;
};

// Plays a sound while the scene is simulated.
struct audio_source
{
    // Asset id of the sound.
    std::string sound;
    // Resolved from the asset id when the scene loads.
    asset::sound_handle handle;
    // 1 plays the sound as recorded.
    float volume = 1.0F;
    bool loop = false;
    bool play_on_start = false;
    // Pans and fades the sound by the entity's position relative to the camera.
    bool spatial = false;
    // Set while a play waits for the sound to finish loading.
    bool pending = false;
    std::optional<platform::voice> voice;
};

inline constexpr std::uint32_t invalid_player_id = std::numeric_limits<std::uint32_t>::max();

// Marks an entity whose state the server sends to every client.
struct networked
{
    std::uint32_t owner_id = invalid_player_id;
};

// Asset ids of the scripts that drive the entity, run in list order while the scene is simulated.
struct scripts
{
    std::vector<std::string> assets;
};

} // namespace seraphim::scene
