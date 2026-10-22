#include "platform/input.hpp"

#include <SDL3/SDL_events.h>

namespace seraphim::platform
{

void input::handle(const SDL_Event& event)
{
    switch (event.type)
    {
    case SDL_EVENT_KEY_DOWN:
        if (event.key.scancode < SDL_SCANCODE_COUNT && !event.key.repeat)
        {
            m_keys_down.set(event.key.scancode);
            m_keys_pressed.set(event.key.scancode);
        }
        break;
    case SDL_EVENT_KEY_UP:
        if (event.key.scancode < SDL_SCANCODE_COUNT)
        {
            m_keys_down.reset(event.key.scancode);
            m_keys_released.set(event.key.scancode);
        }
        break;
    case SDL_EVENT_MOUSE_BUTTON_DOWN:
        if (event.button.button < button_count)
        {
            m_buttons_down.set(event.button.button);
            m_buttons_pressed.set(event.button.button);
        }
        break;
    case SDL_EVENT_MOUSE_BUTTON_UP:
        if (event.button.button < button_count)
        {
            m_buttons_down.reset(event.button.button);
            m_buttons_released.set(event.button.button);
        }
        break;
    case SDL_EVENT_MOUSE_MOTION:
        m_mouse_x = event.motion.x;
        m_mouse_y = event.motion.y;
        break;
    case SDL_EVENT_MOUSE_WHEEL:
        m_wheel_delta += event.wheel.y;
        break;
    case SDL_EVENT_WINDOW_FOCUS_LOST:
        // Key-up events never arrive while unfocused, so held keys would otherwise stay stuck down.
        reset();
        break;
    default:
        break;
    }
}

void input::end_frame()
{
    m_keys_pressed.reset();
    m_keys_released.reset();
    m_buttons_pressed.reset();
    m_buttons_released.reset();
    m_wheel_delta = 0.0f;
}

void input::reset()
{
    end_frame();
    m_keys_down.reset();
    m_buttons_down.reset();
}

} // namespace seraphim::platform
