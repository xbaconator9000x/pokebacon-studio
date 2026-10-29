typedef unsigned char u8;typedef unsigned short u16;typedef unsigned int u32;
struct Rule{u16 condition;u16 percent;};
struct Ability{u16 id;u16 count;const u8*name;const u8*description;const u32*multipliers;const char*owner;const char*spec;u16 switchAlias;u16 endAlias;};
struct Config{char magic[8];u32 count;const struct Ability*abilities;u32 originalDamage;u32 contact;u32 contactMon;u32 names;u32 descriptions;u32 originalEvents;u32 record;u32 newBS;u32 battleStruct;u32 mons;};extern const struct Config pbAbilityConfig;
static const struct Ability*lookup(u32 id){for(u32 i=0;i<pbAbilityConfig.count;i++)if(pbAbilityConfig.abilities[i].id==id)return&pbAbilityConfig.abilities[i];return 0;}
u32 PBAbility_Name(u32 id){const struct Ability*a=lookup(id);if(a)return(u32)a->name;if(id>316)id=0;const u8*r=(const u8*)pbAbilityConfig.names+id*17;return r[3]==8||r[3]==9?*(const u32*)r:(u32)r;}
u32 PBAbility_Description(u32 id){const struct Ability*a=lookup(id);if(a)return(u32)a->description;return ((const u32*)pbAbilityConfig.descriptions)[id>316?0:id];}
static u32 add(u32 a,u32 b){return a>0x7fffffff-b?0x7fffffff:a+b;}
static u32 mul(u32 a,u32 b){u32 out=0;while(b){if(b&1)out=add(out,a);b>>=1;if(b)a=add(a,a);}return out;}
u32 PBAbility_Apply(u32 damage,u32 id,u32 type,u32 contact){const struct Ability*a=lookup(id);if(!a)return damage;u32 coefficient=a->multipliers[(type<24?type:0)*2+(contact?1:0)];u32 out=add(mul(damage,coefficient>>16),add(mul(damage>>16,coefficient&65535),((damage&65535)*(coefficient&65535))>>16));return coefficient&&damage&&!out?1:out;}
u32 PBAbility_Damage(u8*data){u32 value=((u32(*)(u8*))pbAbilityConfig.originalDamage)(data);u32 id=*(u16*)(data+18);if(!lookup(id))return value;u32 move=*(u16*)(data+80),contact;if(*(u32*)(data+4))contact=((u32(*)(u32,u32))pbAbilityConfig.contactMon)(move,*(u32*)(data+4));else contact=((u32(*)(u32,u32,u32))pbAbilityConfig.contact)(move,data[0],data[1]);return PBAbility_Apply(value,id,data[82],contact);}

/* Delegate event actions to the verified engine handlers. The native scripts own
 * animation, weather duration, stat protections, HP updates and controller IO. */
u32 PBAbility_Events(u32 kind,u32 bank,u32 ability,u32 special,u32 move){
 const struct Config*c=&pbAbilityConfig;
 u8*bs=*(u8**)c->newBS;
 const struct Ability*a=bs&&bank<4&&!special?lookup(*(u16*)(bs+0x7c+bank*2)):0;
 u32 alias=0;
 if(a&&kind==0)alias=a->switchAlias;
 if(a&&kind==1)alias=a->endAlias;
 u8*mon=(u8*)c->mons+bank*88;
 u8*battle=*(u8**)c->battleStruct;
 u16 hp=0;u8 type=0;u32 immune=0;
 if(a&&kind==3&&move&&battle){
  u32 contact=((u32(*)(u32,u32,u32))c->contact)(move,*(u8*)0x02023d6b,bank);
  if(!a->multipliers[(battle[0x13]<24?battle[0x13]:0)*2+(contact?1:0)]){
   /* Full-HP Water Absorb selects the native no-effect/PP-loss script.
    * Restore both synchronous inputs before the selected script can execute. */
   hp=*(u16*)(mon+40);type=battle[0x13];
   *(u16*)(mon+40)=*(u16*)(mon+44);battle[0x13]=11;alias=11;immune=1;
  }
 }
 u32 result=((u32(*)(u32,u32,u32,u32,u32))c->originalEvents)(kind,bank,ability,alias?alias:special,move);
 if(immune){*(u16*)(mon+40)=hp;battle[0x13]=type;}
 if(a&&alias){*(u16*)(bs+0x94)=a->id;if(result)((void(*)(u32,u32))c->record)(bank,a->id);}
 return result;
}
