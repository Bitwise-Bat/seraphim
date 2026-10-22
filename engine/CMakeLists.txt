configure_file(core/version.hpp.in ${CMAKE_CURRENT_BINARY_DIR}/generated/core/version.hpp @ONLY)

# Embeds a WGSL file as seraphim::render::shaders::<name> in generated/render/shaders/<name>.hpp. Editing the file
# re-runs CMake, which regenerates the header.
function(seraphim_embed_shader name source)
    set(path ${CMAKE_CURRENT_SOURCE_DIR}/${source})
    set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS ${path})
    file(READ ${path} SERAPHIM_SHADER_SOURCE)
    set(SERAPHIM_SHADER_NAME ${name})
    configure_file(render/shader.hpp.in ${CMAKE_CURRENT_BINARY_DIR}/generated/render/shaders/${name}.hpp @ONLY)
endfunction()

seraphim_embed_shader(sprite render/shaders/sprite.wgsl)

add_executable(seraphim main.cpp asset/asset_manager.cpp asset/asset_sources.cpp asset/image_loader.cpp
    core/fixed_timestep.cpp core/log.cpp
    platform/input.cpp platform/window.cpp render/camera2d.cpp render/renderer.cpp render/sprite_renderer.cpp
    render/texture2d.cpp)
find_package(glm CONFIG REQUIRED)
target_link_libraries(seraphim PRIVATE glm::glm-header-only)
target_include_directories(seraphim PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/generated)
target_compile_options(seraphim PRIVATE -sUSE_SDL=3 --use-port=emdawnwebgpu)
set_target_properties(seraphim PROPERTIES RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR})
target_link_options(seraphim PRIVATE
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sENVIRONMENT=web
    -sALLOW_MEMORY_GROWTH=1
    -sUSE_SDL=3
    --use-port=emdawnwebgpu
    # SDL3 assigns Module.requestFullscreen; unexported, ASSERTIONS makes it a getter-only stub that throws.
    -sEXPORTED_RUNTIME_METHODS=requestFullscreen
    -lembind
    "SHELL:--emit-tsd ${CMAKE_BINARY_DIR}/seraphim.d.ts"
)
