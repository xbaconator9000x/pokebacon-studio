typedef unsigned char u8;typedef unsigned short u16;typedef unsigned int u32;
struct Config{char magic[8];u32 count,baseline,originalRecords,originalIcons,records;};extern const struct Config pbItemConfig;
u32 PBItem_Sanitize(u32 id){if(id>=pbItemConfig.count)return 0;const u32 *rows=(const u32*)pbItemConfig.records;return rows[id]?id:0;}
static const u8 *record(u32 id){const u32 *rows=(const u32*)pbItemConfig.records;return(const u8*)rows[PBItem_Sanitize(id)];}
u32 PBItem_Name(u32 id){const u8*r=record(id);return r[3]==8||r[3]==9?*(const u32*)r:(u32)r;}
u32 PBItem_Id(u32 id){return*(const u16*)(record(id)+14);}
u32 PBItem_Price(u32 id){return*(const u16*)(record(id)+16);}
u32 PBItem_HoldEffect(u32 id){return record(id)[18];}
u32 PBItem_HoldParam(u32 id){return record(id)[19];}
u32 PBItem_Description(u32 id){return*(const u32*)(record(id)+20);}
u32 PBItem_Importance(u32 id){return record(id)[24];}
u32 PBItem_Register(u32 id){return record(id)[25];}
u32 PBItem_Pocket(u32 id){return record(id)[26];}
u32 PBItem_Type(u32 id){return record(id)[27];}
u32 PBItem_FieldFunc(u32 id){return*(const u32*)(record(id)+28);}
u32 PBItem_BattleUsage(u32 id){return record(id)[32];}
u32 PBItem_BattleFunc(u32 id){return*(const u32*)(record(id)+36);}
u32 PBItem_Secondary(u32 id){return record(id)[40];}
u32 PBItem_Icon(u32 id,u32 kind){id=PBItem_Sanitize(id);if(kind>1)kind=0;if(id<pbItemConfig.baseline)return ((const u32*)pbItemConfig.originalIcons)[id*2+kind];return*(const u32*)(record(id)+44+kind*4);}
