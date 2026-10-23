# Vendored from https://github.com/fgenesis/tinypile (jps.hh at 5330d8ad37c496a89c94d80668c3a1518135154a), public
# domain. vcpkg has no port for it.
add_library(jps INTERFACE)
add_library(jps::jps ALIAS jps)
target_include_directories(jps SYSTEM INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/include)
