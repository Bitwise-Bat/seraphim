#pragma once

#include <bitset>
#include <cstdint>
#include <SDL3/SDL_mouse.h>
#include <SDL3/SDL_scancode.h>

union SDL_Event;

namespace seraphim::platform
{

// Values are SDL scancodes, so keys follow the physical layout: WASD stays put on AZERTY.
enum class key : std::uint16_t
{
    a = SDL_SCANCODE_A,
    b = SDL_SCANCODE_B,
    c = SDL_SCANCODE_C,
    d = SDL_SCANCODE_D,
    e = SDL_SCANCODE_E,
    f = SDL_SCANCODE_F,
    g = SDL_SCANCODE_G,
    h = SDL_SCANCODE_H,
    i = SDL_SCANCODE_I,
    j = SDL_SCANCODE_J,
    k = SDL_SCANCODE_K,
    l = SDL_SCANCODE_L,
    m = SDL_SCANCODE_M,
    n = SDL_SCANCODE_N,
    o = SDL_SCANCODE_O,
    p = SDL_SCANCODE_P,
    q = SDL_SCANCODE_Q,
    r = SDL_SCANCODE_R,
    s = SDL_SCANCODE_S,
    t = SDL_SCANCODE_T,
    u = SDL_SCANCODE_U,
    v = SDL_SCANCODE_V,
    w = SDL_SCANCODE_W,
    x = SDL_SCANCODE_X,
    y = SDL_SCANCODE_Y,
    z = SDL_SCANCODE_Z,
    digit_1 = SDL_SCANCODE_1,
    digit_2 = SDL_SCANCODE_2,
    digit_3 = SDL_SCANCODE_3,
    digit_4 = SDL_SCANCODE_4,
    digit_5 = SDL_SCANCODE_5,
    digit_6 = SDL_SCANCODE_6,
    digit_7 = SDL_SCANCODE_7,
    digit_8 = SDL_SCANCODE_8,
    digit_9 = SDL_SCANCODE_9,
    digit_0 = SDL_SCANCODE_0,
    enter = SDL_SCANCODE_RETURN,
    escape = SDL_SCANCODE_ESCAPE,
    backspace = SDL_SCANCODE_BACKSPACE,
    tab = SDL_SCANCODE_TAB,
    space = SDL_SCANCODE_SPACE,
    f1 = SDL_SCANCODE_F1,
    f2 = SDL_SCANCODE_F2,
    f3 = SDL_SCANCODE_F3,
    f4 = SDL_SCANCODE_F4,
    f5 = SDL_SCANCODE_F5,
    f6 = SDL_SCANCODE_F6,
    f7 = SDL_SCANCODE_F7,
    f8 = SDL_SCANCODE_F8,
    f9 = SDL_SCANCODE_F9,
    f10 = SDL_SCANCODE_F10,
    f11 = SDL_SCANCODE_F11,
    f12 = SDL_SCANCODE_F12,
    right = SDL_SCANCODE_RIGHT,
    left = SDL_SCANCODE_LEFT,
    down = SDL_SCANCODE_DOWN,
    up = SDL_SCANCODE_UP,
    left_ctrl = SDL_SCANCODE_LCTRL,
    left_shift = SDL_SCANCODE_LSHIFT,
    left_alt = SDL_SCANCODE_LALT,
    right_ctrl = SDL_SCANCODE_RCTRL,
    right_shift = SDL_SCANCODE_RSHIFT,
    right_alt = SDL_SCANCODE_RALT,
};

enum class mouse_button : std::uint8_t
{
    left = SDL_BUTTON_LEFT,
    middle = SDL_BUTTON_MIDDLE,
    right = SDL_BUTTON_RIGHT,
    back = SDL_BUTTON_X1,
    forward = SDL_BUTTON_X2,
};

// Polled input state. Edges (pressed/released, wheel) accumulate until end_frame(), so a tap shorter than a frame is
// still seen once.
class input
{
  public:
    void handle(const SDL_Event& event);
    void end_frame();

    [[nodiscard]] bool is_down(key code) const { return m_keys_down[index(code)]; }
    [[nodiscard]] bool was_pressed(key code) const { return m_keys_pressed[index(code)]; }
    [[nodiscard]] bool was_released(key code) const { return m_keys_released[index(code)]; }

    [[nodiscard]] bool is_down(mouse_button button) const { return m_buttons_down[index(button)]; }
    [[nodiscard]] bool was_pressed(mouse_button button) const { return m_buttons_pressed[index(button)]; }
    [[nodiscard]] bool was_released(mouse_button button) const { return m_buttons_released[index(button)]; }

    // Window coordinates, i.e. CSS pixels relative to the canvas.
    [[nodiscard]] float mouse_x() const { return m_mouse_x; }
    [[nodiscard]] float mouse_y() const { return m_mouse_y; }
    [[nodiscard]] float wheel_delta() const { return m_wheel_delta; }

  private:
    static constexpr std::size_t button_count = SDL_BUTTON_X2 + 1;

    static constexpr std::size_t index(key code) { return static_cast<std::size_t>(code); }
    static constexpr std::size_t index(mouse_button button) { return static_cast<std::size_t>(button); }

    void reset();

    std::bitset<SDL_SCANCODE_COUNT> m_keys_down;
    std::bitset<SDL_SCANCODE_COUNT> m_keys_pressed;
    std::bitset<SDL_SCANCODE_COUNT> m_keys_released;
    std::bitset<button_count> m_buttons_down;
    std::bitset<button_count> m_buttons_pressed;
    std::bitset<button_count> m_buttons_released;
    float m_mouse_x = 0.0f;
    float m_mouse_y = 0.0f;
    float m_wheel_delta = 0.0f;
};

} // namespace seraphim::platform
