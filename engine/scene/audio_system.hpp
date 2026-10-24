#pragma once

#include <entt/entity/fwd.hpp>

namespace seraphim::asset
{
class asset_manager;
}

namespace seraphim::render
{
class camera2d;
}

namespace seraphim::scene
{

struct audio_source;

// Plays the sounds of audio sources while the scene is simulated.
class audio_system
{
  public:
    // Loads the sound of every audio source, so playing does not search by id.
    static void resolve(entt::registry& registry, asset::asset_manager& assets);

    // Plays the sources marked to play on start.
    static void start(entt::registry& registry, const asset::asset_manager& assets);
    // Starts the plays that were waiting for their sound to load.
    static void update(entt::registry& registry, const asset::asset_manager& assets, const render::camera2d& camera);

    // Restarts the sound if it is already playing.
    static void play(audio_source& source, const asset::asset_manager& assets);
    static void stop(audio_source& source);
    static void set_volume(audio_source& source, float volume);
    [[nodiscard]] static bool is_playing(const audio_source& source);
};

} // namespace seraphim::scene
