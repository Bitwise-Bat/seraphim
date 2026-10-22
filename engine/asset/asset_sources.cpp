#include "asset/asset_sources.hpp"

#include <utility>

namespace seraphim::asset
{

void asset_sources::set(std::string id, std::string url)
{
    std::string& current = m_urls[id];
    if (current == url)
        return;

    current = std::move(url);
    m_changed.push_back(std::move(id));
}

const std::string* asset_sources::find(const std::string& id) const
{
    const auto entry = m_urls.find(id);
    return entry != m_urls.end() ? &entry->second : nullptr;
}

std::vector<std::string> asset_sources::take_changed()
{
    return std::exchange(m_changed, {});
}

} // namespace seraphim::asset
