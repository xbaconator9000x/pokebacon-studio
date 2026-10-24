/* Default stock FireRed / verified source profile layout. This is NOT a new game flag range.
 * SaveBlock1's documented unused_348C[400] supplies a dedicated 144-byte
 * project-owned record: SMQ1 + project token + reserved 8 bytes + 1024 bits.
 * The installer relocates four address literals for verified source profiles:
 * SaveBlock2 pointer 0300500C, unused_B20 and its B24/BB0 bounds.
 * Never changes a story flag or variable. Other nonzero owners fail closed.
 */
typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
#define TOKEN 0x55667788u
__attribute__((section(".text.entry")))
void project_quests(void) {
 volatile u16 *vars=(volatile u16 *)0x020370B8;
 volatile u16 *result=(volatile u16 *)0x020370D0;
 volatile u8 *base=*(volatile u8 **)0x03005008;
 u32 slot=vars[0],op=vars[1];
 *result=2;
 if(slot>=1024||op>2||base<(u8 *)0x02000000||base>(u8 *)0x0203C000)return;
 volatile u8 *p=base+0x348C;
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
