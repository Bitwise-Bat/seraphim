configure_file(core/version.hpp.in ${CMAKE_CURRENT_BINARY_DIR}/generated/core/version.hpp @ONLY)

add_executable(seraphim main.cpp core/log.cpp)
target_include_directories(seraphim PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/generated)
set_target_properties(seraphim PROPERTIES RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR})
target_link_options(seraphim PRIVATE
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sENVIRONMENT=web
    -sALLOW_MEMORY_GROWTH=1
    -lembind
    "SHELL:--emit-tsd ${CMAKE_BINARY_DIR}/seraphim.d.ts"
)
