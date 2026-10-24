/* Dedicated 144-byte, project-owned flag record. Stock FireRed uses verified
 * SaveBlock1 unused space. The prepared CFRU build explicitly reserves
 * SaveBlock2 offset E20; NEVER reuse the stock offset in an expanded save.
 * Build with STUDIO_SAVE_POINTER / STUDIO_SAVE_OFFSET for the target adapter.
 * Ownership conflicts return 2 without modifying data.
 */
typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
#define TOKEN 0x55667788u
#ifndef STUDIO_SAVE_POINTER
#define STUDIO_SAVE_POINTER 0x03005008
#endif
#ifndef STUDIO_SAVE_OFFSET
#define STUDIO_SAVE_OFFSET 0x348C
#endif
__attribute__((section(".text.entry")))
void project_quests(void) {
 volatile u16 *vars=(volatile u16 *)0x020370B8;
 volatile u16 *result=(volatile u16 *)0x020370D0;
 volatile u8 *base=*(volatile u8 **)STUDIO_SAVE_POINTER;
 u32 slot=vars[0],op=vars[1];
 *result=2;
 if(slot>=1024||op>2||base<(u8 *)0x02000000||base>(u8 *)0x0203C000)return;
 volatile u8 *p=base+STUDIO_SAVE_OFFSET;
 volatile u32 *header=(volatile u32 *)p;
 if(header[0]!=0x31514D53u||header[1]!=TOKEN){
  for(u32 i=0;i<144;i++)if(p[i])return;
  if(op==0){*result=0;return;}
  header[0]=0x31514D53u;header[1]=TOKEN;
 }
 u32 byte=16+(slot>>3),mask=1u<<(slot&7);
 if(op==1)p[byte]|=mask;
 if(op==2)p[byte]&=~mask;
 *result=(p[byte]&mask)?1:0;
}
