#include "core/fixed_timestep.hpp"

#include "core/assert.hpp"

#include <algorithm>

namespace seraphim::core
{

fixed_timestep::fixed_timestep(duration step, duration max_frame) : m_step(step), m_max_frame(max_frame)
{
    SERAPHIM_CHECK(step > duration::zero(), "fixed timestep must be positive");
}

int fixed_timestep::advance(duration now)
{
    const duration elapsed = m_last ? now - *m_last : duration::zero();
    m_last = now;

    // A backgrounded tab stops frames entirely; without the cap, returning to it would replay every missed tick.
    m_accumulator += std::min(elapsed, m_max_frame);

    const auto ticks = m_accumulator / m_step;
    m_accumulator -= ticks * m_step;
    return static_cast<int>(ticks);
}

float fixed_timestep::alpha() const
{
    return std::chrono::duration<float>(m_accumulator) / std::chrono::duration<float>(m_step);
}

} // namespace seraphim::core
