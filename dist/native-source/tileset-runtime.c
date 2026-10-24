// Project animation clips use the existing FRLG VBlank DMA queue.
typedef unsigned short u16;typedef unsigned int u32;
typedef struct {u32 frames;u16 tile,tiles,count,ticks;} Clip;
typedef struct {u32 magic,originalInit,originalTick,originalCycle,counter,maximum,callback,append,clips,count,cycle,tickEntry;} Config;
__attribute__((section(".config"),used)) volatile const Config anim_config={0x314d4e41};
#define C anim_config
__attribute__((section(".text.export"))) void anim_tick(u16 timer){
 if(C.originalTick)((void(*)(u16))C.originalTick)(timer%C.originalCycle);
 const Clip *clips=(const Clip*)C.clips;
 for(u32 i=0;i<C.count;i++){const Clip *c=clips+i;if(timer%c->ticks==0){u32 frame=(timer/c->ticks)%c->count;((void(*)(u32,u32,u16))C.append)(c->frames+frame*c->tiles*32,0x06000000+c->tile*32,c->tiles*32);}}
}
__attribute__((section(".text.export"))) void anim_init(void){
 if(C.originalInit)((void(*)(void))C.originalInit)();
 *(volatile u16*)C.counter=0;*(volatile u16*)C.maximum=C.cycle;*(volatile u32*)C.callback=C.tickEntry;
 anim_tick(0);
}
