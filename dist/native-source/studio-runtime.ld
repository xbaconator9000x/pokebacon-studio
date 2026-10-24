ENTRY(studio_movie_main)
SECTIONS {
 . = 0;
 .text : { KEEP(*(.text.export)) *(.text*) *(.rodata*) }
 . = ALIGN(4);
 .config : { KEEP(*(.config)) }
 .data : { *(.data*) }
 /DISCARD/ : { *(.ARM.exidx*) *(.ARM.extab*) *(.comment*) *(.note*) *(.debug*) }
}
