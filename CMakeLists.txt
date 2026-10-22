cmake_minimum_required(VERSION 4.2)
project(seraphim LANGUAGES CXX)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Seraphim builds only with Emscripten. Use a web-* preset.")
endif()

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_subdirectory(engine)
