#pragma once

#include <chrono>
#include <optional>

namespace seraphim::core
{

// Converts real elapsed time into a whole number of fixed-length ticks, so simulation results do not depend on the
// display's frame rate. Lives in core rather than platform because a headless server must run the same ticks.
class fixed_timestep
{
  public:
    using duration = std::chrono::nanoseconds;

    explicit fixed_timestep(duration step, duration max_frame = std::chrono::milliseconds{250});

    // Returns how many ticks to run for the time elapsed since the previous call; the first call only starts the clock.
    [[nodiscard]] int advance(duration now);

    [[nodiscard]] duration step() const { return m_step; }

    // How far the clock is between the last tick and the next one, in [0, 1), for interpolating rendered state.
    [[nodiscard]] float alpha() const;

  private:
    duration m_step;
    duration m_max_frame;
    duration m_accumulator{};
    std::optional<duration> m_last;
};

} // namespace seraphim::core
