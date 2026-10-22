configure_file(core/version.hpp.in ${CMAKE_CURRENT_BINARY_DIR}/generated/core/version.hpp @ONLY)

add_executable(seraphim main.cpp core/log.cpp platform/window.cpp)
target_include_directories(seraphim PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/generated)
target_compile_options(seraphim PRIVATE -sUSE_SDL=3)
set_target_properties(seraphim PROPERTIES RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR})
target_link_options(seraphim PRIVATE
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sENVIRONMENT=web
    -sALLOW_MEMORY_GROWTH=1
    -sUSE_SDL=3
    # SDL3 assigns Module.requestFullscreen; unexported, ASSERTIONS makes it a getter-only stub that throws.
    -sEXPORTED_RUNTIME_METHODS=requestFullscreen
    -lembind
    "SHELL:--emit-tsd ${CMAKE_BINARY_DIR}/seraphim.d.ts"
)
