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

} // namespace seraphim::scene
