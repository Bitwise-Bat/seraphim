#include "platform/audio.hpp"

#include <emscripten/em_js.h>
#include <emscripten/emscripten.h>
#include <utility>

namespace
{

using seraphim::platform::finished_sound;
using seraphim::platform::sound_request;
using seraphim::platform::voice;

sound_request g_next_request = 0;
voice g_next_voice = 0;
std::vector<finished_sound> g_finished;

} // namespace

// clang-format off
EM_JS(void, seraphim_audio_init, (), {
    // Browsers keep the context suspended until the page has seen a user gesture; playing a voice resumes it.
    Module.seraphimAudio = {context: new AudioContext(), sounds: new Map(), voices: new Map()};
});

EM_JS(void, seraphim_fetch_sound, (const char* url, std::uint32_t request), {
    const audio = Module.seraphimAudio;
    const path = UTF8ToString(url);
    fetch(path)
        .then((response) => {
            if (!response.ok)
                throw new Error(response.status + ' ' + response.statusText);
            return response.arrayBuffer();
        })
        .then((bytes) => audio.context.decodeAudioData(bytes))
        .then((buffer) => {
            audio.sounds.set(request, buffer);
            _seraphim_sound_finished(request, 1);
        })
        .catch((error) => {
            console.error('Failed to load sound ' + path + ':', error);
            _seraphim_sound_finished(request, 0);
        });
});

EM_JS(void, seraphim_release_sound, (std::uint32_t sound), {
    Module.seraphimAudio.sounds.delete(sound);
});

EM_JS(void, seraphim_play_sound, (std::uint32_t sound, std::uint32_t voice, float volume, int loop), {
    const audio = Module.seraphimAudio;
    const buffer = audio.sounds.get(sound);
    if (!buffer)
        return;
    audio.context.resume();

    const gain = audio.context.createGain();
    gain.gain.value = volume;
    gain.connect(audio.context.destination);
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop !== 0;
    source.connect(gain);
    source.onended = () => {
        gain.disconnect();
        audio.voices.delete(voice);
    };
    audio.voices.set(voice, {source, gain});
    source.start();
});

EM_JS(void, seraphim_stop_voice, (std::uint32_t voice), {
    const audio = Module.seraphimAudio;
    const playing = audio.voices.get(voice);
    if (!playing)
        return;
    // onended fires later, by which time the voice id may already be reused.
    playing.source.onended = null;
    playing.source.stop();
    playing.gain.disconnect();
    audio.voices.delete(voice);
});

EM_JS(void, seraphim_set_voice_volume, (std::uint32_t voice, float volume), {
    const playing = Module.seraphimAudio.voices.get(voice);
    if (playing)
        playing.gain.gain.value = volume;
});

EM_JS(int, seraphim_is_voice_playing, (std::uint32_t voice), {
    return Module.seraphimAudio.voices.has(voice) ? 1 : 0;
});

EM_JS(void, seraphim_stop_all_voices, (), {
    const audio = Module.seraphimAudio;
    for (const playing of audio.voices.values()) {
        playing.source.onended = null;
        playing.source.stop();
        playing.gain.disconnect();
    }
    audio.voices.clear();
});
// clang-format on

extern "C"
{
    EMSCRIPTEN_KEEPALIVE void seraphim_sound_finished(sound_request request, int loaded)
    {
        g_finished.push_back({request, loaded != 0});
    }
}

namespace
{

// The context is created on first use, so pages that never touch audio do not open one.
void initialize()
{
    static const bool initialized = []
    {
        seraphim_audio_init();
        return true;
    }();
    static_cast<void>(initialized);
}

} // namespace

namespace seraphim::platform
{

sound_request request_sound(const std::string& url)
{
    initialize();
    const sound_request request = g_next_request++;
    seraphim_fetch_sound(url.c_str(), request);
    return request;
}

std::vector<finished_sound> take_finished_sounds()
{
    return std::exchange(g_finished, {});
}

void release_sound(sound_request sound)
{
    initialize();
    seraphim_release_sound(sound);
}

voice play_sound(sound_request sound, float volume, bool loop)
{
    initialize();
    const voice played = g_next_voice++;
    seraphim_play_sound(sound, played, volume, loop ? 1 : 0);
    return played;
}

void stop_voice(voice voice)
{
    initialize();
    seraphim_stop_voice(voice);
}

void set_voice_volume(voice voice, float volume)
{
    initialize();
    seraphim_set_voice_volume(voice, volume);
}

bool is_voice_playing(voice voice)
{
    initialize();
    return seraphim_is_voice_playing(voice) != 0;
}

void stop_all_voices()
{
    initialize();
    seraphim_stop_all_voices();
}

} // namespace seraphim::platform
