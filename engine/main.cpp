#include "core/log.hpp"
#include "core/version.hpp"

int main()
{
    seraphim::log::info("Seraphim {} started", seraphim::version::string);
    return 0;
}
