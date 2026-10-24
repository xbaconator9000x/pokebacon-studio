#include "defines.h"
#include <stddef.h>
// Reserve a record inside the engine's existing saved SaveBlock2 allocation.
// The following checks must pass when this engine's layouts change.
typedef char studio_offset_check[offsetof(struct SaveBlock2, studioQuestRecord) == 0xE20 ? 1 : -1];
typedef char studio_size_check[sizeof(((struct SaveBlock2 *)0)->studioQuestRecord) == 144 ? 1 : -1];
const unsigned int gStudioSaveAdapter[] = {0x31534250, 1, 0x0300500C, 0xE20, 144, 0x020370B8, 0x020370D0};
