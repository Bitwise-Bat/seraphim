#include "scene/scene.hpp"

#include "scene/components.hpp"

#include <utility>

namespace seraphim::scene
{

entt::entity scene::create(std::string id, std::string name)
{
    const entt::entity entity = m_registry.create();
    m_registry.emplace<identity>(entity, std::move(id), std::move(name));
    return entity;
}

entt::entity scene::find(std::string_view id) const
{
    for (const auto [entity, entity_identity] : m_registry.view<const identity>().each())
        if (entity_identity.id == id)
            return entity;
    return entt::null;
}

} // namespace seraphim::scene
