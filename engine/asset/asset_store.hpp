#pragma once

#include "asset/handle.hpp"

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

namespace seraphim::asset
{

// Maps asset UUIDs to slots. A slot can exist before its asset does, so handles are handed out while the asset is
// still loading.
template <typename T>
class asset_store
{
  public:
    // Adding an id that is already stored returns its handle.
    handle<T> add(std::string uuid)
    {
        if (const handle<T> existing = find(uuid); existing.valid())
            return existing;

        const handle<T> added{static_cast<std::uint32_t>(m_slots.size())};
        m_handles_by_id.emplace(uuid, added);
        m_slots.push_back({std::move(uuid), std::nullopt});
        return added;
    }

    void set(handle<T> handle, T asset) { m_slots[handle.index].asset.emplace(std::move(asset)); }

    [[nodiscard]] handle<T> find(std::string_view uuid) const
    {
        const auto existing = m_handles_by_id.find(uuid);
        return existing == m_handles_by_id.end() ? handle<T>{} : existing->second;
    }

    // Null while the asset is not loaded, or when the handle is invalid.
    [[nodiscard]] const T* get(handle<T> handle) const
    {
        if (handle.index >= m_slots.size() || !m_slots[handle.index].asset)
            return nullptr;
        return &*m_slots[handle.index].asset;
    }

    [[nodiscard]] const std::string& uuid(handle<T> handle) const { return m_slots[handle.index].uuid; }

  private:
    struct slot
    {
        std::string uuid;
        std::optional<T> asset;
    };

    struct uuid_hash
    {
        using is_transparent = void;

        std::size_t operator()(std::string_view uuid) const { return std::hash<std::string_view>{}(uuid); }
    };

    std::vector<slot> m_slots;
    std::unordered_map<std::string, handle<T>, uuid_hash, std::equal_to<>> m_handles_by_id;
};

} // namespace seraphim::asset
