add_executable(seraphim_server native/server_main.cpp)
target_link_libraries(seraphim_server PRIVATE seraphim_world_bindings)
set_target_properties(seraphim_server PROPERTIES SUFFIX ".mjs" RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR})
target_link_options(seraphim_server PRIVATE
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sENVIRONMENT=node
    -sALLOW_MEMORY_GROWTH=1
    -lembind
    "SHELL:--emit-tsd ${CMAKE_BINARY_DIR}/seraphim_server.d.mts"
)

add_custom_command(TARGET seraphim_server POST_BUILD 
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/seraphim-launcher.bat
        ${CMAKE_BINARY_DIR}/seraphim-launcher.bat
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/register.bat
        ${CMAKE_BINARY_DIR}/register.bat
)
