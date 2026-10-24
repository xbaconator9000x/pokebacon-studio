#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
tool="${ARM_PREFIX:-arm-none-eabi}"
"$tool-gcc" -fno-use-linker-plugin -mthumb -mcpu=arm7tdmi -Os -ffreestanding -fno-builtin -fno-unwind-tables -fno-asynchronous-unwind-tables -fomit-frame-pointer -fno-stack-protector -nostdlib -Wl,-Ttext=0 -Wl,--entry=project_quests -Wl,--gc-sections "$root/project-quests.c" -o "$root/project-quests.elf"
"$tool-objcopy" -O binary "$root/project-quests.elf" "$root/project-quests.bin"
"$tool-objdump" -d "$root/project-quests.elf" > "$root/project-quests.disassembly.txt"
