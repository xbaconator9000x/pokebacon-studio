// Native field policies; engine ABI from pret/pokefirered. No battle move hook.
typedef unsigned char u8;typedef unsigned short u16;typedef unsigned int u32;
typedef struct {u8 kind,op;u16 value;u16 slots[16];u8 bits,pad[3];} Condition;
typedef struct {u16 move,item;u8 mode,count;u16 pad;const Condition *conditions;} Rule;
typedef struct {u8 depth,mode,comparison,pad;u32 native;const u8 *script;} Context;
typedef struct {u32 address,index;} ScriptCheck;
typedef struct {u32 magic,flagOriginal,bag,getMon,knowsMove,party,flagCommand,partyCommand,result,speciesVar,var0,var1,questEntry,partyInternal,itemIsMail,surfOriginal,testAvatar,partyReturn,surfReturn,waterReturn,callbacks,rules,scriptChecks,scriptCheckCount,varGet,switchVar;} Config;
__attribute__((section(".config"),used)) volatile const Config hm_config={0x314d4853};
#define C hm_config
static const Rule *rules(void){return(const Rule*)C.rules;}
static u32 mon(void *p,u32 field){return((u32(*)(void*,u32,void*))C.getMon)(p,field,0);}
static u32 flag(u32 id){return((u8(*)(u16))C.flagOriginal)(id);}
static u32 quest(u32 slot){if(!C.questEntry)return 2;volatile u16 *r=(u16*)C.result,*a=(u16*)C.var0,*b=(u16*)C.var1;u16 oldR=*r,oldA=*a,oldB=*b;*a=slot;*b=0;((void(*)(void))C.questEntry)();u32 value=*r;*r=oldR;*a=oldA;*b=oldB;return value;}
static u32 compare(u32 a,u32 op,u32 b){switch(op){case 0:return a<b;case 1:return a==b;case 2:return a>b;case 3:return a<=b;case 4:return a>=b;case 5:return a!=b;}return 0;}
static u32 prerequisites(u32 index){const Rule *r=rules()+index;if(!r->mode)return flag(0x820+index);for(u32 i=0;i<r->count;i++){const Condition *c=r->conditions+i;u32 value=0;if(c->kind==0){if(!flag(0x81f+c->value))return 0;continue;}for(u32 bit=0;bit<c->bits;bit++){u32 v=quest(c->slots[bit]);if(v>1)return 0;value|=v<<bit;}if(!compare(value,c->op,c->value))return 0;}return 1;}
static u32 indexOf(u32 move){for(u32 i=0;i<7;i++)if(rules()[i].move==move)return i;return 7;}
static u32 actor(u32 move,u32 taught){for(u32 i=0;i<6;i++){void *p=(u8*)C.party+i*100;if(!mon(p,11))break;if(mon(p,45))continue;if(!taught||((u8(*)(void*,u16))C.knowsMove)(p,move))return i;}return 6;}
__attribute__((section(".text.export"))) u32 hm_actor(u32 index){if(index>=7)return 6;const Rule *r=rules()+index;if(r->mode==5||!prerequisites(index))return 6;if((r->mode==2||r->mode==3)&&!((u8(*)(u16,u16))C.bag)(r->item,1))return 6;return actor(r->move,r->mode<2);}
__attribute__((section(".text.export"))) u8 hm_flag(u16 id){u32 caller=(u32)__builtin_return_address(0);if(caller==C.partyReturn||caller==C.surfReturn||caller==C.waterReturn){u32 i=id-0x820;if(i<7&&rules()[i].mode)return hm_actor(i)<6;}return flag(id);}
__attribute__((section(".text.export"))) u8 hm_checkflag(Context *ctx){const ScriptCheck *checks=(const ScriptCheck*)C.scriptChecks;for(u32 i=0;i<C.scriptCheckCount;i++)if((u32)ctx->script==checks[i].address&&rules()[checks[i].index].mode){ctx->comparison=hm_actor(checks[i].index)<6;ctx->script+=2;return 0;}return((u8(*)(Context*))C.flagCommand)(ctx);}
__attribute__((section(".text.export"))) u8 hm_checkparty(Context *ctx){u32 move=ctx->script[0]|ctx->script[1]<<8,index=indexOf(move);if(index>=7||!rules()[index].mode)return((u8(*)(Context*))C.partyCommand)(ctx);ctx->script+=2;u32 a=hm_actor(index);*(volatile u16*)C.result=a;if(a<6)*(volatile u16*)C.speciesVar=mon((u8*)C.party+a*100,11);return 0;}
__attribute__((section(".text.export"))) u8 hm_surf(void){if(!rules()[4].mode)return((u8(*)(void))C.surfOriginal)();if(((u8(*)(u8))C.testAvatar)(8))return 0;return hm_actor(4)<6;}
static void append(u8 *menu,u8 action){u32 n=menu[23];if(n<8){menu[15+n]=action;menu[23]=n+1;}}
static u32 knows(void *p,u32 move){return((u8(*)(void*,u16))C.knowsMove)(p,move);}
static u32 has(u16 *list,u32 count,u32 move){for(u32 i=0;i<count;i++)if(list[i]==move)return 1;return 0;}
// Original list has room for four moves plus summary/switch/item/cancel.
// Tool-only moves appear where their native setup permits them. No fake moves
// are returned to GetMonData, MonKnowsMove or battle code.
__attribute__((section(".text.export"))) void hm_partylist(void *mons,u8 slot){
 u8 *menu=*(u8**)C.partyInternal;void *selected=(u8*)mons+slot*100;u16 moves[4];u32 count=0;menu[23]=0;append(menu,0);
 const u16 *fieldMoves=(const u16*)(C.callbacks-26);
 for(u32 n=0;n<4&&count<4;n++){u32 move=mon(selected,13+n),i=indexOf(move);if(has(moves,count,move))continue;if(i<7&&rules()[i].mode&&(rules()[i].mode!=1||hm_actor(i)>=6))continue;for(u32 j=0;j<12;j++)if(move==fieldMoves[j]){moves[count++]=move;break;}}
 for(u32 i=0;i<7&&count<4;i++){const Rule *r=rules()+i;if(r->mode>=2&&r->mode!=5&&hm_actor(i)<6){u32 setup=*(u32*)(C.callbacks+i*8);if(((u8(*)(void))setup)())moves[count++]=r->move;}}
 for(u32 n=0;n<count;n++)for(u32 j=0;j<12;j++)if(moves[n]==fieldMoves[j]){append(menu,18+j);break;}
 if(mon((u8*)mons+100,11)&&(!C.switchVar||!((u16(*)(u16))C.varGet)(C.switchVar)))append(menu,1);u32 item=mon(selected,12);append(menu,((u8(*)(u16))C.itemIsMail)(item)?6:3);append(menu,2);
}
