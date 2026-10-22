cmake_minimum_required(VERSION 4.2)
project(seraphim VERSION 0.1.0 LANGUAGES CXX)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Seraphim builds only with Emscripten. Use a web-* preset.")
endif()

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# No C++ modules are used, and emscan-deps does not resolve include paths added by --use-port.
set(CMAKE_CXX_SCAN_FOR_MODULES OFF)

add_subdirectory(engine)
