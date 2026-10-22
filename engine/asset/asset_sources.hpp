#pragma once

#include <string>
#include <unordered_map>
#include <vector>

namespace seraphim::asset
{

// Maps asset ids to the URLs their data is fetched from. The host (the editor, or a player loading an exported game)
// fills it in, possibly before the GPU is ready, so it lives apart from the asset manager.
class asset_sources
{
  public:
    // Registering a new URL for a known id marks it as changed, so loaded copies get reloaded.
    void set(std::string id, std::string url);
    [[nodiscard]] const std::string* find(const std::string& id) const;
    [[nodiscard]] std::vector<std::string> take_changed();

  private:
    std::unordered_map<std::string, std::string> m_urls;
    std::vector<std::string> m_changed;
};

} // namespace seraphim::asset
