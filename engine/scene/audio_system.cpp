#include "scene/audio_system.hpp"

#include "asset/asset_manager.hpp"
#include "platform/audio.hpp"
#include "scene/components.hpp"

#include <algorithm>
#include <entt/entity/registry.hpp>

namespace seraphim::scene
{

void audio_system::resolve(entt::registry& registry, asset::asset_manager& assets)
{
    for (const auto [entity, source] : registry.view<audio_source>().each())
        if (!source.sound.empty())
            source.handle = assets.load_sound(source.sound);
}

void audio_system::start(entt::registry& registry, const asset::asset_manager& assets)
{
    for (const auto [entity, source] : registry.view<audio_source>().each())
        if (source.play_on_start)
            play(source, assets);
}

void audio_system::update(entt::registry& registry, const asset::asset_manager& assets)
{
    for (const auto [entity, source] : registry.view<audio_source>().each())
        if (source.pending)
            play(source, assets);
}

void audio_system::play(audio_source& source, const asset::asset_manager& assets)
{
    stop(source);
    const asset::sound* sound = assets.get_sound(source.handle);
    // Without an asset id the sound would never arrive, so only a sound that is still loading is waited for.
    if (!sound)
    {
        source.pending = source.handle.valid();
        return;
    }
    source.voice = platform::play_sound(sound->samples, std::max(source.volume, 0.0F), source.loop);
}

void audio_system::stop(audio_source& source)
{
    source.pending = false;
    if (source.voice)
        platform::stop_voice(*source.voice);
    source.voice.reset();
}

void audio_system::set_volume(audio_source& source, float volume)
{
    // A negative gain would invert the waveform rather than silence it.
    source.volume = std::max(volume, 0.0F);
    if (source.voice)
        platform::set_voice_volume(*source.voice, source.volume);
}

bool audio_system::is_playing(const audio_source& source)
{
    return source.pending || (source.voice && platform::is_voice_playing(*source.voice));
}

} // namespace seraphim::scene
