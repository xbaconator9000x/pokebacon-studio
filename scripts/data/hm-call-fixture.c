typedef unsigned int u32;
__attribute__((used,section(".text.export"))) void qa_frame(void){volatile u32*q=(u32*)0x0203f000;if(!q[0])return;u32 v=((u32(*)(u32,u32,u32,u32,u32,u32,u32,u32))q[0])(q[1],q[2],q[3],q[4],q[5],q[6],q[7],q[8]);q[10]=v;q[0]=0;}
__attribute__((used,section(".text.export"))) u32 qa_yes(void){return 1;}
__attribute__((used,section(".text.export"))) u32 qa_no(void){return 0;}
__attribute__((used,section(".text.export"))) u32 qa_nonscope(u32 fn,u32 arg){u32 v=((u32(*)(u32))fn)(arg);*(volatile u32*)0x0203f030=v;return v;}
