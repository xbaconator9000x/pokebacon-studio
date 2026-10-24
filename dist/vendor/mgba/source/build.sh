#!/usr/bin/env bash
set -euo pipefail

# Build mGBA (Game Boy Advance / Game Boy / Game Boy Color) to WebAssembly
# with Emscripten.
#
# Unlike the Snes9x and Geolith ports, the source list is not enumerated here.
# mGBA is CMake-native and already knows how to build itself as a dependency-
# free static core — `DISABLE_FRONTENDS` plus `DISABLE_DEPS` is exactly the
# "just the emulator" configuration this needs — and it generates `version.c`
# and `flags.h` along the way, which a hand-written source list would have to
# reproduce. So: emcmake builds libmgba.a, then emcc links the shim against it.
#
# Outputs: dist/mgba/mgba.js (MODULARIZE factory `createMgbaModule`)
#          dist/mgba/mgba.wasm

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PROJECT_DIR}/.tmp/mgba-build"
CMAKE_DIR="${PROJECT_DIR}/.tmp/mgba-cmake"
OUT_DIR="${PROJECT_DIR}/dist/mgba"

MGBA_REPO="${MGBA_REPO:-https://github.com/mgba-emu/mgba.git}"
# mgba master, 2026-07-21
MGBA_REF="${MGBA_REF:-c034660f007c543233f1cadeb0ca13c71afd8f41}"

OPT="${MGBA_OPT:--O3}"
JOBS="${MGBA_JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"

mkdir -p "${BUILD_DIR}" "${OUT_DIR}"

# --- Fetch pinned source ----------------------------------------------------
if [ ! -d "${BUILD_DIR}/.git" ]; then
    echo "Cloning mGBA..."
    git clone "${MGBA_REPO}" "${BUILD_DIR}"
fi
git -C "${BUILD_DIR}" fetch --quiet origin "${MGBA_REF}" || true
git -C "${BUILD_DIR}" checkout --quiet "${MGBA_REF}"

# --- Configure --------------------------------------------------------------
# Every USE_* is forced off rather than left to find_feature: an Emscripten
# sysroot can surface a host zlib/png and quietly link something that will not
# load in a browser.
#
# The two flags in CMAKE_C_FLAGS are what upstream's CMakeLists does not do for
# us, because it has never been configured for Emscripten:
#
#  * `_GNU_SOURCE` — Emscripten satisfies `if(UNIX)` but is not "Linux", which
#    is the only branch that defines it. Without it, `-std=c11` hides `strdup`
#    and `strlcpy` behind __STRICT_ANSI__ and core/config.c, core/cheats.c,
#    core/core.c and core/interface.c all fail to compile.
#  * `DISABLE_THREADING` — the same `if(UNIX)` branch force-enables
#    USE_PTHREADS, overriding it on the command line. This build is
#    single-threaded (no SharedArrayBuffer, no COOP/COEP requirement), and the
#    flag is a configuration mGBA supports and its libretro port already uses.
#
# BUILD_GL* are off for the same reason: `src/platform/opengl/gl.c` calls
# `glClearBufferiv`, which is GL ES 3.0, and Emscripten links ES2 by default.
# The SDK blits to a 2D canvas, so none of that backend is ever reached.
echo "Configuring mGBA (emcmake)..."
emcmake cmake \
    -S "${BUILD_DIR}" \
    -B "${CMAKE_DIR}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="${OPT} -D_GNU_SOURCE -DDISABLE_THREADING" \
    -DBUILD_STATIC=ON \
    -DBUILD_SHARED=OFF \
    -DDISABLE_FRONTENDS=ON \
    -DDISABLE_DEPS=ON \
    -DBUILD_QT=OFF \
    -DBUILD_SDL=OFF \
    -DBUILD_LIBRETRO=OFF \
    -DBUILD_TEST=OFF \
    -DBUILD_SUITE=OFF \
    -DBUILD_GL=OFF \
    -DBUILD_GLES2=OFF \
    -DBUILD_GLES3=OFF \
    -DUSE_PTHREADS=OFF \
    -DUSE_ZLIB=OFF \
    -DUSE_MINIZIP=OFF \
    -DUSE_LIBZIP=OFF \
    -DUSE_PNG=OFF \
    -DUSE_SQLITE3=OFF \
    -DUSE_FFMPEG=OFF \
    -DUSE_ELF=OFF \
    -DUSE_LZMA=OFF \
    -DUSE_LUA=OFF \
    -DUSE_JSON_C=OFF \
    -DUSE_FREETYPE=OFF \
    -DUSE_EDITLINE=OFF \
    -DUSE_DISCORD_RPC=OFF \
    -DUSE_EPOXY=OFF \
    -DENABLE_SCRIPTING=OFF \
    -DENABLE_DEBUGGERS=OFF \
    > /dev/null

echo "Building libmgba.a..."
cmake --build "${CMAKE_DIR}" --target mgba -j "${JOBS}"

LIB="$(find "${CMAKE_DIR}" -name 'libmgba.a' -print -quit)"
if [ -z "${LIB}" ]; then
    echo "error: libmgba.a not produced by the CMake build" >&2
    exit 1
fi

# --- Link the shim ----------------------------------------------------------
# The shim must see the exact same preprocessor defines libmgba.a was built
# with, because `struct mCore` changes shape with them: ENABLE_VFS plus
# ENABLE_DIRECTORIES insert an `mDirectorySet` early in the struct, and
# MINIMAL_CORE removes an `mInputMap`. Get one of them wrong and every function
# pointer past that field is read from the wrong offset — the failure is a
# "null function or function signature mismatch" at the first `core->init()`,
# nowhere near the cause.
#
# So they are not restated here: they are lifted from the flags CMake actually
# used, which also means an upstream change to the feature set cannot silently
# desynchronize the two halves of this build.
FLAGS_MAKE="${CMAKE_DIR}/CMakeFiles/mgba.dir/flags.make"
if [ ! -f "${FLAGS_MAKE}" ]; then
    echo "error: ${FLAGS_MAKE} not found — cannot mirror libmgba's defines" >&2
    exit 1
fi
CORE_DEFINES=()
while read -r define; do
    CORE_DEFINES+=("${define}")
done < <(grep -m1 '^C_DEFINES' "${FLAGS_MAKE}" | cut -d= -f2- | tr ' ' '\n' | grep '^-D')

echo "Mirroring libmgba defines: ${CORE_DEFINES[*]}"

CFLAGS=(
    "${OPT}"
    -std=gnu11
    -I"${BUILD_DIR}/include"
    -I"${CMAKE_DIR}/include"
    -D_GNU_SOURCE
    -DDISABLE_THREADING
    -DNDEBUG
    "${CORE_DEFINES[@]}"
    -Wno-deprecated-declarations
)

LDFLAGS=(
    "${OPT}"
    --no-entry
    -sMODULARIZE=1
    -sEXPORT_NAME=createMgbaModule
    -sENVIRONMENT=web,node  # node: enables the headless smoke test harness
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=67108864    # 64MB: 32MB carts plus savestate scratch
    -sMAXIMUM_MEMORY=536870912
    -sSTACK_SIZE=1048576
    # FILESYSTEM stays enabled: mGBA's VFS layer is compiled in (ENABLE_VFS is
    # forced ON by its CMakeLists and cannot be turned off from the outside),
    # so the stdio calls it makes need something real behind them even though
    # every asset this port loads travels through memory.
    -sEXPORTED_FUNCTIONS=_malloc,_free
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAP16,HEAPU32,UTF8ToString,stringToUTF8,lengthBytesUTF8
)

echo "Linking shim + libmgba with emcc..."
emcc \
    "${CFLAGS[@]}" \
    "${PROJECT_DIR}/scripts/shim/mgba_shim.c" \
    "${LIB}" \
    "${LDFLAGS[@]}" \
    -o "${OUT_DIR}/mgba.js"

echo "Built artifacts:"
ls -lh "${OUT_DIR}/mgba.js" "${OUT_DIR}/mgba.wasm"

