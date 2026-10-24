#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace seraphim::platform
{

// Sounds are decoded and played by the browser's Web Audio API, so their samples never enter wasm memory. A sound is
// named by the request that decoded it.
using sound_request = std::uint32_t;
using voice = std::uint32_t;

struct finished_sound
{
    sound_request request;
    bool loaded = false;
};

// Fetches and decodes the file in the browser without blocking; collect the result with take_finished_sounds().
[[nodiscard]] sound_request request_sound(const std::string& url);

// Returns the requests completed since the previous call.
[[nodiscard]] std::vector<finished_sound> take_finished_sounds();

// Frees the samples of a sound that was replaced. Voices already playing it keep going.
void release_sound(sound_request sound);

// Voices that do not loop end on their own once the sound is over.
[[nodiscard]] voice play_sound(sound_request sound, float volume, bool loop);
// Like play_sound, but panned and faded by its distance from the listener. Positions are in world units.
[[nodiscard]] voice play_sound_spatial(sound_request sound, float volume, bool loop, float x, float y);
void set_voice_position(voice voice, float x, float y);
// Counter-clockwise, in radians, like the transform's rotation.
void update_listener(float x, float y, float rotation);
void stop_voice(voice voice);
void set_voice_volume(voice voice, float volume);
[[nodiscard]] bool is_voice_playing(voice voice);
void stop_all_voices();

} // namespace seraphim::platform
